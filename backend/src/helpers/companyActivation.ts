import { Op } from "sequelize";
import Company from "../models/Company";
import CompanyLog from "../models/CompanyLog";
import { BLOCK_LOG_ACTIONS } from "../services/SaasBilling/billingEvaluation";
import { logger } from "../utils/logger";

/**
 * Desativação administrativa = `Companies.status = false` cujo último registro de bloqueio
 * NÃO é o bloqueio financeiro automático (`auto_block`), que mantém o acesso para regularizar
 * o pagamento. Mesmo modelo do Super Admin (Bloquear/Desbloquear + CompanyLogs).
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map<number, { value: boolean; at: number }>();

export function invalidateCompanyActivationCache(companyId?: number): void {
  if (companyId === undefined) cache.clear();
  else cache.delete(Number(companyId));
}

export async function isCompanyDeactivated(
  companyId: number | null | undefined
): Promise<boolean> {
  const id = Number(companyId);
  if (!Number.isInteger(id) || id <= 0) return false;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  let value = false;
  try {
    const company = await Company.findByPk(id, {
      attributes: ["id", "status"]
    });
    if (company && company.status === false) {
      const last = await CompanyLog.findOne({
        where: { companyId: id, action: { [Op.in]: [...BLOCK_LOG_ACTIONS] } },
        attributes: ["action"],
        order: [
          ["createdAt", "DESC"],
          ["id", "DESC"]
        ]
      });
      value = last?.action !== "auto_block";
    }
  } catch (err) {
    // Falha na consulta não derruba atendimento/envios (fail-open); login e refresh já
    // dependem do banco e validam de novo na próxima tentativa.
    logger.warn(
      { companyId: id, err: err instanceof Error ? err.message : String(err) },
      "[CompanyActivation] status indisponível"
    );
    return false;
  }
  cache.set(id, { value, at: Date.now() });
  return value;
}

export const COMPANY_INACTIVE_MESSAGE =
  "A empresa está desativada. Entre em contato com o suporte da plataforma.";
