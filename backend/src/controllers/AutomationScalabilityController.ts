import { Request, Response } from "express";
import AppError from "../errors/AppError";
import * as Svc from "../services/AutomationOrchestrator/scalability/ScalabilityAdminServices";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return Number(id);
}

function mapErr(err: unknown): never {
  if (err instanceof AppError) throw err;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("ERR_")) throw new AppError(msg.split(":")[0], 400, msg);
  throw err;
}

export const health = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetScalabilityHealthService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const queueHealth = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetQueueHealthService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const workers = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.ListWorkersService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const jobs = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.ListJobsService({
        companyId: companyIdOrThrow(req),
        status: req.query.status ? String(req.query.status) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const enqueue = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.EnqueueJobService({
        companyId: companyIdOrThrow(req),
        type: String(req.body?.type || ""),
        payload: req.body?.payload,
        correlationId: req.body?.correlationId
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const reprocessDlq = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.ReprocessDeadLetterService({
        companyId: companyIdOrThrow(req),
        jobId: String(req.params.jobId)
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const cleanup = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.RunCleanupService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const consistency = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.RunConsistencyService({ companyId: companyIdOrThrow(req) })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const invalidateCache = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.InvalidateCacheService({
        companyId: companyIdOrThrow(req),
        resourceType: req.body?.resourceType
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const getConfig = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetScalabilityConfigService({
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
      await Svc.PutScalabilityConfigService({
        companyId: companyIdOrThrow(req),
        patch: req.body?.config || req.body || {}
      })
    );
  } catch (e) {
    mapErr(e);
  }
};

export const metrics = async (req: Request, res: Response) => {
  try {
    return res.json(
      await Svc.GetDistributedMetricsService({
        companyId: companyIdOrThrow(req),
        component: req.query.component
          ? String(req.query.component)
          : undefined
      })
    );
  } catch (e) {
    mapErr(e);
  }
};
