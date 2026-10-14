import Company from "../models/Company";

export interface CompanyFinanceFlags {
  /** Data de vencimento da assinatura/cobrança já passou (comparado ao início do dia). */
  overdue: boolean;
  /**
   * Inadimplência operacional: overdue além da tolerância (default 3 dias).
   * Alinhado a billingAuto_daysAfterDueBlock quando disponível via opts.
   */
  delinquent: boolean;
  dueDate: string | null;
  /** Dias após o vencimento quando em atraso; null se não aplicável. */
  daysPastDue: number | null;
}

export type FinanceFlagsOptions = {
  /** Dias de tolerância antes de considerar delinquent (default 3). */
  graceDays?: number;
};

/**
 * Política unificada: overdue = dueDate < hoje; delinquent = daysPastDue >= graceDays.
 */
export const getCompanyFinanceFlags = (
  company: Company,
  opts?: FinanceFlagsOptions
): CompanyFinanceFlags => {
  const graceDays =
    opts?.graceDays != null && Number.isFinite(opts.graceDays)
      ? Math.max(0, Number(opts.graceDays))
      : Number(process.env.SAAS_BILLING_GRACE_DAYS || 3);

  if (!company?.dueDate) {
    return {
      overdue: false,
      delinquent: false,
      dueDate: null,
      daysPastDue: null
    };
  }
  const due = new Date(company.dueDate);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const overdue = due < today;
  const diffMs = today.getTime() - due.getTime();
  const daysPastDue =
    overdue && diffMs > 0 ? Math.max(0, Math.floor(diffMs / 86400000)) : null;

  const delinquent =
    overdue && daysPastDue != null ? daysPastDue >= graceDays : false;

  return {
    overdue,
    delinquent,
    dueDate: company.dueDate,
    daysPastDue
  };
};
