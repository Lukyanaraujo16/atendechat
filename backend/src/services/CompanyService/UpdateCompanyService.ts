import moment from "moment-timezone";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Setting from "../../models/Setting";

interface CompanyData {
  name?: string;
  id?: number | string;
  phone?: string;
  email?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
  timezone?: string;
  /** Overrides de módulos (apenas Super Admin via API de empresas) */
  modulePermissions?: Record<string, boolean> | null;
}

const UpdateCompanyService = async (
  companyData: CompanyData
): Promise<Company> => {
  const company = await Company.findByPk(companyData.id);
  const {
    name,
    phone,
    email,
    status,
    planId,
    campaignsEnabled,
    dueDate,
    recurrence,
    timezone,
    modulePermissions
  } = companyData;

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  if (timezone !== undefined) {
    const tz = String(timezone).trim();
    if (!tz || !moment.tz.zone(tz)) {
      throw new AppError("Fuso horário inválido", 400);
    }
  }

  const payload: Record<string, unknown> = {};
  if (name !== undefined) payload.name = name;
  if (phone !== undefined) payload.phone = phone;
  if (email !== undefined) payload.email = email;
  if (status !== undefined) payload.status = status;
  if (planId !== undefined) payload.planId = planId;
  if (dueDate !== undefined) payload.dueDate = dueDate;
  if (recurrence !== undefined) payload.recurrence = recurrence;
  if (timezone !== undefined) {
    payload.timezone = String(timezone).trim();
  }
  if (modulePermissions !== undefined) {
    payload.modulePermissions =
      modulePermissions && typeof modulePermissions === "object"
        ? modulePermissions
        : {};
  }

  if (Object.keys(payload).length > 0) {
    await company.update(payload);
  }

  if (companyData.campaignsEnabled !== undefined) {
    const [setting, created] = await Setting.findOrCreate({
      where: {
        companyId: company.id,
        key: "campaignsEnabled"
      },
      defaults: {
        companyId: company.id,
        key: "campaignsEnabled",
        value: `${campaignsEnabled}`
      }
    });
    if (!created) {
      await setting.update({ value: `${campaignsEnabled}` });
    }
  }

  return company;
};

export default UpdateCompanyService;
