import * as Yup from "yup";
import { Request, Response } from "express";
import { Op } from "sequelize";
// import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";
import Company from "../models/Company";
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
import GetEffectiveModuleFlags from "../services/CompanyService/GetEffectiveModuleFlagsService";
import RenewCompanyDueDateService from "../services/CompanyService/RenewCompanyDueDateService";
import CompanyLog from "../models/CompanyLog";
import { createCompanyLog } from "../services/CompanyService/CreateCompanyLogService";

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
    return {
      ...row,
      primaryAdmin: primaryByCompany[row.id] ?? null
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
  }

  const { company } = await CreateCompanyService(payload);

  return res.status(200).json(company);
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
  }

  return res.status(200).json(row);
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const companiesRaw: Company[] = await FindAllCompaniesService();
  const companies = companiesRaw.map((c) =>
    typeof (c as any).toJSON === "function" ? (c as any).toJSON() : c
  );
  const ids = companies.map((row: any) => row.id as number);
  const primaryByCompany = await buildPrimaryAdminMap(ids);

  const enriched = companies.map((row: any) => ({
    ...row,
    primaryAdmin: primaryByCompany[row.id] ?? null
  }));

  return res.status(200).json(enriched);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyData: UpdateCompanyBody = req.body;

  const schema = Yup.object({
    name: Yup.string().nullable(),
    phone: Yup.string().nullable(),
    email: Yup.string().nullable(),
    status: Yup.boolean().nullable(),
    planId: Yup.number().nullable(),
    dueDate: Yup.string().nullable(),
    recurrence: Yup.string().nullable(),
    internalNotes: Yup.string().nullable().max(65535)
  });

  try {
    await schema.validate(companyData, { abortEarly: false });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;
  const companyId = Number(id);

  if (companyData.status === false) {
    const me = await User.findByPk(req.user.id, { attributes: ["companyId"] });
    if (me?.companyId === companyId) {
      throw new AppError(
        "ERR_CANNOT_BLOCK_OWN_COMPANY",
        403,
        "Não é possível bloquear a empresa à qual a sua conta pertence."
      );
    }
  }

  const pre = await Company.findByPk(companyId, { attributes: ["id", "status"] });

  const company = await UpdateCompanyService({ id, ...companyData });

  if (
    companyData.status !== undefined &&
    pre &&
    Boolean(pre.status) !== Boolean(companyData.status)
  ) {
    await createCompanyLog({
      companyId,
      action: companyData.status === false ? "block" : "unblock",
      userId: req.user.id,
      metadata: { previousStatus: pre.status, newStatus: companyData.status }
    });
  }

  return res.status(200).json(company);
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

  const authHeader = req.headers.authorization;
  const [, token] = authHeader.split(" ");
  const decoded = verify(token, authConfig.secret);
  const { id: requestUserId, profile, companyId } = decoded as TokenPayload;
  const requestUser = await User.findByPk(requestUserId);

  const company = await ShowPlanCompanyService(id);
  if (!company) {
    return res.status(404).json({ error: "Empresa não encontrada" });
  }

  if (requestUser?.super === true) {
    const j = company.toJSON() as Record<string, unknown> & {
      plan?: unknown;
      modulePermissions?: Record<string, boolean>;
    };
    const effectiveModules = GetEffectiveModuleFlags(
      j.plan as any,
      j.modulePermissions
    );
    return res.status(200).json({ ...j, effectiveModules });
  }
  if (companyId.toString() !== id) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  }

  const j = company.toJSON() as Record<string, unknown> & {
    plan?: unknown;
    modulePermissions?: Record<string, boolean>;
  };
  const effectiveModules = GetEffectiveModuleFlags(
    j.plan as any,
    j.modulePermissions
  );
  return res.status(200).json({ ...j, effectiveModules });
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