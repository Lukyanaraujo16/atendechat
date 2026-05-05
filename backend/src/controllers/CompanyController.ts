import * as Yup from "yup";
import { Request, Response } from "express";
import { Op } from "sequelize";
// import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";
import Company from "../models/Company";
import Plan from "../models/Plan";
import authConfig from "../config/auth";

import ListCompaniesService from "../services/CompanyService/ListCompaniesService";
import CreateCompanyService from "../services/CompanyService/CreateCompanyService";
import CreatePublicSignupRequestService from "../services/CompanySignupRequest/CreatePublicSignupRequestService";
import UpdateCompanyService from "../services/CompanyService/UpdateCompanyService";
import ShowCompanyService from "../services/CompanyService/ShowCompanyService";
import UpdateSchedulesService from "../services/CompanyService/UpdateSchedulesService";
import UpdateCompanyTimezoneService from "../services/CompanyService/UpdateCompanyTimezoneService";
import DeleteCompanyService from "../services/CompanyService/DeleteCompanyService";
import FindAllCompaniesService from "../services/CompanyService/FindAllCompaniesService";
import { verify } from "jsonwebtoken";
import User from "../models/User";
import ShowPlanCompanyService from "../services/CompanyService/ShowPlanCompanyService";
import ListCompaniesPlanService from "../services/CompanyService/ListCompaniesPlanService";
import { buildEffectiveModuleFlagsFromFeatureMap } from "../services/CompanyService/GetEffectiveModuleFlagsService";
import {
  loadPersistedPlanFeatureMap,
  getEffectivePlanFeaturesMap,
  coerceModulePermissionsFromRow
} from "../services/PlanService/GetEffectivePlanFeaturesService";
import type { PersistedPlanFeatureMap } from "../services/PlanService/GetEffectivePlanFeaturesService";
import {
  getPlanIdFromContext,
  resolvePlanIdForQuery,
  logPlanFeaturesWarn,
  logPlanFeaturesInfo
} from "../services/PlanService/planIdResolve";
import RenewCompanyDueDateService from "../services/CompanyService/RenewCompanyDueDateService";
import CompanyLog from "../models/CompanyLog";
import { createCompanyLog } from "../services/CompanyService/CreateCompanyLogService";
import {
  normalizeNullableContractedPlanValue,
  normalizeNullableStorageLimitGb
} from "../utils/normalizeMonetaryInput";
import { logger } from "../utils/logger";
import { buildCompanyStorageEnrichmentPayload } from "../helpers/companyStorage";
import RecalculateCompanyStorageUsageService from "../services/CompanyService/RecalculateCompanyStorageUsageService";
import GetMyCompanyStorageService from "../services/CompanyService/GetMyCompanyStorageService";
import ListCompanyStorageSnapshotsService from "../services/CompanyService/ListCompanyStorageSnapshotsService";
import BootstrapCrmForCompanyService from "../services/CrmService/BootstrapCrmForCompanyService";
import {
  normalizeCrmVisibilityMode
} from "../services/CrmService/crmDealVisibility";
import {
  isValidBusinessSegment,
  normalizeBusinessSegment
} from "../config/businessSegment";

function parseListPlanAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  if (authHeader.startsWith("Bearer ")) {
    const t = authHeader.slice(7).trim();
    return t || null;
  }
  const parts = authHeader.split(" ");
  return parts.length > 1 && parts[1] ? parts[1] : null;
}

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

type UpdateCompanyBody = {
  name?: string;
  id?: number;
  phone?: string;
  email?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
  password?: string;
  modulePermissions?: Record<string, boolean> | null;
  timezone?: string;
  internalNotes?: string | null;
  contractedPlanValue?: unknown;
  storageLimitGb?: unknown;
  businessSegment?: string | null;
  crmVisibilityMode?: string | null;
};

type CreateCompanyRequest = UpdateCompanyBody & { name: string };

type SchedulesData = {
  schedules: [];
};

