import * as Yup from "yup";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import User from "../../models/User";
import Plan from "../../models/Plan";
import CompanySignupRequest from "../../models/CompanySignupRequest";
import { emitPlatformSignupToSuperAdmins } from "../../libs/platformSignupRealtime";

export type PublicSignupBody = {
  companyName?: string;
  /** Legado: formulário antigo enviava `name` como nome da empresa */
  name?: string;
  adminName?: string;
  email?: string;
  phone?: string;
  planId?: number | string;
  recurrence?: string;
  dueDate?: string;
  campaignsEnabled?: boolean;
  notes?: string;
};

const bodySchema = Yup.object().shape({
  companyName: Yup.string().max(120).nullable(),
  name: Yup.string().max(120).nullable(),
  adminName: Yup.string().max(120).nullable(),
  email: Yup.string().email().required(),
  phone: Yup.string().max(30).nullable(),
  planId: Yup.mixed().nullable(),
  recurrence: Yup.string().max(32).nullable(),
  dueDate: Yup.string().nullable(),
  campaignsEnabled: Yup.boolean(),
  notes: Yup.string().max(2000).nullable()
});

function resolveCompanyName(body: PublicSignupBody): string {
  const a = String(body.companyName || "").trim();
  if (a.length >= 2) return a;
  const b = String(body.name || "").trim();
  return b;
}

function resolveAdminName(body: PublicSignupBody, companyName: string): string {
  const a = String(body.adminName || "").trim();
  if (a.length >= 2) return a;
  return companyName;
}

const CreatePublicSignupRequestService = async (
  raw: PublicSignupBody
): Promise<CompanySignupRequest> => {
  try {
    await bodySchema.validate(raw, { abortEarly: false });
  } catch (err: unknown) {
    const y = err as Yup.ValidationError;
    throw new AppError(y.errors?.[0] || "ERR_VALIDATION", 400);
  }

  const companyName = resolveCompanyName(raw);
  if (companyName.length < 2) {
    throw new AppError("ERR_SIGNUP_COMPANY_NAME_REQUIRED", 400);
  }

  const adminName = resolveAdminName(raw, companyName);
  const email = String(raw.email || "")
    .trim()
    .toLowerCase();

  const planIdRaw = raw.planId;
  const planId =
    planIdRaw === undefined || planIdRaw === null || planIdRaw === ""
      ? null
      : Number(planIdRaw);
  if (planId != null && (!Number.isFinite(planId) || planId < 1)) {
    throw new AppError("ERR_INVALID_PLAN", 400);
  }
  if (planId != null) {
    const plan = await Plan.findByPk(planId);
    if (!plan) {
      throw new AppError("ERR_INVALID_PLAN", 400);
    }
  }

  const duplicateCompany = await Company.findOne({
    where: { name: companyName }
  });
  if (duplicateCompany) {
    throw new AppError("ERR_COMPANY_NAME_ALREADY_EXISTS", 400);
  }

  const userExists = await User.findOne({ where: { email } });
  if (userExists) {
    throw new AppError("ERR_EMAIL_IN_USE", 400);
  }

  const pending = await CompanySignupRequest.findOne({
    where: { email, status: "pending" as const }
  });
  if (pending) {
    throw new AppError("ERR_SIGNUP_PENDING_EXISTS", 400);
  }

  const recurrence = raw.recurrence ? String(raw.recurrence).trim() : "MENSAL";
  const dueDate =
    raw.dueDate !== undefined && raw.dueDate !== null
      ? String(raw.dueDate).trim()
      : null;
  const campaignsEnabled = raw.campaignsEnabled !== false;
  const notes =
    raw.notes === undefined || raw.notes === null
      ? null
      : String(raw.notes).trim() || null;
  const phone =
    raw.phone === undefined || raw.phone === null
      ? null
      : String(raw.phone).trim() || null;

  const row = await CompanySignupRequest.create({
    companyName,
    adminName,
    email,
    phone,
    planId,
    recurrence,
    dueDate,
    campaignsEnabled,
    notes,
    status: "pending"
  });

  void emitPlatformSignupToSuperAdmins({
    action: "new_request",
    requestId: row.id,
    companyName: row.companyName
  });

  return row;
};

export default CreatePublicSignupRequestService;
