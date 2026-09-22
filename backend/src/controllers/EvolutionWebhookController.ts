import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { isEvolutionConnection } from "../modules/whatsapp/connectionProvider";
import {
  extractEvolutionWebhookApiKey,
  verifyEvolutionWebhookApiKey
} from "../modules/whatsapp/providers/evolution/inbound/evolutionWebhookAuth";
import { processEvolutionWebhook } from "../modules/whatsapp/providers/evolution/inbound/processEvolutionWebhook";

const MAX_JSON_BYTES = 1_000_000;

/**
 * POST /webhooks/evolution/:whatsappId
 *
 * Auth: apikey (header/body) vs credencial cifrada da conexão.
 * Sem HMAC nativo Evolution no modo alvo.
 * companyId NÃO vem do body — só da conexão.
 */
export const receive = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const whatsappId = Number(req.params.whatsappId);
  if (!Number.isFinite(whatsappId) || whatsappId <= 0) {
    throw new AppError("ERR_EVOLUTION_WEBHOOK_INVALID_CONNECTION", 400);
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_JSON_BYTES) {
    throw new AppError("ERR_EVOLUTION_WEBHOOK_PAYLOAD_TOO_LARGE", 413);
  }

  /**
   * Snapshot mínimo da conexão. integrationId/promptId alimentam
   * processInboundAutomation (Flow/Typebot na conexão).
   * aiAgent* alimentam o mesmo scheduleAiAgentDryRunFromInbound do Baileys.
   * Sem session.
   */
  const whatsapp = await Whatsapp.findByPk(whatsappId, {
    attributes: [
      "id",
      "companyId",
      "connectionProvider",
      "name",
      "status",
      "integrationId",
      "promptId",
      "aiAgentId",
      "aiAgentEnabled",
      "aiAgentMode"
    ]
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  if (!isEvolutionConnection(whatsapp)) {
    throw new AppError(
      "ERR_EVOLUTION_WEBHOOK_NOT_EVOLUTION_CONNECTION",
      400,
      "Esta conexão não é Evolution."
    );
  }

  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : null;

  if (!body) {
    throw new AppError("ERR_EVOLUTION_WEBHOOK_INVALID_PAYLOAD", 400);
  }

  const presentedKey = extractEvolutionWebhookApiKey({
    headers: req.headers as Record<string, unknown>,
    body
  });

  const auth = await verifyEvolutionWebhookApiKey({
    whatsappId: whatsapp.id,
    presentedKey
  });

  if (auth.ok === false) {
    logger.warn(
      {
        whatsappId: whatsapp.id,
        companyId: whatsapp.companyId,
        reason: auth.reason
      },
      "[EvolutionWebhook] unauthorized"
    );
    throw new AppError("ERR_EVOLUTION_WEBHOOK_UNAUTHORIZED", 401);
  }

  // ACK rápido; processamento em seguida (síncrono controlado nesta fase).
  // Resposta 200 previsível para Evolution re-try.
  const resultPromise = processEvolutionWebhook({
    whatsapp,
    body,
    apiKeyValid: true
  });

  // Processa antes de responder para testes locais/fixtures terem assertabilidade;
  // ainda assim não bloqueia em filas externas. Documentado: síncrono controlado.
  const result = await resultPromise;

  logger.info(
    {
      whatsappId: whatsapp.id,
      companyId: whatsapp.companyId,
      outcome: result.outcome,
      reason: result.reason,
      messageId: result.messageId
    },
    "[EvolutionWebhook] handled"
  );

  return res.status(200).json({
    ok: true,
    outcome: result.outcome,
    reason: result.reason || null
  });
};