/** Primeiro utilizador com perfil `admin` da empresa (menor id), igual à listagem paginada. */
async function buildPrimaryAdminMap(
  companyIds: number[]
): Promise<Record<number, { id: number; name: string; email: string }>> {
  const primaryByCompany: Record<number, { id: number; name: string; email: string }> =
    {};
  if (!companyIds.length) return primaryByCompany;

  const admins = await User.findAll({
    where: {
      companyId: { [Op.in]: companyIds },
      profile: "admin"
    },
    attributes: ["id", "name", "email", "companyId"],
    order: [["id", "ASC"]]
  });
  for (const u of admins) {
    const cid = u.companyId;
    if (primaryByCompany[cid] === undefined) {
      primaryByCompany[cid] = {
        id: u.id,
        name: u.name,
        email: u.email
      };
    }
  }
  return primaryByCompany;
}

/** Compara valores monetários (2 casas) para auditoria do valor contratado. */
function snapshotNullableMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isNaN(n) ? null : n;
}

function contractedPlanSnapshotChanged(
  prev: unknown,
  next: number | null
): boolean {
  const a = snapshotNullableMoney(prev);
  if (a === null && next === null) return false;
  if (a === null || next === null) return true;
  return Math.round(a * 100) !== Math.round(next * 100);
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { companies, count, hasMore } = await ListCompaniesService({
    searchParam,
    pageNumber
  });

  const ids = companies.map((c) => c.id);
  const primaryByCompany = await buildPrimaryAdminMap(ids);

  const enriched = companies.map((c) => {
    const row = typeof (c as any).toJSON === "function" ? (c as any).toJSON() : c;
    const plan = row.plan as { storageLimitGb?: unknown } | undefined;
    return {
      ...row,
      primaryAdmin: primaryByCompany[row.id] ?? null,
      ...buildCompanyStorageEnrichmentPayload(row as Record<string, unknown>, plan || null)
    };
  });

  return res.json({ companies: enriched, count, hasMore });
};

/**
 * Cadastro público: cria pedido pendente (aprovação por Super Admin). Não cria empresa nem utilizador.
 */
