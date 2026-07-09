import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListAiProviderCredentialsService, {
  ShowAiProviderCredentialService
} from "../services/AiProviderCredentialService/ListAiProviderCredentialsService";
import CreateAiProviderCredentialService from "../services/AiProviderCredentialService/CreateAiProviderCredentialService";
import UpdateAiProviderCredentialService from "../services/AiProviderCredentialService/UpdateAiProviderCredentialService";
import DeleteAiProviderCredentialService from "../services/AiProviderCredentialService/DeleteAiProviderCredentialService";
import TestAiProviderCredentialService from "../services/AiProviderCredentialService/TestAiProviderCredentialService";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "ID inválido.");
  }
  return id;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await ListAiProviderCredentialsService({ companyId });
  return res.json(rows);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const row = await ShowAiProviderCredentialService({ companyId, id });
  return res.json(row);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await CreateAiProviderCredentialService({
    companyId,
    body: req.body
  });
  return res.status(201).json(row);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const row = await UpdateAiProviderCredentialService({
    companyId,
    id,
    body: req.body
  });
  return res.json(row);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const result = await DeleteAiProviderCredentialService({ companyId, id });
  return res.json(result);
};

export const test = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const result = await TestAiProviderCredentialService({ companyId, id });
  return res.json(result);
};
