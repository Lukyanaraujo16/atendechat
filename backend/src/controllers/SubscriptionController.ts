import { Request, Response } from "express";
import * as Yup from "yup";
import Gerencianet from "gn-api-sdk-typescript";
import AppError from "../errors/AppError";

import options from "../config/Gn";
import Invoices from "../models/Invoices";
import SaaSPaymentAttempt from "../models/SaaSPaymentAttempt";
import { logger } from "../utils/logger";
import { saasBillingFlags } from "../config/saasBillingFlags";
import { confirmGatewayPayment } from "../services/SaasBilling/confirmGatewayPayment";

/**
 * URL do webhook PIX configurada na Efí/Gerencianet.
 */
function buildSubscriptionWebhookUrl(): string {
  const base = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  const path = "/subscription/webhook";
  if (!base) {
    logger.warn(
      "[subscription] BACKEND_URL ausente — configure para registrar webhook PIX corretamente"
    );
    return path;
  }
  const secret = process.env.WEBHOOK_SUBSCRIPTION_SECRET;
  if (secret) {
    return `${base}${path}?token=${encodeURIComponent(secret)}`;
  }
  return `${base}${path}`;
}

function formatPixAmount(value: number): string {
  return Number(value)
    .toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    .replace(",", ".");
}

function extractPaidAmountFromCharge(detahe: Record<string, unknown>): number {
  const valor = detahe?.valor as Record<string, unknown> | string | undefined;
  if (valor && typeof valor === "object" && "original" in valor) {
    const o = (valor as { original?: unknown }).original;
    return parseFloat(String(o ?? "0").replace(",", "."));
  }
  if (typeof valor === "string") {
    return parseFloat(valor.replace(",", "."));
  }
  return NaN;
}

function amountsMatchInvoice(expected: number, paid: number): boolean {
  if (Number.isNaN(paid)) return false;
  return Math.round(expected * 100) === Math.round(paid * 100);
}

function verifyWebhookSecret(req: Request): boolean {
  const secret = process.env.WEBHOOK_SUBSCRIPTION_SECRET;
  if (saasBillingFlags.requireWebhookSecret()) {
    if (!secret) {
      logger.error("[webhook] WEBHOOK_SUBSCRIPTION_SECRET obrigatório neste ambiente");
      return false;
    }
  } else if (!secret) {
    logger.warn(
      "[webhook] WEBHOOK_SUBSCRIPTION_SECRET ausente — aceito apenas em development/test"
    );
    return true;
  }
  const queryToken = req.query.token as string | undefined;
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "")?.trim();
  return queryToken === secret || bearer === secret;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const gerencianet = Gerencianet(options);
  return res.json(gerencianet.getSubscriptions());
};

export const createSubscription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!saasBillingFlags.pixEnabled()) {
    throw new AppError("ERR_PIX_DISABLED", 403);
  }

  const gerencianet = Gerencianet(options);
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    invoiceId: Yup.number().required(),
    users: Yup.string().required(),
    connections: Yup.string().required()
  });

  if (!(await schema.isValid(req.body))) {
    throw new AppError("ERR_SUBSCRIPTION_VALIDATION", 400);
  }

  const { invoiceId } = req.body;

  const invoice = await Invoices.findByPk(invoiceId);

  if (!invoice) {
    throw new AppError("ERR_INVOICE_NOT_FOUND", 404);
  }

  if (invoice.companyId !== companyId) {
    throw new AppError("ERR_FORBIDDEN_INVOICE", 403);
  }

  if (String(invoice.status).toLowerCase() === "paid") {
    throw new AppError("ERR_INVOICE_ALREADY_PAID", 400);
  }

  if (String(invoice.status).toLowerCase() === "cancelled") {
    throw new AppError("ERR_INVOICE_CANCELLED", 400);
  }

  const body = {
    calendario: {
      expiracao: 3600
    },
    valor: {
      original: formatPixAmount(Number(invoice.value))
    },
    chave: process.env.GERENCIANET_PIX_KEY,
    solicitacaoPagador: `#Fatura:${invoiceId}`
  };

  try {
    const pix = await gerencianet.pixCreateImmediateCharge(null, body);

    const qrcode = await gerencianet.pixGenerateQRCode({
      id: pix.loc.id
    });

    await SaaSPaymentAttempt.create({
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      method: "pix",
      status: "pending",
      externalTxid: pix.txid || null,
      gatewayProvider: "efi",
      gatewayStatus: pix.status || "ATIVA",
      amount: Number(invoice.value),
      payloadSummary: {
        locId: pix.loc?.id,
        solicitacaoPagador: `#Fatura:${invoiceId}`
      }
    });

    await invoice.update({
      externalTxid: pix.txid || invoice.externalTxid,
      gatewayProvider: "efi",
      gatewayStatus: pix.status || "ATIVA",
      gatewaySyncStatus: "pending"
    });

    const bodyWebhook = {
      webhookUrl: buildSubscriptionWebhookUrl()
    };

    const params = {
      chave: pix.chave
    };

    await gerencianet.pixConfigWebhook(params, bodyWebhook);

    return res.json({
      ...pix,
      qrcode
    });
  } catch (error) {
    logger.error(error);
    throw new AppError("ERR_SUBSCRIPTION_PIX_CREATE", 400);
  }
};