export const createSignupRequest = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const row = await CreatePublicSignupRequestService(req.body);
  return res.status(201).json(row);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newCompany = req.body as CreateCompanyRequest;

  const schema = Yup.object().shape({
    name: Yup.string().required()
  });

  try {
    await schema.validate(newCompany);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const requestUserForStore =
    req.user?.id != null
      ? await User.findByPk(req.user.id, { attributes: ["super"] })
      : null;
  const payload: CreateCompanyRequest = { ...newCompany };
  if (!requestUserForStore?.super) {
    delete payload.internalNotes;
    delete (payload as Record<string, unknown>).contractedPlanValue;
  }

  let contractedOnCreate: number | null | undefined;
  if (requestUserForStore?.super) {
    if (Object.prototype.hasOwnProperty.call(newCompany as object, "contractedPlanValue")) {
      contractedOnCreate = normalizeNullableContractedPlanValue(newCompany.contractedPlanValue);
    }
    delete (payload as Record<string, unknown>).contractedPlanValue;
  }

  const result = await CreateCompanyService(
    {
      ...payload,
      ...(requestUserForStore?.super && contractedOnCreate !== undefined
        ? { contractedPlanValue: contractedOnCreate }
        : {})
    } as Parameters<typeof CreateCompanyService>[0]
  );

  const { company } = result;

  if (
    contractedOnCreate !== undefined &&
    contractedPlanSnapshotChanged(null, contractedOnCreate)
  ) {
    const planPid = resolvePlanIdForQuery(company.planId);
    const planRow =
      planPid != null
        ? await Plan.findByPk(planPid, { attributes: ["value"] })
        : null;
    await createCompanyLog({
      companyId: company.id,
      action: "contracted_value_change",
      userId: req.user?.id ?? null,
      metadata: {
        previousValue: null,
        newValue: contractedOnCreate,
        planValue: Number(planRow?.value ?? 0)
      }
    });
  }

  const companyJson =
    typeof company.toJSON === "function"
      ? company.toJSON()
      : { ...(company as object) };

  const setup = result.primaryAdmin;
  const primaryAdminSetup = setup
    ? {
        ...setup,
        temporaryPassword:
          setup.inviteEmailSent === true ? undefined : setup.temporaryPassword
      }
    : undefined;

  return res.status(200).json({
    ...companyJson,
    ...(primaryAdminSetup ? { primaryAdminSetup } : {})
  });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const companyId = Number(id);

  if (companyId !== req.user.companyId) {
    const requestUser = await User.findByPk(req.user.id, { attributes: ["super"] });
    if (!requestUser?.super) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  const company = await ShowCompanyService(id);
  const requestUser = await User.findByPk(req.user.id, { attributes: ["super"] });
  const row =
    typeof (company as any).toJSON === "function"
      ? (company as any).toJSON()
      : { ...(company as any) };
  if (!requestUser?.super) {
    delete row.internalNotes;
    delete row.contractedPlanValue;
  }

  const planRow = row.planId
    ? await Plan.findByPk(row.planId, { attributes: ["storageLimitGb"] })
    : null;
  const planJson = planRow?.toJSON() as { storageLimitGb?: unknown } | null;
  return res.status(200).json({
    ...row,
    ...buildCompanyStorageEnrichmentPayload(row as Record<string, unknown>, planJson)
  });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const companiesRaw: Company[] = await FindAllCompaniesService();
  const companies = companiesRaw.map((c) =>
    typeof (c as any).toJSON === "function" ? (c as any).toJSON() : c
  );
  const ids = companies.map((row: any) => row.id as number);
  const primaryByCompany = await buildPrimaryAdminMap(ids);

  const enriched = companies.map((row: any) => {
    const plan = row.plan as { storageLimitGb?: unknown } | undefined;
    return {
      ...row,
      primaryAdmin: primaryByCompany[row.id] ?? null,
      ...buildCompanyStorageEnrichmentPayload(row as Record<string, unknown>, plan || null)
    };
  });

  return res.status(200).json(enriched);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyDataRaw: UpdateCompanyBody = req.body;

  const schema = Yup.object({
    name: Yup.string().nullable(),
    phone: Yup.string().nullable(),
    email: Yup.string().nullable(),
    status: Yup.boolean().nullable(),
    planId: Yup.number().nullable(),
    dueDate: Yup.string().nullable(),
    recurrence: Yup.string().nullable(),
    internalNotes: Yup.string().nullable().max(65535),
    contractedPlanValue: Yup.mixed().nullable(),
    storageLimitGb: Yup.mixed().nullable(),
    businessSegment: Yup.string()
      .nullable()
      .test(
        "seg",
        "Segmento inválido",
        (v) =>
          v == null ||
          v === "" ||
          isValidBusinessSegment(String(v))
      ),
    crmVisibilityMode: Yup.string().nullable().oneOf(["all", "assigned"])
  });

  try {
    await schema.validate(companyDataRaw, { abortEarly: false });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;
  const companyId = Number(id);

  if (companyDataRaw.status === false) {
    const me = await User.findByPk(req.user.id, { attributes: ["companyId"] });
    if (me?.companyId === companyId) {
      throw new AppError(
        "ERR_CANNOT_BLOCK_OWN_COMPANY",
        403,
        "Não é possível bloquear a empresa à qual a sua conta pertence."
      );
    }
  }

  const requestUserUpdate =
    req.user?.id != null
      ? await User.findByPk(req.user.id, { attributes: ["super"] })
      : null;

  const stripped: Record<string, unknown> = { ...companyDataRaw };
  if (!requestUserUpdate?.super) {
    delete stripped.contractedPlanValue;
    delete stripped.storageLimitGb;
  }

  let contractedNormalized: number | null | undefined;
  if (
    requestUserUpdate?.super &&
    Object.prototype.hasOwnProperty.call(req.body as object, "contractedPlanValue")
  ) {
    contractedNormalized = normalizeNullableContractedPlanValue(
      companyDataRaw.contractedPlanValue
    );
    delete stripped.contractedPlanValue;
  }

  let storageLimitNormalized: number | null | undefined;
  if (
    requestUserUpdate?.super &&
    Object.prototype.hasOwnProperty.call(req.body as object, "storageLimitGb")
  ) {
    storageLimitNormalized = normalizeNullableStorageLimitGb(
      (companyDataRaw as { storageLimitGb?: unknown }).storageLimitGb
    );
    delete stripped.storageLimitGb;
  }

  let businessSegmentNormalized: string | undefined;
  if (
    Object.prototype.hasOwnProperty.call(companyDataRaw as object, "businessSegment")
  ) {
    businessSegmentNormalized = normalizeBusinessSegment(
      companyDataRaw.businessSegment as string | null | undefined
    );
    delete stripped.businessSegment;
  }

  let crmVisibilityModeNormalized: ReturnType<typeof normalizeCrmVisibilityMode> | undefined;
  if (
    Object.prototype.hasOwnProperty.call(companyDataRaw as object, "crmVisibilityMode")
  ) {
    crmVisibilityModeNormalized = normalizeCrmVisibilityMode(
      companyDataRaw.crmVisibilityMode
    );
    delete stripped.crmVisibilityMode;
  }

  const pre = await Company.findByPk(companyId, {
    attributes: ["id", "status", "contractedPlanValue", "planId"],
    include: [
      { model: Plan, as: "plan", attributes: ["value"], required: false }
    ]
  });

  const company = await UpdateCompanyService({
    id,
    ...(stripped as UpdateCompanyBody),
    ...(contractedNormalized !== undefined
      ? { contractedPlanValue: contractedNormalized }
      : {}),
    ...(storageLimitNormalized !== undefined
      ? { storageLimitGb: storageLimitNormalized }
      : {}),
    ...(businessSegmentNormalized !== undefined
      ? { businessSegment: businessSegmentNormalized }
      : {}),
    ...(crmVisibilityModeNormalized !== undefined
      ? { crmVisibilityMode: crmVisibilityModeNormalized }
      : {})
  } as Parameters<typeof UpdateCompanyService>[0]);

  if (
    requestUserUpdate?.super &&
    Object.prototype.hasOwnProperty.call(req.body as object, "planId") &&
    pre
  ) {
    const rawIncoming = companyDataRaw.planId as unknown;
    const nextPlanNum =
      rawIncoming === null || rawIncoming === "" ? null : Number(rawIncoming);
    const prevPlanNum =
      pre.planId === null || pre.planId === undefined ? null : Number(pre.planId);
    const comparableNext =
      nextPlanNum !== null && !Number.isNaN(nextPlanNum) ? nextPlanNum : null;
    const comparablePrev =
      prevPlanNum !== null && !Number.isNaN(prevPlanNum) ? prevPlanNum : null;
    if (comparableNext !== comparablePrev) {
      await createCompanyLog({
        companyId,
        action: "plan_change",
        userId: req.user.id,
        metadata: {
          previousPlanId: comparablePrev,
          newPlanId: comparableNext
        }
      });
    }
  }

  if (
    companyDataRaw.status !== undefined &&
    pre &&
    Boolean(pre.status) !== Boolean(companyDataRaw.status)
  ) {
    await createCompanyLog({
      companyId,
      action: companyDataRaw.status === false ? "block" : "unblock",
      userId: req.user.id,
      metadata: { previousStatus: pre.status, newStatus: companyDataRaw.status }
    });
  }

  if (
    requestUserUpdate?.super &&
    contractedNormalized !== undefined &&
    pre &&
    contractedPlanSnapshotChanged(pre.contractedPlanValue, contractedNormalized)
  ) {
    await createCompanyLog({
      companyId,
      action: "contracted_value_change",
      userId: req.user.id,
      metadata: {
        previousValue: snapshotNullableMoney(pre.contractedPlanValue),
        newValue: contractedNormalized,
        planValue: Number(pre.plan?.value ?? 0)
      }
    });
  }

  await company.reload({
    include: [
      {
        model: Plan,
        as: "plan",
        attributes: ["id", "name", "value", "storageLimitGb"],
        required: false
      }
    ]
  });
  const outRow =
    typeof company.toJSON === "function"
      ? (company.toJSON() as Record<string, unknown>)
      : (company as unknown as Record<string, unknown>);
  const planOut = outRow.plan as { storageLimitGb?: unknown } | undefined;
  return res.status(200).json({
    ...outRow,
    ...buildCompanyStorageEnrichmentPayload(outRow, planOut || null)
  });
};

export const bootstrapCrm = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.id);
  if (!Number.isFinite(companyId)) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400);
  }
  const requestUser = await User.findByPk(req.user.id, { attributes: ["super"] });
  if (!requestUser?.super) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const result = await BootstrapCrmForCompanyService(companyId);
  return res.status(200).json(result);
};

