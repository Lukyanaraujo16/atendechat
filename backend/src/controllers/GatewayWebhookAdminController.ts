import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  classifyUnlinkedGatewayWebhookEvent,
  getGatewayWebhookAdminStats,
  getGatewayWebhookEventDetail,
  listGatewayWebhookEvents,
  reprocessGatewayWebhookEvent,
  runPixReconciliationSweep
} from "../services/SaasBilling/gatewayWebhookAdminService";
import { homologateEfiConfig } from "../services/SaasBilling/efiHomologationService";

/** Fase 8.3-B3.3 — eventos de webhook, varredura e homologação (Super Admin). */

function actorId(req: Request): number {
  const id = Number(req.user?.id);
  if (!Number.isFinite(id)) throw new AppError("Acesso não permitido", 401);
  return id;
}

function idParam(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError("ERR_VALIDATION", 400, "id inválido.");
  return id;
}

export const listEvents = async (req: Request, res: Response): Promise<Response> =>
  res.json(await listGatewayWebhookEvents(req.query as Record<string, unknown>));

export const eventStats = async (_req: Request, res: Response): Promise<Response> =>
  res.json(await getGatewayWebhookAdminStats());

export const eventDetail = async (req: Request, res: Response): Promise<Response> =>
  res.json(await getGatewayWebhookEventDetail(idParam(req)));

export const reprocessEvent = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await reprocessGatewayWebhookEvent({ id: idParam(req), actorUserId: actorId(req), note: req.body?.note })
  );

export const classifyEvent = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await classifyUnlinkedGatewayWebhookEvent({
      id: idParam(req),
      actorUserId: actorId(req),
      action: req.body?.action,
      note: req.body?.note,
      companyId: req.body?.companyId,
      invoiceId: req.body?.invoiceId
    })
  );

export const pixSweep = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await runPixReconciliationSweep({
      actorUserId: actorId(req),
      confirm: req.body?.confirm,
      days: req.body?.days
    })
  );

export const homologate = async (req: Request, res: Response): Promise<Response> =>
  res.json(
    await homologateEfiConfig({
      slot: String(req.params.slot || ""),
      actorUserId: actorId(req),
      confirm: req.body?.confirm,
      evidence: req.body?.evidence
    })
  );
