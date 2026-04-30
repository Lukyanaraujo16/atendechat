import { Request, Response } from "express";
import ListCompanySignupRequestsService from "../services/CompanySignupRequest/ListCompanySignupRequestsService";
import ApproveCompanySignupRequestService from "../services/CompanySignupRequest/ApproveCompanySignupRequestService";
import RejectCompanySignupRequestService from "../services/CompanySignupRequest/RejectCompanySignupRequestService";
import ResendCompanySignupInviteService from "../services/CompanySignupRequest/ResendCompanySignupInviteService";
import SignupRequestSummaryCountsService from "../services/CompanySignupRequest/SignupRequestSummaryCountsService";
import { emitPlatformSignupToSuperAdmins } from "../libs/platformSignupRealtime";

export const summaryCounts = async (_req: Request, res: Response): Promise<Response> => {
  const summary = await SignupRequestSummaryCountsService();
  return res.json(summary);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const payload = await ListCompanySignupRequestsService({ status, search });
  return res.json(payload);
};

export const approve = async (req: Request, res: Response): Promise<Response> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "ERR_INVALID_ID" });
  }
  const reviewerId = Number(req.user!.id);
  const { signupRequest, primaryAdminCredentials } =
    await ApproveCompanySignupRequestService(id, reviewerId);
  void emitPlatformSignupToSuperAdmins({ action: "signup_updated" });
  const base =
    typeof signupRequest.toJSON === "function"
      ? signupRequest.toJSON()
      : { ...(signupRequest as object) };
  return res.json({
    ...base,
    ...(primaryAdminCredentials ? { primaryAdminCredentials } : {})
  });
};

export const reject = async (req: Request, res: Response): Promise<Response> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "ERR_INVALID_ID" });
  }
  const reviewerId = Number(req.user!.id);
  const row = await RejectCompanySignupRequestService(id, reviewerId, req.body ?? {});
  void emitPlatformSignupToSuperAdmins({ action: "signup_updated" });
  return res.json(row);
};

export const resendInvite = async (req: Request, res: Response): Promise<Response> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "ERR_INVALID_ID" });
  }
  const actorId = Number(req.user!.id);
  const payload = await ResendCompanySignupInviteService(id, actorId);
  void emitPlatformSignupToSuperAdmins({ action: "signup_updated" });
  return res.json(payload);
};
