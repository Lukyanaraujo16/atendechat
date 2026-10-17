import { Request, Response } from "express";
import ListCompanyUsersService from "../services/SaasCompanyUsers/ListCompanyUsersService";
import CreateCompanyUserService from "../services/SaasCompanyUsers/CreateCompanyUserService";
import UpdateCompanyUserService from "../services/SaasCompanyUsers/UpdateCompanyUserService";
import SetCompanyUserActiveService from "../services/SaasCompanyUsers/SetCompanyUserActiveService";
import ResetCompanyUserPasswordService from "../services/SaasCompanyUsers/ResetCompanyUserPasswordService";
import { parseCompanyId } from "../services/SaasCompanyUsers/companyUserHelpers";

/**
 * Gestão de usuários de uma empresa pelo Super Admin (Fase 8.4).
 * Rotas protegidas por isAuth + isSuper (ver saasCompanyUsersRoutes).
 */

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const companyId = parseCompanyId(req.params.companyId);
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const result = await ListCompanyUsersService({ companyId, searchParam, pageNumber });
  return res.status(200).json(result);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const companyId = parseCompanyId(req.params.companyId);
  const { name, email, password, profile } = req.body || {};
  const user = await CreateCompanyUserService({
    companyId,
    actorUserId: Number(req.user.id),
    data: { name, email, password, profile }
  });
  return res.status(201).json(user);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const companyId = parseCompanyId(req.params.companyId);
  const body = (req.body || {}) as Record<string, unknown>;
  // Somente campos do contrato; `super`, `active`, `password` etc. são ignorados aqui.
  const data: Record<string, unknown> = {};
  for (const key of ["name", "email", "profile"]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) data[key] = body[key];
  }
  const user = await UpdateCompanyUserService({
    companyId,
    userId: req.params.userId,
    actorUserId: Number(req.user.id),
    data
  });
  return res.status(200).json(user);
};

export const setActive = async (req: Request, res: Response): Promise<Response> => {
  const companyId = parseCompanyId(req.params.companyId);
  const user = await SetCompanyUserActiveService({
    companyId,
    userId: req.params.userId,
    actorUserId: Number(req.user.id),
    active: (req.body || {}).active
  });
  return res.status(200).json(user);
};

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = parseCompanyId(req.params.companyId);
  const user = await ResetCompanyUserPasswordService({
    companyId,
    userId: req.params.userId,
    actorUserId: Number(req.user.id),
    password: (req.body || {}).password
  });
  return res.status(200).json(user);
};
