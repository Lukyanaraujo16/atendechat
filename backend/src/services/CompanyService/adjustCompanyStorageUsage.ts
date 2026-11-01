/**
 * Ajuste incremental de `Companies.storageUsedBytes` (melhor esforço, não bloqueia fluxos principais).
 *
 * O recálculo manual e o job diário continuam a ser a correção autoritária: podem alinhar divergências
 * (réplicas sem delete explícito, substituição de ficheiro no mesmo caminho sem decremento, condições de corrida).
 * Se o mesmo path for gravado de novo sem passar por um fluxo que decrementou o anterior, pode haver dupla
 * contagem até ao próximo recálculo — aceite nesta fase.
 */
import fs from "fs";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { logger } from "../../utils/logger";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import User from "../../models/User";
import {
  computeStorageUsagePercent,
  getCompanyStorageLimitBytes,
  isStorageAutoCleanupEnabled
} from "../../helpers/companyStorage";
import CreateCompanyStorageSnapshotService from "./CreateCompanyStorageSnapshotService";
import CreateUserNotificationService from "../UserNotificationService/CreateUserNotificationService";

export function tryStatFileBytes(absolutePath: string): number {
  try {
    const st = fs.statSync(absolutePath);
    return st.isFile() ? st.size : 0;
  } catch {
    return 0;
  }
}

function storageThresholdLevel(percent: number | null): 0 | 80 | 90 | 100 {
  if (percent == null) return 0;
  if (percent >= 100) return 100;
  if (percent >= 90) return 90;
  if (percent >= 80) return 80;
  return 0;
}

function normalizeWatermark(v: unknown): 0 | 80 | 90 | 100 {
  const n = Number(v);
  if (n === 80 || n === 90 || n === 100) return n;
  return 0;
}

async function applyDeltaAtomic(companyId: number, delta: number): Promise<void> {
  const now = new Date();
  await sequelize.query(
    `UPDATE "Companies" SET
      "storageUsedBytes" = GREATEST(0, "storageUsedBytes" + :delta),
      "storageCalculatedAt" = :now,
      "updatedAt" = :now
     WHERE "id" = :id`,
    {
      replacements: {
        delta: Math.round(delta),
        now,
        id: companyId
      },
      type: QueryTypes.UPDATE
    }
  );
}

/** Pontos percentuais abaixo do nível para rearmar o aviso (evita repetição oscilando no limiar). */
const REARM_MARGIN_PERCENT = 5;

export const STORAGE_NOTIFICATION_BODIES: Record<80 | 90, string> = {
  80: "O armazenamento da sua empresa atingiu 80% da cota do plano. Acesse a Central de Mídias (Configurações › Gestão de mídias) e remova os arquivos desnecessários.",
  90: "Atenção: o armazenamento da sua empresa atingiu 90% da cota e poderá chegar ao limite em breve. Remova arquivos desnecessários na Central de Mídias ou consulte a ampliação do plano em Assinatura ou com o suporte."
};

/** Aviso de 100% conforme a limpeza automática real: nunca promete limpeza desligada. */
export function storageLimitExceededBody(): string {
  return isStorageAutoCleanupEnabled()
    ? "Seu armazenamento atingiu ou ultrapassou o limite contratado. Para liberar espaço, o sistema poderá remover automaticamente os arquivos elegíveis mais antigos, preservando os mais recentes. Acesse a Central de Mídias para gerenciar seus arquivos ou solicite a ampliação do armazenamento."
    : "Seu armazenamento atingiu ou ultrapassou o limite contratado. Acesse a Central de Mídias para revisar e excluir arquivos que não precisa mais. Você também pode solicitar a ampliação do armazenamento para continuar utilizando a plataforma com tranquilidade.";
}

async function notifyStorageThreshold(
  companyId: number,
  companyName: string,
  level: 80 | 90 | 100
): Promise<void> {
  const type =
    level === 100 ? "storage_limit_exceeded" : `storage_warning_${level}`;
  const body =
    level === 100
      ? storageLimitExceededBody()
      : STORAGE_NOTIFICATION_BODIES[level];

  const title = "Armazenamento";

  const admins = await User.findAll({
    where: { companyId, profile: "admin" },
    attributes: ["id"]
  });
  for (const u of admins) {
    await CreateUserNotificationService({
      userId: u.id,
      companyId,
      type,
      title,
      body,
      data: { companyId, storageThreshold: level }
    });
  }

  const supers = await User.findAll({
    where: { super: true },
    attributes: ["id"]
  });
  const superBody = companyName ? `${companyName}: ${body}` : body;
  for (const u of supers) {
    await CreateUserNotificationService({
      userId: u.id,
      companyId: null,
      type,
      title,
      body: superBody,
      data: { companyId, storageThreshold: level, scope: "platform" }
    });
  }
}