export const getMyCompanyStorage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user?.companyId);
  if (!Number.isFinite(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const payload = await GetMyCompanyStorageService(companyId);
  return res.status(200).json(payload);
};

export const recalculateMyCompanyStorage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user?.companyId);
  if (!Number.isFinite(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  await RecalculateCompanyStorageUsageService(companyId, {
    snapshotReason: "manual_recalculate"
  });
  const payload = await GetMyCompanyStorageService(companyId);
  return res.status(200).json({ ...payload, recalculated: true });
};

export const recalculateCompanyStorage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.id);
  if (!Number.isFinite(companyId)) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400);
  }
  await RecalculateCompanyStorageUsageService(companyId, {
    snapshotReason: "manual_recalculate"
  });
  const company = await Company.findByPk(companyId, {
    include: [
      {
        model: Plan,
        as: "plan",
        attributes: ["id", "name", "storageLimitGb"],
        required: false
      }
    ]
  });
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }
  const row =
    typeof company.toJSON === "function"
      ? (company.toJSON() as Record<string, unknown>)
      : (company as unknown as Record<string, unknown>);
  const plan = row.plan as { storageLimitGb?: unknown } | undefined;
  return res.status(200).json({
    ...buildCompanyStorageEnrichmentPayload(row, plan || null),
    recalculated: true
  });
};

