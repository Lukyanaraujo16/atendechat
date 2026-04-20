import moment from "moment-timezone";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";

/** Alinhado ao formulário de empresas (CompaniesManager). */
const MONTHS_BY_RECURRENCE: Record<string, number> = {
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12
};

/**
 * Renova vencimento: a partir do dueDate atual se ainda não venceu, senão a partir de hoje (fuso da empresa).
 */
const RenewCompanyDueDateService = async (
  id: string | number
): Promise<Company> => {
  const company = await Company.findByPk(id);
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const rec = String(company.recurrence || "").toUpperCase();
  const months = MONTHS_BY_RECURRENCE[rec];
  if (!months) {
    throw new AppError(
      "ERR_INVALID_RECURRENCE",
      400,
      "Defina a recorrência da empresa (MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL, etc.)."
    );
  }

  const tzRaw = company.timezone?.trim();
  const tz =
    tzRaw && moment.tz.zone(tzRaw) ? tzRaw : "America/Sao_Paulo";

  const now = moment.tz(tz).startOf("day");
  let base = now;

  if (company.dueDate) {
    const due = moment.tz(company.dueDate, tz).startOf("day");
    if (due.isValid() && due.isSameOrAfter(now)) {
      base = due;
    }
  }

  const newDue = base.clone().add(months, "months").format("YYYY-MM-DD");
  await company.update({ dueDate: newDue });
  await company.reload();
  return company;
};

export default RenewCompanyDueDateService;
