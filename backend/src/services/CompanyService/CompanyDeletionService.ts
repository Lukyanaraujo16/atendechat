/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue, max-classes-per-file -- exclusão sequencial em lotes é intencional */
/**
 * Exclusão definitiva de empresa — assíncrona, retomável e auditada (CompanyDeletions).
 *
 * Fases (todas idempotentes; uma nova tentativa recomeça do início e pula o que já foi feito):
 * 1. integrations    — conexões: logout Baileys e DELETE remoto da instância Evolution (best-effort,
 *                      mesma política de DeleteWhatsAppService).
 * 2. files_inventory — lista os arquivos físicos da empresa ANTES do banco (depois as referências somem);
 *                      arquivos também referenciados por outra empresa ficam fora.
 * 3. archive         — cópia restrita dos registros financeiros da plataforma (retenção legal).
 * 4. database        — remove, em lotes curtos (cada lote com commit próprio), toda linha com "companyId"
 *                      da empresa, guiado pelo catálogo do Postgres; por fim a linha de Companies.
 * 5. files           — remove os arquivos listados; o que falhar fica pendente para nova tentativa.
 * Só é "completed" quando a empresa não existe mais e não restam arquivos pendentes.
 * A empresa fica desativada desde o pedido: estados intermediários nunca ficam operacionais.
 */
import fs from "fs";
import path from "path";
import { Op, QueryTypes, UniqueConstraintError } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import CompanyDeletion from "../../models/CompanyDeletion";
import Whatsapp from "../../models/Whatsapp";
import {
  isBaileysConnection,
  isEvolutionConnection,
  resolveWhatsAppConnectionProvider
} from "../../modules/whatsapp/connectionProvider";
import WhatsappEvolutionCredential from "../../models/WhatsappEvolutionCredential";
import {
  EvolutionHttpError,
  evolutionDeleteInstance
} from "../../modules/whatsapp/providers/evolution/inbound/evolutionHttpClient";
import { getBackendPublicFolder } from "../../helpers/publicFolder";
import {
  companyLogoDir,
  receiptLogoRoot
} from "../InventoryService/inventoryReceiptLogo";
import { listCompanyStoredFiles } from "../CompanyMediaService/ListCompanyMediaService";
import { countAllReferencesToRelPath } from "../CompanyMediaService/countAllReferencesToRelPath";
import { createCompanyLog } from "./CreateCompanyLogService";
import { applyCompanyDeactivation } from "./CompanyActivationService";
import { logger } from "../../utils/logger";

// Sob demanda: libs/wbot carrega o Baileys (ESM), desnecessário para quem só importa o controller.
/* eslint-disable global-require, @typescript-eslint/no-var-requires */
// stickerStorage carrega o sharp (binário nativo): só quando a exclusão roda.
const loadStickerStorage = (): typeof import("../../helpers/stickerStorage") =>
  require("../../helpers/stickerStorage");
const loadWbot = (): typeof import("../../libs/wbot") =>
  require("../../libs/wbot");
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

/** Registros financeiros da própria plataforma (faturamento SaaS): arquivados antes de remover. */
export const FINANCIAL_ARCHIVE_TABLES = [
  "Invoices",
  "Subscriptions",
  "SaaSPayments",
  "SaaSPaymentAttempts",
  "SaaSFinancialEvents",
  "SaaSSubscriptionRenewals",
  "SaaSReconciliationItems",
  "SaaSInvoiceHistoricalReviews",
  "SaaSGatewayWebhookEvents"
];
const NEVER_DELETE = new Set([
  "Companies",
  "CompanyDeletions",
  "CompanyDeletionArchives",
  "SequelizeMeta"
]);
/** Tabelas volumosas primeiro: evita cascatas grandes num único lote (ex.: Tickets → Messages). */
const PRIORITY = [
  "Messages",
  "ChatMessages",
  "TicketTraking",
  "UserNotifications",
  "Tickets",
  "Contacts"
];
const BATCH_SIZE = 2000;
const MAX_PASSES = 30;

/** Rótulos amigáveis para mensagens ao administrador (sem detalhes internos). */
const BLOCKER_LABELS: Record<string, string> = {
  InventoryStockMovements: "movimentações de estoque",
  InventorySaleItems: "itens de vendas",
  InventoryProducts: "produtos",
  InventoryDiscountAuthorizations: "autorizações de desconto",
  InventoryStoreCreditOverrides: "autorizações de crediário",
  Users: "usuários",
  Tickets: "atendimentos",
  Whatsapps: "conexões WhatsApp"
};

