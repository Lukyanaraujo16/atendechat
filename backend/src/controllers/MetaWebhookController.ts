import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  buildMetaWebhookCallbackUrl,
  getMetaWebhookVerifyToken,
  hasMetaAppSecret,
  hasMetaWebhookVerifyToken
} from "../helpers/metaWebhookUrl";
import { verifyMetaWebhookSignature } from "../helpers/metaWebhookSignature";
import ProcessMetaInstagramWebhookService from "../services/InstagramAccountService/ProcessMetaInstagramWebhookService";
import { logger } from "../utils/logger";

export const verify = (req: Request, res: Response): Response => {
  const verifyToken = getMetaWebhookVerifyToken();

  if (!verifyToken) {
    throw new AppError(
      "ERR_META_WEBHOOK_VERIFY_TOKEN_MISSING",
      500,
      "META_WEBHOOK_VERIFY_TOKEN não configurado no servidor."
    );
  }

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken && challenge != null) {
    logger.info("[InstagramWebhook] verification succeeded");
    return res.status(200).send(String(challenge));
  }

  logger.warn(
    {
      mode,
      tokenMatch: token === verifyToken
    },
    "[InstagramWebhook] verification failed"
  );

  return res.status(403).json({ error: "ERR_META_WEBHOOK_VERIFY_FORBIDDEN" });
};

export const receive = (req: Request, res: Response): void => {
  const appSecret = process.env.META_APP_SECRET?.trim();

  if (!appSecret) {
    throw new AppError(
      "ERR_META_APP_CONFIG_MISSING",
      500,
      "META_APP_SECRET não configurado no servidor."
    );
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(
        typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {})
      );

  const signatureHeader = req.get("x-hub-signature-256");
  const signatureValid = verifyMetaWebhookSignature(
    rawBody,
    signatureHeader,
    appSecret
  );

  if (!signatureValid) {
    logger.warn("[InstagramWebhook] invalid signature");
    res.status(403).json({ error: "ERR_META_WEBHOOK_INVALID_SIGNATURE" });
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
  } catch {
    res.status(400).json({ error: "ERR_META_WEBHOOK_INVALID_PAYLOAD" });
    return;
  }

  res.status(200).send("EVENT_RECEIVED");

  void ProcessMetaInstagramWebhookService({ payload, signatureValid }).catch(
    err => {
      logger.error(
        {
          error: err instanceof Error ? err.message : String(err)
        },
        "[InstagramWebhook] async processing failed"
      );
    }
  );
};

export const webhookInfo = (_req: Request, res: Response): Response => {
  const hasVerifyToken = hasMetaWebhookVerifyToken();
  const hasSecret = hasMetaAppSecret();

  let endpointStatus = "awaiting_configuration";
  if (hasVerifyToken && hasSecret) {
    endpointStatus = "available";
  } else if (hasVerifyToken || hasSecret) {
    endpointStatus = "partial_configuration";
  }

  return res.status(200).json({
    callbackUrl: buildMetaWebhookCallbackUrl(),
    hasVerifyToken,
    hasAppSecret: hasSecret,
    endpointStatus
  });
};