export const getCompanyStorageSnapshots = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.id);
  if (!Number.isFinite(companyId)) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400);
  }
  const rows = await ListCompanyStorageSnapshotsService(companyId, 30);
  return res.status(200).json(rows);
};

export const getMyCompanyStorageSnapshots = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = req.user.companyId;
  if (!Number.isFinite(Number(companyId))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const rows = await ListCompanyStorageSnapshotsService(Number(companyId), 30);
  return res.status(200).json(rows);
};

export const updateCrmVisibility = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.id);
  if (!Number.isFinite(companyId)) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400);
  }

  const schema = Yup.object({
    crmVisibilityMode: Yup.string().oneOf(["all", "assigned"]).required()
  });
  const { crmVisibilityMode } = await schema.validate(req.body, {
    abortEarly: false
  });

  const isOwnCompany = Number(companyId) === Number(req.user.companyId);
  if (!isOwnCompany) {
    const requestUser = await User.findByPk(req.user.id, { attributes: ["super"] });
    if (!requestUser?.super && req.user.supportMode !== true) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  } else if (req.user.profile !== "admin" && req.user.supportMode !== true) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const company = await Company.findByPk(companyId);
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  await company.update({
    crmVisibilityMode: normalizeCrmVisibilityMode(crmVisibilityMode)
  });
  await company.reload({
    include: [
      { model: Plan, as: "plan", attributes: ["id", "name"], required: false }
    ]
  });
  const row =
    typeof company.toJSON === "function"
      ? company.toJSON()
      : (company as unknown as Record<string, unknown>);
  return res.status(200).json(row);
};

export const updateTimezone = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { timezone } = req.body as { timezone?: string };
  const companyId = Number(id);

  if (companyId !== req.user.companyId) {
    const requestUser = await User.findByPk(req.user.id, { attributes: ["super"] });
    if (!requestUser?.super) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  if (timezone === undefined || typeof timezone !== "string") {
    throw new AppError("Informe o fuso horário", 400);
  }

  const company = await UpdateCompanyTimezoneService(id, timezone);

  return res.status(200).json(company);
};

export const updateSchedules = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { schedules }: SchedulesData = req.body;
  const { id } = req.params;
  const companyId = Number(id);

  if (companyId !== req.user.companyId) {
    const requestUser = await User.findByPk(req.user.id, { attributes: ["super"] });
    if (!requestUser?.super) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }
  }

  const company = await UpdateSchedulesService({
    id,
    schedules
  });

  return res.status(200).json(company);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const companyId = Number(id);

  const me = await User.findByPk(req.user.id, { attributes: ["companyId"] });
  if (me?.companyId === companyId) {
    throw new AppError(
      "ERR_CANNOT_DELETE_OWN_COMPANY",
      403,
      "Não é possível excluir a empresa à qual a sua conta pertence."
    );
  }

  const superInCompany = await User.findOne({
    where: { companyId, super: true }
  });
  if (superInCompany) {
    throw new AppError(
      "ERR_CANNOT_DELETE_COMPANY_WITH_SUPER",
      400,
      "Não é possível excluir uma empresa que contenha super administradores. Remova ou transfira esses utilizadores primeiro."
    );
  }

  await DeleteCompanyService(id, req.user.id);

  return res.status(200).json({ ok: true });
};

export const renewDueDate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { company, autoUnblocked } = await RenewCompanyDueDateService(
    id,
    req.user.id
  );
  const row =
    typeof (company as any).toJSON === "function"
      ? (company as any).toJSON()
      : { ...(company as any) };
  return res.status(200).json({ ...row, autoUnblocked });
};

