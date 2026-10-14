import { applySubscriptionRenewal } from "../SaasBilling/applySubscriptionRenewal";
import Company from "../../models/Company";

export type RenewCompanyDueDateResult = {
  company: Company;
  /** `true` se a empresa estava bloqueada e foi reativada nesta renovação. */
  autoUnblocked: boolean;
};

/**
 * Renovação administrativa (Super Admin) — usa motor único de renovação.
 * Não marca faturas como pagas e não conta como receita.
 */
const RenewCompanyDueDateService = async (
  id: string | number,
  userId?: number | string | null
): Promise<RenewCompanyDueDateResult> => {
  const result = await applySubscriptionRenewal({
    companyId: Number(id),
    reason: "manual_renew",
    actorUserId: userId != null && userId !== "" ? Number(userId) : null,
    idempotencyKey: null
  });

  return {
    company: result.company,
    autoUnblocked: result.autoUnblocked
  };
};

export default RenewCompanyDueDateService;
