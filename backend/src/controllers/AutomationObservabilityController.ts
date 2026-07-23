import { Request, Response } from "express";
import AppError from "../errors/AppError";
import * as Svc from "../services/AutomationOrchestrator/observability/ObservabilityAdminServices";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return Number(id);
}

function userIdOrNull(req: Request): number | null {
  const id = req.user?.id;
  if (id == null) return null;
  return typeof id === "number" ? id : Number(id);
}

function mapErr(err: unknown): never {
  if (err instanceof AppError) throw err;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("ERR_")) {
    throw new AppError(msg.split(":")[0], 400, msg);
  }
  throw err;
}

export const dashboard = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetObservabilityDashboardService({
        companyId: companyIdOrThrow(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const health = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetObservabilityHealthService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const metrics = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetObservabilityMetricsService({
        companyId: companyIdOrThrow(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const trace = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetObservabilityTraceService({
        companyId: companyIdOrThrow(req),
        traceId: String(req.params.traceId)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const timeline = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetObservabilityTimelineService({
        companyId: companyIdOrThrow(req),
        traceId: String(req.params.traceId)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const events = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.ListObservabilityEventsService({
        companyId: companyIdOrThrow(req),
        traceId: req.query.traceId ? String(req.query.traceId) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const alerts = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.ListObservabilityAlertsService({
        companyId: companyIdOrThrow(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const acknowledgeAlert = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.AcknowledgeObservabilityAlertService({
        companyId: companyIdOrThrow(req),
        alertId: String(req.params.alertId)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const exportData = async (req: Request, res: Response) => {
  try {
    const kind = String(req.query.kind || req.body?.kind || "metrics") as any;
    const format = String(req.query.format || req.body?.format || "json") as any;
    const result = await Svc.ExportObservabilityService({
      companyId: companyIdOrThrow(req),
      kind,
      format,
      traceId: (req.query.traceId || req.body?.traceId) as string | undefined
    });
    if (format === "csv" && (result as any).csv) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      return res.send((result as any).csv);
    }
    return res.json(result);
  } catch (e) {
    mapErr(e);
  }
};

export const runOps = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.RunObservabilityOperationService({
        companyId: companyIdOrThrow(req),
        userId: userIdOrNull(req),
        operation: req.body?.operation,
        traceId: req.body?.traceId
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const getConfig = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetObservabilityConfigService({
        companyId: companyIdOrThrow(req)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const putConfig = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.PutObservabilityConfigService({
        companyId: companyIdOrThrow(req),
        patch: req.body?.config || req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const probe = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.SimulateObservabilityProbeService({
        companyId: companyIdOrThrow(req),
        agentId: req.body?.agentId ?? null
      })
    );
  } catch (e) {
    mapErr(e);
  }
};