export const listCompanyLogs = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.params.id);
  if (Number.isNaN(companyId)) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }
  const exists = await Company.findByPk(companyId, { attributes: ["id"] });
  if (!exists) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const logs = await CompanyLog.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]],
    limit: 500,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "email"],
        required: false
      }
    ]
  });

  return res.status(200).json(logs);
};

export const listPlan = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  try {
    const token = parseListPlanAuthToken(req);
    if (!token) {
      return res.status(401).json({ error: "Token não informado" });
    }

    const decoded = verify(token, authConfig.secret) as TokenPayload;
    const { id: requestUserId, companyId: tokenCompanyId } = decoded;
    const requestUser = await User.findByPk(requestUserId);

    const company = await ShowPlanCompanyService(id);
    if (!company) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const j = company.toJSON() as Record<string, unknown> & {
      plan?: unknown;
      modulePermissions?: Record<string, boolean>;
    };
    const modulePermissions = coerceModulePermissionsFromRow(j.modulePermissions);
    const plan = j.plan as Plan | Record<string, unknown> | null | undefined;
    const resolvedPlanId = getPlanIdFromContext(company) ?? getPlanIdFromContext(j);

    const modulePermissionsFalseKeys = modulePermissions
      ? Object.entries(modulePermissions)
          .filter(([, v]) => v === false)
          .map(([k]) => k)
      : [];

    let persisted: PersistedPlanFeatureMap;
    let effectiveFeatures: Record<string, boolean>;
    let effectiveModules: ReturnType<typeof buildEffectiveModuleFlagsFromFeatureMap>;
    try {
      persisted = await loadPersistedPlanFeatureMap(resolvedPlanId);
      effectiveFeatures = getEffectivePlanFeaturesMap(
        plan ?? null,
        persisted,
        modulePermissions
      );
      effectiveModules = buildEffectiveModuleFlagsFromFeatureMap(
        effectiveFeatures,
        modulePermissions
      );
    } catch (planFeatErr: unknown) {
      logPlanFeaturesWarn("listPlan: fallback after plan/features computation error", {
        err: planFeatErr instanceof Error ? planFeatErr.message : String(planFeatErr),
        companyIdParam: String(id),
        resolvedPlanId
      });
      persisted = {};
      effectiveFeatures = getEffectivePlanFeaturesMap(
        plan ?? null,
        {},
        modulePermissions
      );
      effectiveModules = buildEffectiveModuleFlagsFromFeatureMap(
        effectiveFeatures,
        modulePermissions
      );
    }

    logPlanFeaturesInfo("listPlan computed effective map", {
      companyIdParam: String(id),
      companyPlanIdRaw: j.planId,
      planNestedId:
        plan && typeof plan === "object" ? (plan as Record<string, unknown>).id : undefined,
      resolvedPlanId,
      planFeaturesCount: Object.keys(persisted).length,
      effectiveFeaturesTrueCount: Object.values(effectiveFeatures).filter((v) => v === true).length,
      modulePermissionsFalseKeys,
      hasPlan: Boolean(plan)
    });

    if (requestUser?.super === true) {
      return res.status(200).json({
        ...j,
        effectiveModules,
        effectiveFeatures
      });
    }

    const tenantId =
      tokenCompanyId != null && !Number.isNaN(Number(tokenCompanyId))
        ? String(tokenCompanyId)
        : "";
    if (tenantId !== String(id)) {
      return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
    }

    delete j.contractedPlanValue;
    return res.status(200).json({ ...j, effectiveModules, effectiveFeatures });
  } catch (err: unknown) {
    logger.error(
      {
        err,
        companyIdParam: id,
        message: err instanceof Error ? err.message : String(err)
      },
      "CompanyController.listPlan failed"
    );
    return res.status(500).json({
      error: "Não foi possível carregar o plano da empresa",
      code: "LIST_PLAN_FAILED"
    });
  }
};

export const indexPlan = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id, profile, companyId } = decoded as TokenPayload;
  // const company = await Company.findByPk(companyId);
  const requestUser = await User.findByPk(id);

  if (requestUser.super === true) {
    const companies = await ListCompaniesPlanService();
    return res.json({ companies });
  } else {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  }

};