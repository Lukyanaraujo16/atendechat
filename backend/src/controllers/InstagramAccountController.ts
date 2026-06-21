import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { sanitizeInstagramAccount, sanitizeInstagramAccounts } from "../helpers/sanitizeInstagramAccount";

import CreateInstagramAccountService from "../services/InstagramAccountService/CreateInstagramAccountService";
import ConnectInstagramTokenService from "../services/InstagramAccountService/ConnectInstagramTokenService";
import DisconnectInstagramAccountService from "../services/InstagramAccountService/DisconnectInstagramAccountService";
import DeleteInstagramAccountService from "../services/InstagramAccountService/DeleteInstagramAccountService";
import ListInstagramAccountsService from "../services/InstagramAccountService/ListInstagramAccountsService";
import ShowInstagramAccountService from "../services/InstagramAccountService/ShowInstagramAccountService";
import UpdateInstagramAccountService from "../services/InstagramAccountService/UpdateInstagramAccountService";
import GetInstagramWebhookDiagnosticsService from "../services/InstagramAccountService/GetInstagramWebhookDiagnosticsService";
import SubscribeInstagramAccountWebhookService from "../services/InstagramAccountService/SubscribeInstagramAccountWebhookService";
import StartInstagramOAuthService from "../services/InstagramAccountService/StartInstagramOAuthService";
import HandleInstagramOAuthCallbackService from "../services/InstagramAccountService/HandleInstagramOAuthCallbackService";
import GetInstagramOAuthStatusService from "../services/InstagramAccountService/GetInstagramOAuthStatusService";

interface InstagramAccountData {
  name: string;
  queueIds: number[];
  isDefault?: boolean;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const accounts = await ListInstagramAccountsService({ companyId });

  return res.status(200).json(sanitizeInstagramAccounts(accounts));
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, queueIds, isDefault }: InstagramAccountData = req.body;
  const { companyId } = req.user;

  const { instagramAccount } = await CreateInstagramAccountService({
    name,
    companyId,
    queueIds,
    isDefault
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-instagramAccount`,
    {
      action: "update",
      instagramAccount: sanitizeInstagramAccount(instagramAccount)
    }
  );

  return res.status(200).json(sanitizeInstagramAccount(instagramAccount));
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const instagramAccount = await ShowInstagramAccountService(id, companyId);

  return res.status(200).json(sanitizeInstagramAccount(instagramAccount));
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const instagramAccountData = req.body;

  const { instagramAccount } = await UpdateInstagramAccountService({
    instagramAccountData,
    instagramAccountId: id,
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-instagramAccount`,
    {
      action: "update",
      instagramAccount: sanitizeInstagramAccount(instagramAccount)
    }
  );

  return res.status(200).json(sanitizeInstagramAccount(instagramAccount));
};

export const connectToken = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const { accessToken } = req.body as { accessToken?: string };

  const instagramAccount = await ConnectInstagramTokenService({
    instagramAccountId: id,
    companyId,
    accessToken: accessToken || ""
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-instagramAccount`,
    {
      action: "update",
      instagramAccount
    }
  );

  return res.status(200).json(instagramAccount);
};

export const disconnect = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const instagramAccount = await DisconnectInstagramAccountService({
    instagramAccountId: id,
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-instagramAccount`,
    {
      action: "update",
      instagramAccount
    }
  );

  return res.status(200).json(instagramAccount);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  await DeleteInstagramAccountService(id, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-instagramAccount`,
    {
      action: "delete",
      instagramAccountId: +id
    }
  );

  return res.status(200).json({ message: "Instagram account deleted" });
};

export const webhookDiagnostics = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const diagnostics = await GetInstagramWebhookDiagnosticsService({
    instagramAccountId: id,
    companyId
  });

  return res.status(200).json(diagnostics);
};

export const subscribeWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const result = await SubscribeInstagramAccountWebhookService({
    instagramAccountId: id,
    companyId
  });

  const diagnostics = await GetInstagramWebhookDiagnosticsService({
    instagramAccountId: id,
    companyId
  });

  return res.status(200).json({
    subscription: result,
    diagnostics
  });
};

export const startOAuth = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { id } = req.params;

  const result = await StartInstagramOAuthService({
    instagramAccountId: id,
    companyId,
    userId
  });

  return res.status(200).json(result);
};

export const oauthCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const readQueryString = (value: unknown): string | undefined => {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value) && typeof value[0] === "string") {
      return value[0];
    }

    return undefined;
  };

  const redirectUrl = await HandleInstagramOAuthCallbackService({
    code: readQueryString(req.query.code),
    state: readQueryString(req.query.state),
    oauthError: readQueryString(req.query.error),
    oauthErrorDescription: readQueryString(req.query.error_description)
  });

  res.redirect(302, redirectUrl);
};

export const oauthStatus = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const status = await GetInstagramOAuthStatusService({
    instagramAccountId: id,
    companyId
  });

  return res.status(200).json(status);
};