/**
 * Configuração de webhook — apenas Super Admin (Marco 1).
 */
export const createWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const schema = Yup.object().shape({
    chave: Yup.string().required(),
    url: Yup.string().url().required()
  });

  if (!(await schema.isValid(req.body))) {
    throw new AppError("ERR_SUBSCRIPTION_WEBHOOK_CONFIG_VALIDATION", 400);
  }

  const { chave, url } = req.body;

  try {
    const gerencianet = Gerencianet(options);
    const create = await gerencianet.pixConfigWebhook(
      { chave },
      { webhookUrl: url }
    );
    logger.info(
      {
        actorUserId: req.user?.id,
        chaveSuffix: String(chave).slice(-4)
      },
      "[subscription] webhook_config_updated"
    );
    return res.json(create);
  } catch (error) {
    logger.error({ err: error }, "[subscription] createWebhook failed");
    throw new AppError("ERR_SUBSCRIPTION_WEBHOOK_CONFIG", 400);
  }
};

export const webhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!verifyWebhookSecret(req)) {
    logger.warn("[webhook] subscription: token inválido ou ausente");
    return res.status(401).json({ error: "ERR_WEBHOOK_UNAUTHORIZED" });
  }

  const { evento } = req.body;

  if (evento === "teste_webhook") {
    return res.json({ ok: true });
  }

  // Falhas de processamento não podem ser confirmadas ao provedor como sucesso:
  // respondemos 500 para a Efí reenviar. O reprocessamento é idempotente por txid/fatura.
  const failedTxids: string[] = [];

  if (req.body.pix) {
    const gerencianet = Gerencianet(options);
    for (const pix of req.body.pix) {
      try {
        // Prova real: consulta o gateway — não confia só no payload
        const detahe = await gerencianet.pixDetailCharge({
          txid: pix.txid
        });

        if (detahe.status !== "CONCLUIDA") {
          continue;
        }

        const { solicitacaoPagador } = detahe;
        if (!solicitacaoPagador || typeof solicitacaoPagador !== "string") {
          logger.warn("[webhook] solicitacaoPagador ausente", { txid: pix.txid });
          continue;
        }

        const invoiceID = solicitacaoPagador.replace("#Fatura:", "").trim();
        const invoice = await Invoices.findByPk(invoiceID);

        if (!invoice) {
          logger.warn("[webhook] fatura não encontrada", {
            invoiceID,
            txid: pix.txid
          });
          continue;
        }

        const paid = extractPaidAmountFromCharge(
          detahe as Record<string, unknown>
        );
        const expected = Number(invoice.value);

        if (!amountsMatchInvoice(expected, paid)) {
          logger.warn(
            "[webhook] valor pago diverge da fatura — não marcando como pago",
            {
              txid: pix.txid,
              invoiceId: invoice.id,
              expected,
              paid
            }
          );
          continue;
        }

        await confirmGatewayPayment({
          invoiceId: invoice.id,
          amount: paid,
          method: "pix",
          externalTxid: pix.txid,
          gatewayProvider: "efi",
          gatewayStatus: "CONCLUIDA",
          metadata: { endToEndId: pix.endToEndId || null }
        });

        await SaaSPaymentAttempt.update(
          { status: "completed", gatewayStatus: "CONCLUIDA" },
          { where: { externalTxid: pix.txid } }
        );
      } catch (err) {
        failedTxids.push(String(pix?.txid || ""));
        logger.error({ err, txid: pix?.txid }, "[webhook] processing_failed");
      }
    }
  }

  if (failedTxids.length > 0) {
    return res
      .status(500)
      .json({ error: "ERR_WEBHOOK_PROCESSING_FAILED", failed: failedTxids.length });
  }

  return res.json({ ok: true });
};
