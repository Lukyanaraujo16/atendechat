import AppError from "../../errors/AppError";
import { applySubscriptionRenewal } from "../SaasBilling/applySubscriptionRenewal";
import SaaSSubscriptionRenewal from "../../models/SaaSSubscriptionRenewal";
import Company from "../../models/Company";

export type RenewCompanyDueDateResult = {
  company: Company;
  /** `true` se a empresa estava bloqueada e foi reativada nesta renovação. */
  autoUnblocked: boolean;
  renewal: SaaSSubscriptionRenewal | null;
};

export type RenewCompanyDueDateOptions = {
  /** Justificativa obrigatória (auditoria). */
  reason?: string | null;
  /**
   * Vencimento exibido ao administrador (YYYY-MM-DD ou null). Protege contra clique duplo
   * e renovações concorrentes: se o vencimento mudou, a operação é recusada (409).
   * `undefined` (cliente antigo) ativa a janela anti-duplicidade por tempo.
   */
  expectedCurrentDueDate?: string | null;
};

/**
 * Renovação administrativa (Super Admin) — usa motor único de renovação.
 * Não marca faturas como pagas e não conta como receita.
 */
const RenewCompanyDueDateService = async (
  id: string | number,
  userId?: number | string | null,
  options: RenewCompanyDueDateOptions = {}
): Promise<RenewCompanyDueDateResult> => {
  const note = String(options.reason ?? "").trim();
  if (note.length < 3) {
    throw new AppError(
      "ERR_RENEWAL_REASON_REQUIRED",
      400,
      "Informe a justificativa da renovação (mínimo de 3 caracteres)."
    );
  }

  const result = await applySubscriptionRenewal({
    companyId: Number(id),
    reason: "manual_renew",
    actorUserId: userId != null && userId !== "" ? Number(userId) : null,
    idempotencyKey: null,
    expectedCurrentDueDate: options.expectedCurrentDueDate,
    note
  });

  return {
    company: result.company,
    autoUnblocked: result.autoUnblocked,
    renewal: result.renewal
  };
};

export default RenewCompanyDueDateService;
