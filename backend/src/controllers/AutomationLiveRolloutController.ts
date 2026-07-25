import { Request, Response } from "express";
import AppError from "../errors/AppError";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function userIdOrThrow(req: Request): number {
  const id = req.user?.id;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return Number(id);
}

export const getRollout = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetLiveRolloutDashboardService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(await GetLiveRolloutDashboardService({ companyId }));
};

export const updateRollout = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { UpsertLiveRolloutConfigService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(
    await UpsertLiveRolloutConfigService({
      companyId,
      config: req.body?.config || req.body || {}
    })
  );
};

export const readiness = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetLiveReadinessService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(await GetLiveReadinessService({ companyId }));
};

export const eligibility = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { TestLiveEligibilityService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(
    await TestLiveEligibilityService({
      companyId,
      body: {
        adminTestMode: true,
        skipReadiness: true,
        ...req.query,
        whatsappId: req.query.whatsappId,
        aiAgentId: req.query.aiAgentId,
        ticketId: req.query.ticketId
      }
    })
  );
};

export const testLive = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { TestLiveEligibilityService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(
    await TestLiveEligibilityService({ companyId, body: req.body || {} })
  );
};

export const rollback = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ApplyLiveRollbackService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(await ApplyLiveRollbackService({ companyId }));
};

export const fallback = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ApplyLiveFallbackNoteService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(
    await ApplyLiveFallbackNoteService({
      companyId,
      reason: req.body?.reason
    })
  );
};

export const killSwitch = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { SetLiveKillSwitchService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(
    await SetLiveKillSwitchService({
      companyId,
      scope: String(req.body?.scope || "company"),
      targetId: req.body?.targetId,
      enabled: req.body?.enabled === true
    })
  );
};

export const companySetting = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { UpsertLiveFcCompanySettingService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(
    await UpsertLiveFcCompanySettingService({
      companyId,
      enabled: req.body?.enabled === true
    })
  );
};

export const agentSetting = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = Number(req.params.agentId);
  if (!Number.isFinite(aiAgentId) || aiAgentId < 1) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "agentId inválido.");
  }
  const AiAgent = (await import("../models/AiAgent")).default;
  const agent = await AiAgent.findOne({
    where: { id: aiAgentId, companyId }
  });
  if (!agent) {
    throw new AppError("ERR_NOT_FOUND", 404);
  }
  const { UpsertLiveFcAgentSettingService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(
    await UpsertLiveFcAgentSettingService({
      companyId,
      aiAgentId,
      enabled: req.body?.enabled === true,
      userId: userIdOrThrow(req)
    })
  );
};

export const connectionSetting = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const whatsappId = Number(req.params.whatsappId);
  if (!Number.isFinite(whatsappId) || whatsappId < 1) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "whatsappId inválido.");
  }
  const { UpsertLiveFcConnectionSettingService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(
    await UpsertLiveFcConnectionSettingService({
      companyId,
      whatsappId,
      enabled: req.body?.enabled === true
    })
  );
};

export const targets = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ListLiveRolloutTargetsService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(await ListLiveRolloutTargetsService({ companyId }));
};

export const advanceProgressive = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { AdvanceProgressiveService } = await import(
    "../services/AutomationOrchestrator/liveRollout/LiveRolloutAdminServices"
  );
  return res.json(await AdvanceProgressiveService({ companyId }));
};

export const liveHealth = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { getLiveHardeningHealth } = await import(
    "../services/AutomationOrchestrator/liveRollout/hardening/LiveHardeningHealth"
  );
  return res.json(await getLiveHardeningHealth({ companyId }));
};
