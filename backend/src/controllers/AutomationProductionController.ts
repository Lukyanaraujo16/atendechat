import { Request, Response } from "express";
import AppError from "../errors/AppError";
import * as Svc from "../services/AutomationOrchestrator/production/ProductionAdminServices";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  // nunca confiar em body/query companyId para escopo
  if (
    req.body?.companyId != null &&
    Number(req.body.companyId) !== Number(id)
  ) {
    throw new AppError("ERR_TENANT_BYPASS", 403);
  }
  if (
    req.query?.companyId != null &&
    Number(req.query.companyId) !== Number(id)
  ) {
    throw new AppError("ERR_TENANT_BYPASS", 403);
  }
  return Number(id);
}

function mapErr(err: unknown): never {
  if (err instanceof AppError) throw err;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("ERR_")) throw new AppError(msg.split(":")[0], 400, msg);
  throw err;
}

export const productionDashboard = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetProductionDashboardService({
        companyId: companyIdOrThrow(req),
        isSuper: (req.user as any)?.super === true
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const productionReadiness = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetReleaseReadinessService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const getRollout = async (req: Request, res: Response) => {
  try {
    return res.json(await Svc.GetRolloutService({ companyId: companyIdOrThrow(req) }));
  } catch (e) {
    mapErr(e);
  }
};

export const rolloutHistory = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetRolloutHistoryService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const preflight = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.RunPreflightService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const transition = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.TransitionRolloutService({
        companyId: companyIdOrThrow(req),
        to: req.body?.to,
        expectedVersion: Number(req.body?.expectedVersion),
        userId: Number(req.user!.id),
        reason: String(req.body?.reason || ""),
        confirm: req.body?.confirm === true,
        acceptWarnings: req.body?.acceptWarnings === true
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const suspend = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.SuspendRolloutService({
        companyId: companyIdOrThrow(req),
        userId: Number(req.user!.id),
        reason: String(req.body?.reason || ""),
        confirm: req.body?.confirm === true,
        expectedVersion: Number(req.body?.expectedVersion)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const resume = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.ResumeRolloutService({
        companyId: companyIdOrThrow(req),
        userId: Number(req.user!.id),
        reason: String(req.body?.reason || ""),
        confirm: req.body?.confirm === true,
        expectedVersion: Number(req.body?.expectedVersion),
        to: req.body?.to
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const rollback = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.RollbackRolloutService({
        companyId: companyIdOrThrow(req),
        userId: Number(req.user!.id),
        reason: String(req.body?.reason || ""),
        confirm: req.body?.confirm === true,
        expectedVersion: Number(req.body?.expectedVersion)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listKill = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.ListKillSwitchesService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const setKill = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.SetKillSwitchService({
        companyId: companyIdOrThrow(req),
        scope: req.body?.scope,
        resourceId: String(req.body?.resourceId || "*"),
        enabled: req.body?.enabled === true,
        reason: String(req.body?.reason || ""),
        userId: Number(req.user!.id),
        confirm: req.body?.confirm === true
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const emergencyStop = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.EmergencyStopService({
        companyId: companyIdOrThrow(req),
        userId: Number(req.user!.id),
        reason: String(req.body?.reason || ""),
        confirm: req.body?.confirm === true,
        scope: req.body?.scope === "global" ? "global" : "tenant"
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const listIncidents = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.ListIncidentsService({
        companyId: companyIdOrThrow(req),
        limit: req.query.limit ? Number(req.query.limit) : undefined
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const getIncident = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetIncidentService({
        companyId: companyIdOrThrow(req),
        incidentId: String(req.params.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const ackIncident = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.AcknowledgeIncidentService({
        companyId: companyIdOrThrow(req),
        incidentId: String(req.params.id),
        userId: Number(req.user!.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const resolveIncident = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.ResolveIncidentService({
        companyId: companyIdOrThrow(req),
        incidentId: String(req.params.id),
        resolution: String(req.body?.resolution || ""),
        confirm: req.body?.confirm === true
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const releaseReadiness = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetReleaseReadinessService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const checkReleaseReadiness = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.CheckReleaseReadinessService({
        companyId: companyIdOrThrow(req),
        userId: Number(req.user!.id)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const environmentValidation = async (_req: Request, res: Response) => {
  try {
    return res.json(await Svc.GetEnvironmentValidationService());
  } catch (e) {
    mapErr(e);
  }
};

export const evidencePackage = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetEvidencePackageService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const hydrate = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.HydrateTenantService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const resolveKill = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.ResolveKillDecisionService({
        companyId: companyIdOrThrow(req),
        component: req.query.component ? String(req.query.component) : "agentos"
      })
    );
  } catch (e) {
    mapErr(e);
  }
};