/** Após alteração incremental de bytes (não após recálculo completo — ver fluxo em RecalculateCompanyStorageUsageService). */
export async function evaluateCompanyStorageThresholds(
  companyId: number
): Promise<void> {
  const company = await Company.findByPk(companyId, {
    attributes: [
      "id",
      "name",
      "storageUsedBytes",
      "storageLimitGb",
      "storageAlertWatermark"
    ],
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
  const plan = row.plan as { storageLimitGb?: unknown } | undefined;
  const used = Number(row.storageUsedBytes ?? 0);
  const limitBytes = getCompanyStorageLimitBytes(
    { storageLimitGb: row.storageLimitGb },
    plan || null
  );
  const percent = computeStorageUsagePercent(used, limitBytes);
  const level = storageThresholdLevel(percent);
  let watermark = normalizeWatermark(row.storageAlertWatermark);

  if (limitBytes === null) {
    if (watermark !== 0) {
      await Company.update(
        { storageAlertWatermark: 0 },
        { where: { id: companyId } }
      );
    }
    return;
  }

  if (level > watermark) {
    // CAS: só quem eleva a marca d'água notifica (uploads concorrentes não duplicam o aviso).
    const raised = await sequelize.query(
      `UPDATE "Companies" SET "storageAlertWatermark" = :level WHERE "id" = :id AND "storageAlertWatermark" < :level RETURNING "id"`,
      { replacements: { level, id: companyId }, type: QueryTypes.SELECT }
    );
    if (raised.length === 0) return;
    await notifyStorageThreshold(
      companyId,
      String(row.name || ""),
      level as 80 | 90 | 100
    );
    const reason =
      level === 80
        ? "threshold_80"
        : level === 90
          ? "threshold_90"
          : "threshold_100";
    try {
      await CreateCompanyStorageSnapshotService({ companyId, reason });
    } catch (err) {
      logger.warn(
        {
          companyId,
          reason,
          err: err instanceof Error ? err.message : String(err)
        },
        "[CompanyStorage] threshold_snapshot_failed"
      );
    }
    logger.info({ companyId, level, percent }, "[CompanyStorage] threshold_crossed");
  } else {
    // Rearme com histerese: o nível só baixa quando o consumo cai REARM_MARGIN abaixo do limiar.
    const rearmLevel = storageThresholdLevel(
      percent == null ? null : percent + REARM_MARGIN_PERCENT
    );
    if (rearmLevel < watermark) {
      await Company.update(
        { storageAlertWatermark: rearmLevel },
        { where: { id: companyId } }
      );
    }
  }
}

export async function incrementCompanyStorageUsage(
  companyId: number,
  bytes: number
): Promise<void> {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    logger.warn({ companyId, bytes }, "[CompanyStorage] increment_invalid_company");
    return;
  }
  if (!Number.isFinite(bytes) || bytes < 0) {
    logger.warn({ companyId, bytes }, "[CompanyStorage] increment_invalid_bytes");
    return;
  }
  if (bytes === 0) return;
  try {
    await applyDeltaAtomic(companyId, bytes);
    logger.info({ companyId, bytes }, "[CompanyStorage] increment");
    await evaluateCompanyStorageThresholds(companyId);
  } catch (err) {
    logger.warn(
      { err, companyId, bytes },
      "[CompanyStorage] increment_failed"
    );
  }
}

export async function decrementCompanyStorageUsage(
  companyId: number,
  bytes: number
): Promise<void> {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    logger.warn({ companyId, bytes }, "[CompanyStorage] decrement_invalid_company");
    return;
  }
  if (!Number.isFinite(bytes) || bytes < 0) {
    logger.warn({ companyId, bytes }, "[CompanyStorage] decrement_invalid_bytes");
    return;
  }
  if (bytes === 0) return;
  try {
    await applyDeltaAtomic(companyId, -bytes);
    logger.info({ companyId, bytes }, "[CompanyStorage] decrement");
    await evaluateCompanyStorageThresholds(companyId);
  } catch (err) {
    logger.warn(
      { err, companyId, bytes },
      "[CompanyStorage] decrement_failed"
    );
  }
}

/** Atribuição directa (recálculo em disco). Não dispara avaliação de thresholds — o chamador deve fazê-lo. */
export async function setCompanyStorageUsage(
  companyId: number,
  bytes: number
): Promise<void> {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    logger.warn({ companyId, bytes }, "[CompanyStorage] set_invalid_company");
    return;
  }
  if (!Number.isFinite(bytes) || bytes < 0) {
    logger.warn({ companyId, bytes }, "[CompanyStorage] set_invalid_bytes");
    return;
  }
  const now = new Date();
  const rounded = Math.round(bytes);
  await Company.update(
    {
      storageUsedBytes: rounded,
      storageCalculatedAt: now
    },
    { where: { id: companyId } }
  );
  logger.info({ companyId, bytes: rounded }, "[CompanyStorage] set_usage");
}
