/* eslint-disable no-restricted-syntax, no-await-in-loop, no-continue -- remoção sequencial e com parada antecipada é intencional */
/**
 * Limpeza de armazenamento por cota: ao atingir 100% remove os anexos mais antigos de mensagens
 * e atendimentos até ~90% da cota, preservando os mais recentes, o texto e os metadados.
 *
 * Elegível (todas as condições): anexo de Message da própria empresa (imagem, vídeo, áudio, PDF,
 * documento ou outro anexo com tipo identificado), arquivo existente em public/, enviado há mais
 * que a janela de upload em andamento e sem nenhuma outra referência — de outro registro da empresa
 * (respostas rápidas, campanhas, agendamentos, fluxos, arquivos, chat interno, outra mensagem) ou
 * de outra empresa. URL externa ou arquivo fora de public/ = propriedade incerta → nunca remove.
 * Vendas, estoque, financeiro, backups e logos não são anexos de mensagens e nunca entram.
 */
import fs from "fs";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../../database";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import Message from "../../models/Message";
import {
  getCompanyStorageLimitBytes,
  isStorageAutoCleanupEnabled
} from "../../helpers/companyStorage";
import { classifyMediaBucket } from "../../helpers/companyMediaTypes";
import { resolvePublicMediaStat } from "../../helpers/resolvePublicMediaStat";
import { countAllReferencesToRelPath } from "../CompanyMediaService/countAllReferencesToRelPath";
import { deleteCompanyMediaItemWithOptions } from "../CompanyMediaService/DeleteCompanyMediaItemService";
import RecalculateCompanyStorageUsageService from "./RecalculateCompanyStorageUsageService";
import { createCompanyLog } from "./CreateCompanyLogService";
import { logger } from "../../utils/logger";

const PAGE_SIZE = 500;
/** Teto de mensagens avaliadas por execução; o job diário continua depois. */
const MAX_SCANNED_PER_RUN = 50000;
/** Chave do pg_advisory lock (namespace) — par (namespace, companyId). */
const LOCK_NAMESPACE = 734001;

