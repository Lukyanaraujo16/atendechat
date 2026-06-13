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
