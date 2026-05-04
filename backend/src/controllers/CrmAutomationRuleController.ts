import { Request, Response } from "express";
import AppError from "../errors/AppError";
import CreateCrmAutomationRuleService from "../services/CrmAutomationRule/CreateCrmAutomationRuleService";
import UpdateCrmAutomationRuleService from "../services/CrmAutomationRule/UpdateCrmAutomationRuleService";
import DeleteCrmAutomationRuleService from "../services/CrmAutomationRule/DeleteCrmAutomationRuleService";
import ListCrmAutomationRulesService from "../services/CrmAutomationRule/ListCrmAutomationRulesService";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function assertCrmAutomationAdmin(req: Request): void {
  if (req.user.profile !== "admin" && !req.user.supportMode) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
}

export const listCrmAutomationRules = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await ListCrmAutomationRulesService({ companyId });
  return res.json(rows);
};

export const createCrmAutomationRule = async (
  req: Request,
  res: Response
): Promise<Response> => {
  assertCrmAutomationAdmin(req);
  const companyId = companyIdOrThrow(req);
  const row = await CreateCrmAutomationRuleService({ companyId, body: req.body });
  return res.status(201).json(row);
};

export const updateCrmAutomationRule = async (
  req: Request,
  res: Response
): Promise<Response> => {
  assertCrmAutomationAdmin(req);
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  const row = await UpdateCrmAutomationRuleService({ companyId, id, body: req.body });
  return res.json(row);
};

export const deleteCrmAutomationRule = async (
  req: Request,
  res: Response
): Promise<Response> => {
  assertCrmAutomationAdmin(req);
  const companyId = companyIdOrThrow(req);
  const id = Number(req.params.id);
  await DeleteCrmAutomationRuleService({ companyId, id });
  return res.status(204).send();
};
