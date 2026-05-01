import { logger } from "../utils/logger";
import Company from "../models/Company";
import RecalculateCompanyStorageUsageService from "../services/CompanyService/RecalculateCompanyStorageUsageService";

let storageRecalcRunning = false;

/** Recalcula uso de armazenamento para todas as empresas ativas (não bloqueia envio de mídia). */
export async function runCompanyStorageRecalcJob(): Promise<void> {
  if (storageRecalcRunning) return;
  storageRecalcRunning = true;
  try {
    const rows = await Company.findAll({
      where: { status: true },
      attributes: ["id"]
    });
    logger.info(
      `[StorageRecalc] Início: ${rows.length} empresa(s) ativa(s) a processar`
    );
    for (const r of rows) {
      try {
        await RecalculateCompanyStorageUsageService(r.id, {
          snapshotReason: "scheduled_recalculate"
        });
      } catch (e) {
        logger.error(
          `[StorageRecalc] Empresa ${r.id}: ${e instanceof Error ? e.message : e}`
        );
      }
    }
    logger.info("[StorageRecalc] Concluído");
  } finally {
    storageRecalcRunning = false;
  }
}
