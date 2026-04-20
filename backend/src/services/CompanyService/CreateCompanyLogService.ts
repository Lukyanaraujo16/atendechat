import CompanyLog from "../../models/CompanyLog";
import { logger } from "../../utils/logger";

export type CompanyLogAction =
  | "renew"
  | "block"
  | "unblock"
  | "delete"
  | "warning_before_due"
  | "warning_after_due"
  | "auto_block"
  | "auto_unblock_after_renew";

export interface CreateCompanyLogParams {
  companyId: number;
  action: CompanyLogAction | string;
  userId: number | string | null | undefined;
  metadata?: Record<string, unknown> | null;
}

/**
 * Registo de auditoria; falhas não interrompem o fluxo principal.
 * Devolve o id quando criado (útil para enriquecer metadata depois, ex.: WhatsApp).
 */
const CreateCompanyLogService = async (
  params: CreateCompanyLogParams
): Promise<number | null> => {
  try {
    const rawUid = params.userId;
    const uid =
      rawUid === null || rawUid === undefined
        ? null
        : typeof rawUid === "number"
          ? rawUid
          : Number(rawUid);
    const row = await CompanyLog.create({
      companyId: params.companyId,
      action: String(params.action),
      userId: uid != null && !Number.isNaN(uid) ? uid : null,
      metadata: params.metadata ?? null
    });
    return row.id;
  } catch (err) {
    logger.warn({ err, params }, "CreateCompanyLogService failed (non-blocking)");
    return null;
  }
};

export const createCompanyLog = CreateCompanyLogService;

export default CreateCompanyLogService;