type FileTarget = { kind: "file" | "dir"; path: string };

export class CompanyDeletionBlockedError extends Error {
  constructor(public readonly blockers: Record<string, string>) {
    super(`blocked: ${Object.keys(blockers).join(", ")}`);
  }
}

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

function insideRoot(target: string, root: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function allowedRoots(): string[] {
  return [getBackendPublicFolder(), receiptLogoRoot(), process.cwd()];
}

/* ------------------------------ fase 1: integrações ------------------------------ */

type IntegrationResult = {
  whatsappId: number;
  provider: string;
  /** removed | already_absent | no_credential | shared_skipped | failed | session_closed */
  status: string;
  reason?: string;
};

export class EvolutionRemotePendingError extends Error {
  constructor(public readonly pending: number) {
    super(`evolution_remote_pending:${pending}`);
  }
}

/**
 * Remove a instância remota Evolution da conexão. Só a credencial da PRÓPRIA empresa é usada;
 * instância cujo nome/URL também aparece em outra empresa nunca é removida remotamente.
 */
async function removeEvolutionInstance(
  companyId: number,
  whatsappId: number
): Promise<IntegrationResult> {
  const base = { whatsappId, provider: "evolution" };
  const cred = await WhatsappEvolutionCredential.unscoped().findOne({
    where: { whatsappId },
    attributes: ["companyId", "baseUrl", "instanceName"]
  });
  if (!cred || Number(cred.companyId) !== Number(companyId)) {
    return { ...base, status: "no_credential" };
  }
  const shared = await WhatsappEvolutionCredential.unscoped().count({
    where: {
      baseUrl: cred.baseUrl,
      instanceName: cred.instanceName,
      companyId: { [Op.ne]: companyId }
    }
  });
  if (shared > 0) return { ...base, status: "shared_skipped" };
  try {
    await evolutionDeleteInstance({ whatsappId });
    return { ...base, status: "removed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/\b404\b/.test(message)) return { ...base, status: "already_absent" };
    const code =
      err instanceof EvolutionHttpError ? err.code : "ERR_EVOLUTION_DELETE";
    logger.warn(
      { companyId, whatsappId, code },
      "[CompanyDeletion] instância Evolution não removida — exclusão pendente"
    );
    return { ...base, status: "failed", reason: code };
  }
}

/**
 * Encerra as integrações ANTES de apagar o banco (depois as credenciais deixam de existir).
 * Falha remota Evolution interrompe a exclusão com dados intactos: nova tentativa refaz esta fase.
 */
async function stopIntegrations(
  companyId: number,
  stats: Record<string, unknown>
) {
  const whatsapps = await Whatsapp.findAll({ where: { companyId } });
  const results: IntegrationResult[] = [];
  for (const w of whatsapps) {
    const provider = resolveWhatsAppConnectionProvider(w);
    if (isEvolutionConnection(provider)) {
      results.push(await removeEvolutionInstance(companyId, w.id));
    } else if (isBaileysConnection(provider)) {
      await loadWbot().removeWbot(w.id, true);
      results.push({ whatsappId: w.id, provider, status: "session_closed" });
    }
  }
  if (results.length) stats.integrations = results;
  const pending = results.filter(r => r.status === "failed").length;
  if (pending > 0) throw new EvolutionRemotePendingError(pending);
}

/* --------------------------- fase 2: inventário de arquivos --------------------------- */

async function inventoryFiles(
  companyId: number
): Promise<{ targets: FileTarget[]; skippedShared: number }> {
  const publicRoot = getBackendPublicFolder();
  const targets: FileTarget[] = [];
  let skippedShared = 0;

  for (const f of await listCompanyStoredFiles(companyId)) {
    const abs = path.resolve(publicRoot, f.storageRel);
    if (!insideRoot(abs, publicRoot)) continue;
    // Mesmo arquivo em uso por outra empresa (public/ é compartilhado): nunca remover.
    if (
      (await countAllReferencesToRelPath(companyId, f.storageRel, undefined, {
        otherCompanies: true
      })) > 0
    ) {
      skippedShared += 1;
      continue;
    }
    targets.push({ kind: "file", path: abs });
  }

  const docs = await sequelize
    .query<{ storagePath: string | null }>(
      `SELECT "storagePath" FROM "AiKnowledgeDocuments" WHERE "companyId" = :id AND "storagePath" IS NOT NULL`,
      { replacements: { id: companyId }, type: QueryTypes.SELECT }
    )
    .catch(() => [] as Array<{ storagePath: string | null }>);
  for (const d of docs) {
    const abs = path.resolve(process.cwd(), String(d.storagePath));
    if (insideRoot(abs, process.cwd()))
      targets.push({ kind: "file", path: abs });
  }

  // Pastas exclusivas da empresa.
  for (const dir of [
    loadStickerStorage().getStickerCompanyDir(companyId),
    companyLogoDir(companyId),
    path.resolve(publicRoot, `company${companyId}`)
  ]) {
    targets.push({ kind: "dir", path: dir });
  }
  return { targets, skippedShared };
}

/* ------------------------------ fase 3: arquivo financeiro ------------------------------ */

async function existingTables(): Promise<Set<string>> {
  const rows = await sequelize.query<{ table_name: string }>(
    `SELECT c.table_name FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public' AND c.column_name = 'companyId' AND t.table_type = 'BASE TABLE'`,
    { type: QueryTypes.SELECT }
  );
  return new Set(rows.map(r => r.table_name));
}

async function archiveFinancialRecords(
  job: CompanyDeletion,
  tables: Set<string>
) {
  const archive = async (table: string, where: string) => {
    const [row] = await sequelize.query<{ rows: unknown[]; n: number }>(
      `SELECT coalesce(json_agg(row_to_json(x)), '[]'::json) AS rows, count(*)::int AS n FROM ${q(
        table
      )} x WHERE ${where}`,
      { replacements: { id: job.companyId }, type: QueryTypes.SELECT }
    );
    if (!row || row.n === 0) return 0;
    await sequelize.query(
      `INSERT INTO "CompanyDeletionArchives" ("deletionId", "companyId", "tableName", "rowCount", "rows", "createdAt")
       VALUES (:deletionId, :id, :table, :n, CAST(:rows AS jsonb), now())
       ON CONFLICT ("deletionId", "tableName") DO NOTHING`,
      {
        replacements: {
          deletionId: job.id,
          id: job.companyId,
          table,
          n: row.n,
          rows: JSON.stringify(row.rows)
        }
      }
    );
    return row.n;
  };
  const archived: Record<string, number> = {};
  // Identificação do cliente das faturas (nome, documento, contato).
  const n = await archive("Companies", `x."id" = :id`);
  if (n) archived.Companies = n;
  for (const table of FINANCIAL_ARCHIVE_TABLES) {
    if (!tables.has(table)) continue;
    const count = await archive(table, `x."companyId" = :id`);
    if (count) archived[table] = count;
  }
  return archived;
}

/* ------------------------------- fase 4: banco de dados ------------------------------- */

type FkInfo = {
  child: string;
  childCol: string;
  parent: string;
  parentCol: string;
};

async function fkInfo(constraint: string): Promise<FkInfo | null> {
  const rows = await sequelize.query<FkInfo>(
    `SELECT cc.relname AS child, a.attname AS "childCol", pc.relname AS parent, pa.attname AS "parentCol"
       FROM pg_constraint c
       JOIN pg_class cc ON cc.oid = c.conrelid
       JOIN pg_class pc ON pc.oid = c.confrelid
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
      WHERE c.conname = :constraint AND c.contype = 'f' LIMIT 1`,
    { replacements: { constraint }, type: QueryTypes.SELECT }
  );
  return rows[0] || null;
}

function pgCodeOf(err: unknown): string | null {
  return (err as { parent?: { code?: string } })?.parent?.code ?? null;
}

function fkConstraintOf(err: unknown): string | null {
  const parent = (err as { parent?: { code?: string; constraint?: string } })
    ?.parent;
  return parent?.code === "23503" && parent.constraint
    ? parent.constraint
    : null;
}

async function deleteBatch(table: string, companyId: number): Promise<number> {
  const rows = await sequelize.query(
    `DELETE FROM ${q(table)} WHERE ctid = ANY(ARRAY(SELECT ctid FROM ${q(
      table
    )} WHERE "companyId" = :id LIMIT ${BATCH_SIZE})) RETURNING 1`,
    { replacements: { id: companyId }, type: QueryTypes.SELECT }
  );
  return rows.length;
}

/**
 * Linha-filha sem "companyId" que bloqueia (RESTRICT/NO ACTION) pertence à linha da empresa
 * que ela referencia: remove só as filhas que apontam para linhas desta empresa.
 * Filhas COM "companyId" são de alguma empresa: as desta empresa saem na própria vez;
 * as de outra empresa NUNCA são tocadas (a exclusão para como bloqueada).
 */
async function clearOwnedChildren(
  info: FkInfo,
  companyId: number,
  tables: Set<string>
): Promise<number> {
  if (tables.has(info.child)) return 0;
  const parentFilter =
    info.parent === "Companies" ? `"id" = :id` : `"companyId" = :id`;
  const rows = await sequelize.query(
    `DELETE FROM ${q(info.child)} WHERE ${q(info.childCol)} IN (SELECT ${q(
      info.parentCol
    )} FROM ${q(info.parent)} WHERE ${parentFilter}) RETURNING 1`,
    { replacements: { id: companyId }, type: QueryTypes.SELECT }
  );
  return rows.length;
}

async function deleteDatabaseRows(
  companyId: number,
  tables: Set<string>,
  stats: Record<string, unknown>,
  round = 1
): Promise<void> {
  const ordered = [
    ...PRIORITY.filter(t => tables.has(t)),
    ...Array.from(tables)
      .filter(t => !PRIORITY.includes(t) && !NEVER_DELETE.has(t))
      .sort()
  ];
  const deleted = (stats.deletedRows as Record<string, number>) || {};
  stats.deletedRows = deleted;
  let pending = ordered;

  for (let pass = 1; pass <= MAX_PASSES && pending.length; pass += 1) {
    let progress = 0;
    const blockers: Record<string, string> = {};
    const stillPending: string[] = [];
    for (const table of pending) {
      for (;;) {
        try {
          const n = await deleteBatch(table, companyId);
          if (n === 0) break;
          progress += n;
          deleted[table] = (deleted[table] || 0) + n;
        } catch (err) {
          // FK composta com SET NULL (ex.: (contactId, companyId)) zera companyId NOT NULL:
          // a filha precisa sair antes — tenta de novo na próxima passada.
          if (pgCodeOf(err) === "23502") {
            blockers[table] = table;
            stillPending.push(table);
            break;
          }
          const constraint = fkConstraintOf(err);
          if (!constraint) throw err;
          const info = await fkInfo(constraint);
          const cleared = info
            ? await clearOwnedChildren(info, companyId, tables)
            : 0;
          if (cleared > 0) {
            progress += cleared;
            continue;
          }
          blockers[table] = info?.child || constraint;
          stillPending.push(table);
          break;
        }
      }
    }
    pending = stillPending;
    if (pending.length && progress === 0)
      throw new CompanyDeletionBlockedError(blockers);
  }
  if (pending.length)
    throw new CompanyDeletionBlockedError(
      Object.fromEntries(pending.map(t => [t, t]))
    );

  // Conferência final: nenhuma linha da empresa pode restar (inclusive criada durante a exclusão,
  // apesar da empresa já estar desativada). Sobrou algo → nova rodada, senão a operação falha.
  const leftovers: string[] = [];
  for (const table of ordered) {
    const [row] = await sequelize.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${q(table)} WHERE "companyId" = :id`,
      { replacements: { id: companyId }, type: QueryTypes.SELECT }
    );
    if (row.n > 0) leftovers.push(table);
  }
  if (leftovers.length) {
    if (round >= 3) {
      throw new CompanyDeletionBlockedError(
        Object.fromEntries(leftovers.map(t => [t, t]))
      );
    }
    await deleteDatabaseRows(companyId, tables, stats, round + 1);
    return;
  }

  // Linha da empresa por último (cascatas restantes já estão vazias).
  for (;;) {
    try {
      await sequelize.query(`DELETE FROM "Companies" WHERE "id" = :id`, {
        replacements: { id: companyId }
      });
      return;
    } catch (err) {
      const constraint = fkConstraintOf(err);
      const info = constraint ? await fkInfo(constraint) : null;
      if (!info || (await clearOwnedChildren(info, companyId, tables)) === 0) {
        throw constraint
          ? new CompanyDeletionBlockedError({
              Companies: info?.child || constraint
            })
          : err;
      }
    }
  }
}

/* ---------------------------------- fase 5: arquivos ---------------------------------- */

function removeFiles(targets: FileTarget[]): {
  remaining: FileTarget[];
  removed: number;
  errors: number;
  skippedOutsideRoots: number;
} {
  let skippedOutsideRoots = 0;
  const remaining: FileTarget[] = [];
  let removed = 0;
  let errors = 0;
  for (const t of targets) {
    // Fora das raízes permitidas: nunca é tocado (contabilizado, não removido).
    if (!allowedRoots().some(root => insideRoot(t.path, root))) {
      skippedOutsideRoots += 1;
      continue;
    }
    try {
      if (t.kind === "dir") fs.rmSync(t.path, { recursive: true, force: true });
      else fs.unlinkSync(t.path);
      removed += 1;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") continue;
      errors += 1;
      remaining.push(t);
    }
  }
  return { remaining, removed, errors, skippedOutsideRoots };
}

/* ------------------------------------- execução ------------------------------------- */

function friendlyError(err: unknown): string {
  if (err instanceof EvolutionRemotePendingError) {
    return `Exclusão interrompida antes de remover os dados: ${err.pending} instância(s) Evolution não puderam ser removidas no servidor Evolution. A empresa segue desativada e a operação pode ser retomada.`;
  }
  if (err instanceof CompanyDeletionBlockedError) {
    const labels = Array.from(
      new Set(
        Object.values(err.blockers).map(
          t => BLOCKER_LABELS[t] || "registros vinculados"
        )
      )
    );
    return `Exclusão interrompida: existem ${labels.join(
      ", "
    )} vinculados a outra empresa ou protegidos. Os dados restantes foram preservados e a operação pode ser retomada.`;
  }
  return "Falha temporária durante a exclusão. A operação pode ser retomada.";
}

export async function runCompanyDeletion(
  jobId: number
): Promise<CompanyDeletion | null> {
  // Reivindica a execução: só um processo/chamada executa (pending → running).
  const [claimed] = await sequelize.query<{ id: number }>(
    `UPDATE "CompanyDeletions" SET "status" = 'running', "attempts" = "attempts" + 1, "startedAt" = now(), "updatedAt" = now()
      WHERE "id" = :id AND "status" = 'pending' RETURNING "id"`,
    { replacements: { id: jobId }, type: QueryTypes.SELECT }
  );
  if (!claimed) return CompanyDeletion.findByPk(jobId);

  const job = (await CompanyDeletion.findByPk(jobId)) as CompanyDeletion;
  const stats: Record<string, unknown> = { ...(job.stats || {}) };
  const save = (patch: Partial<CompanyDeletion>) =>
    job.update({ ...patch, stats: { ...stats } } as Partial<CompanyDeletion>);
  const { companyId } = job;

  try {
    const companyExists =
      (await Company.count({ where: { id: companyId } })) > 0;
    if (companyExists) {
      await save({ phase: "integrations" });
      await stopIntegrations(companyId, stats);

      if (job.filePaths == null) {
        await save({ phase: "files_inventory" });
        const { targets, skippedShared } = await inventoryFiles(companyId);
        stats.filesPlanned = targets.length;
        stats.filesSkippedShared = skippedShared;
        await save({ filePaths: targets });
      }

      const tables = await existingTables();
      await save({ phase: "archive" });
      stats.archived = {
        ...((stats.archived as object) || {}),
        ...(await archiveFinancialRecords(job, tables))
      };

      await save({ phase: "database" });
      await deleteDatabaseRows(companyId, tables, stats);
    }

    await save({ phase: "files" });
    const files = removeFiles(job.filePaths || []);
    stats.filesRemoved = Number(stats.filesRemoved || 0) + files.removed;
    stats.filesSkippedOutsideRoots =
      Number(stats.filesSkippedOutsideRoots || 0) + files.skippedOutsideRoots;
    stats.fileErrors = files.errors;
    if (files.remaining.length) {
      await save({ filePaths: files.remaining });
      throw new Error(`files_pending:${files.remaining.length}`);
    }

    await save({
      status: "completed",
      phase: "done",
      filePaths: [],
      lastError: null,
      finishedAt: new Date()
    });
    logger.info(
      { companyId, deletionId: job.id, requestedBy: job.requestedBy, stats },
      "[CompanyDeletion] concluída"
    );
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err).startsWith(
      "files_pending"
    )
      ? "Alguns arquivos não puderam ser removidos. A operação pode ser retomada."
      : friendlyError(err);
    stats.errorMessage = message;
    await save({
      status: "failed",
      lastError: String(err instanceof Error ? err.message : err).slice(0, 2000)
    });
    logger.error(
      {
        companyId,
        deletionId: job.id,
        phase: job.phase,
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyDeletion] falhou — pendente de nova tentativa"
    );
  }
  return job.reload();
}

/** Pedido do Super Admin: valida, desativa a empresa e agenda a execução (retorna o acompanhamento). */
export async function requestCompanyDeletion(input: {
  companyId: number;
  userId: number | null;
  confirmName: unknown;
  runInBackground?: boolean;
}): Promise<CompanyDeletion> {
  const company = await Company.findByPk(input.companyId, {
    attributes: ["id", "name", "status"]
  });
  const open = await CompanyDeletion.findOne({
    where: {
      companyId: input.companyId,
      status: ["pending", "running", "failed"]
    }
  });
  if (!company && !open) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  const expected = String(company?.name ?? open?.companyName ?? "").trim();
  if (String(input.confirmName ?? "").trim() !== expected || !expected) {
    throw new AppError(
      "ERR_COMPANY_DELETE_CONFIRMATION",
      400,
      "Digite exatamente o nome da empresa para confirmar a exclusão definitiva."
    );
  }

  let job = open;
  if (job?.status === "running" || job?.status === "pending") return job; // já em andamento: não duplica
  if (job) {
    await job.update({
      status: "pending",
      requestedBy: input.userId ?? job.requestedBy
    });
  } else {
    try {
      job = await CompanyDeletion.create({
        companyId: input.companyId,
        companyName: company?.name ?? null,
        requestedBy: input.userId,
        status: "pending",
        phase: "integrations",
        attempts: 0,
        stats: {}
      } as CompanyDeletion);
    } catch (err) {
      if (!(err instanceof UniqueConstraintError)) throw err;
      return (await CompanyDeletion.findOne({
        where: {
          companyId: input.companyId,
          status: ["pending", "running", "failed"]
        }
      })) as CompanyDeletion;
    }
  }

  if (company) {
    // Desativa já no pedido: nenhuma operação durante a exclusão.
    if (company.status !== false) {
      await company.update({ status: false });
      await createCompanyLog({
        companyId: company.id,
        action: "block",
        userId: input.userId,
        metadata: { reason: "deletion_requested", deletionId: job.id }
      });
    }
    await applyCompanyDeactivation(company.id).catch(err =>
      logger.warn(
        { companyId: company.id, err },
        "[CompanyDeletion] desativação prévia parcial"
      )
    );
  }
  logger.info(
    {
      companyId: input.companyId,
      deletionId: job.id,
      requestedBy: input.userId
    },
    "[CompanyDeletion] solicitada"
  );

  if (input.runInBackground === false)
    return (await runCompanyDeletion(job.id)) as CompanyDeletion;
  setImmediate(() => {
    runCompanyDeletion(job!.id).catch(err =>
      logger.error({ err, deletionId: job!.id }, "[CompanyDeletion] runner")
    );
  });
  return job;
}

/** Retoma exclusões interrompidas (processo reiniciado no meio). Backend roda em processo único. */
export async function resumeCompanyDeletions(): Promise<void> {
  await sequelize.query(
    `UPDATE "CompanyDeletions" SET "status" = 'pending', "updatedAt" = now() WHERE "status" = 'running'`
  );
  const jobs = await CompanyDeletion.findAll({
    where: { status: "pending" },
    attributes: ["id"]
  });
  for (const j of jobs) await runCompanyDeletion(j.id);
}

/** Visão segura para a API (sem caminhos de arquivos nem erro interno). */
export function serializeCompanyDeletion(job: CompanyDeletion | null) {
  if (!job) return null;
  const stats = (job.stats || {}) as Record<string, unknown>;
  return {
    id: job.id,
    companyId: job.companyId,
    companyName: job.companyName,
    status: job.status,
    phase: job.phase,
    attempts: job.attempts,
    evolutionPending: Array.isArray(stats.integrations)
      ? (stats.integrations as Array<{ status?: string }>).filter(
          r => r.status === "failed"
        ).length
      : 0,
    filesPending: job.status === "completed" ? 0 : (job.filePaths || []).length,
    errorMessage:
      job.status === "failed" ? (stats.errorMessage as string) || null : null,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    createdAt: job.createdAt
  };
}