function envNumber(
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export function storageCleanupSettings() {
  return {
    targetPercent: envNumber(
      "STORAGE_AUTO_CLEANUP_TARGET_PERCENT",
      90,
      50,
      100
    ),
    // Protege anexos de mensagens recém-criadas (upload/processamento em andamento).
    graceMinutes: envNumber("STORAGE_AUTO_CLEANUP_GRACE_MINUTES", 60, 5, 1440)
  };
}

export type StorageCleanupStop =
  | "no_limit"
  | "within_quota"
  | "target_reached"
  | "no_more_eligible"
  | "locked";

export type StorageCleanupResult = {
  companyId: number;
  dryRun: boolean;
  usedBytes: number;
  limitBytes: number | null;
  targetBytes: number | null;
  candidates: number;
  removed: number;
  freedBytes: number;
  /** Quanto ainda faltou para a meta quando não havia mais anexos elegíveis. */
  unfreedBytes: number;
  skippedShared: number;
  skippedMissing: number;
  skippedUncertain: number;
  failed: number;
  stop: StorageCleanupStop;
  usedBytesAfter?: number;
};

type Candidate = {
  id: string;
  rel: string;
  absPath: string;
  sizeBytes: number;
  mediaType: string | null;
  body: string | null;
};

function isUncertainOwnership(rel: string): boolean {
  // URL externa (CDN etc.) não é arquivo nosso em public/.
  return /^https?:\/\//i.test(rel) && !/\/public\//i.test(rel);
}

/** Avalia um anexo; devolve candidato ou o motivo de preservação. */
async function evaluate(
  companyId: number,
  msg: Message,
  result: StorageCleanupResult
): Promise<Candidate | null> {
  const rel = String(msg.getDataValue("mediaUrl") || "");
  const mediaType = (msg.getDataValue("mediaType") as string) || null;
  const base = rel.replace(/\\/g, "/").split("/").pop() || rel;
  if (
    isUncertainOwnership(rel) ||
    (classifyMediaBucket(mediaType, base) === "other" && !mediaType)
  ) {
    result.skippedUncertain += 1;
    return null;
  }
  const stat = resolvePublicMediaStat(rel);
  if (stat.missing || stat.sizeBytes <= 0 || !stat.absPath) {
    result.skippedMissing += 1;
    return null;
  }
  // Outra referência na empresa (protegida ou não) ou em outra empresa: arquivo compartilhado.
  if (
    (await countAllReferencesToRelPath(companyId, rel)) > 1 ||
    (await countAllReferencesToRelPath(companyId, rel, undefined, {
      otherCompanies: true
    })) > 0
  ) {
    result.skippedShared += 1;
    return null;
  }
  return {
    id: String(msg.id),
    rel,
    absPath: stat.absPath,
    sizeBytes: stat.sizeBytes,
    mediaType,
    body: (msg.getDataValue("body") as string) ?? null
  };
}

/** Percorre do mais antigo ao mais recente (keyset createdAt,id) até planejar bytesToFree. */
async function collectCandidates(
  companyId: number,
  graceMinutes: number,
  bytesToFree: number,
  result: StorageCleanupResult
): Promise<Candidate[]> {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  const out: Candidate[] = [];
  let planned = 0;
  let scanned = 0;
  let cursor: { createdAt: Date; id: string } | null = null;

  while (planned < bytesToFree && scanned < MAX_SCANNED_PER_RUN) {
    const after = cursor
      ? {
          [Op.or]: [
            { createdAt: { [Op.gt]: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { [Op.gt]: cursor.id } }
          ]
        }
      : {};
    const rows = await Message.findAll({
      where: {
        companyId,
        createdAt: { [Op.lt]: cutoff },
        mediaUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
        ...after
      },
      attributes: ["id", "mediaUrl", "mediaType", "body", "createdAt"],
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"]
      ],
      limit: PAGE_SIZE
    });
    if (!rows.length) break;
    for (const msg of rows) {
      scanned += 1;
      if (planned >= bytesToFree) break;
      const candidate = await evaluate(companyId, msg, result);
      if (!candidate) continue;
      out.push(candidate);
      planned += candidate.sizeBytes;
    }
    const last = rows[rows.length - 1];
    cursor = { createdAt: last.createdAt, id: String(last.id) };
  }
  return out;
}

/**
 * Remove um anexo de forma consistente: banco primeiro (sem referência quebrada), depois o arquivo.
 * Se o arquivo não puder ser apagado, a mensagem volta ao estado anterior (nada fica contabilizado
 * como liberado sem ter sido).
 */
async function removeCandidate(
  companyId: number,
  c: Candidate
): Promise<number> {
  const r = await deleteCompanyMediaItemWithOptions(
    companyId,
    "message",
    c.id,
    {
      deferStorageDecrement: true,
      knownSizeBytes: c.sizeBytes,
      automaticCleanup: true
    }
  );
  if (fs.existsSync(c.absPath)) {
    await Message.update(
      {
        mediaUrl: c.rel,
        mediaType: c.mediaType,
        body: c.body
      } as Partial<Message>,
      { where: { id: c.id, companyId } }
    );
    throw new Error("file_not_removed");
  }
  return r.freedBytes > 0 ? r.freedBytes : c.sizeBytes;
}

const CleanupCompanyStorageService = async (
  companyId: number,
  opts: { dryRun?: boolean } = {}
): Promise<StorageCleanupResult> => {
  const dryRun = opts.dryRun ?? !isStorageAutoCleanupEnabled();
  const settings = storageCleanupSettings();

  const result: StorageCleanupResult = {
    companyId,
    dryRun,
    usedBytes: 0,
    limitBytes: null,
    targetBytes: null,
    candidates: 0,
    removed: 0,
    freedBytes: 0,
    unfreedBytes: 0,
    skippedShared: 0,
    skippedMissing: 0,
    skippedUncertain: 0,
    failed: 0,
    stop: "no_limit"
  };

  // Lock por empresa durante leitura, remoção e recálculo: uma execução concorrente nunca usa
  // consumo desatualizado nem remove o mesmo arquivo.
  await sequelize.transaction(async transaction => {
    const [lock] = await sequelize.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock(:ns, :id) AS locked",
      {
        replacements: { ns: LOCK_NAMESPACE, id: companyId },
        type: QueryTypes.SELECT,
        transaction
      }
    );
    if (!lock?.locked) {
      result.stop = "locked";
      return;
    }

    const company = await Company.findByPk(companyId, {
      attributes: ["id", "storageUsedBytes", "storageLimitGb"],
      include: [
        {
          model: Plan,
          as: "plan",
          attributes: ["storageLimitGb"],
          required: false
        }
      ]
    });
    if (!company) return;
    const row = company.toJSON() as Record<string, unknown>;
    result.usedBytes = Math.max(0, Number(row.storageUsedBytes ?? 0));
    result.limitBytes = getCompanyStorageLimitBytes(
      { storageLimitGb: row.storageLimitGb },
      (row.plan as { storageLimitGb?: unknown }) || null
    );
    if (result.limitBytes === null || result.limitBytes <= 0) return;

    result.targetBytes = Math.floor(
      (result.limitBytes * settings.targetPercent) / 100
    );
    if (result.usedBytes < result.limitBytes) {
      result.stop = "within_quota";
      return;
    }

    const bytesToFree = result.usedBytes - result.targetBytes;
    const candidates = await collectCandidates(
      companyId,
      settings.graceMinutes,
      bytesToFree,
      result
    );
    result.candidates = candidates.length;

    for (const c of candidates) {
      if (result.freedBytes >= bytesToFree) break;
      if (dryRun) {
        result.freedBytes += c.sizeBytes;
        continue;
      }
      try {
        result.freedBytes += await removeCandidate(companyId, c);
        result.removed += 1;
      } catch (err) {
        // Ex.: arquivo bloqueado ou mídia já removida manualmente entre a seleção e a exclusão.
        result.failed += 1;
        logger.warn(
          {
            companyId,
            messageId: c.id,
            err: err instanceof Error ? err.message : String(err)
          },
          "[StorageCleanup] item_failed"
        );
      }
    }
    result.stop =
      result.freedBytes >= bytesToFree ? "target_reached" : "no_more_eligible";
    result.unfreedBytes = Math.max(0, bytesToFree - result.freedBytes);

    if (!dryRun && result.removed > 0) {
      // Recálculo autoritário: corrige o consumo, registra snapshot e ajusta a marca d'água.
      const recalculated = await RecalculateCompanyStorageUsageService(
        companyId,
        { snapshotReason: "auto_cleanup" }
      );
      result.usedBytesAfter = recalculated.usedBytes;
    }
  });

  if (!dryRun && ["target_reached", "no_more_eligible"].includes(result.stop)) {
    // Auditoria por empresa (inclui o espaço que não pôde ser liberado).
    await createCompanyLog({
      companyId,
      action: "storage_cleanup",
      userId: null,
      metadata: {
        removed: result.removed,
        freedBytes: result.freedBytes,
        unfreedBytes: result.unfreedBytes,
        failed: result.failed,
        skippedShared: result.skippedShared,
        stop: result.stop,
        usedBytesAfter: result.usedBytesAfter ?? null
      }
    });
  }

  logger.info(
    { ...result, ...settings },
    dryRun ? "[StorageCleanup] dry_run" : "[StorageCleanup] executed"
  );
  return result;
};

export default CleanupCompanyStorageService;
