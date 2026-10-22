import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Invoices from "../../models/Invoices";
import SaaSPaymentAttempt from "../../models/SaaSPaymentAttempt";
import {
  getAllowedEfiSlotForRuntime,
  getStreamhubRuntimeEnv
} from "../../config/streamhubRuntimeEnv";
import { logger } from "../../utils/logger";
import { recordEfiConfigAudit } from "./efiConfigAudit";
import { isEfiPixChargeV2Active, isEfiWebhookPipelineAsyncActive } from "./efiFinancialSource";
import { getExpectedWebhookSecret } from "./webhookReception";
import {
  getEfiDatabasePixGateway,
  getEfiPixChargeGateway
} from "./efiPixChargeGateway";
import { buildSubscriptionWebhookUrl, buildSubscriptionWebhookUrlV2 } from "./subscriptionWebhookUrl";

/**
 * Ações Super Admin da B3.2: consulta de txid (RF2.6) e consulta/cadastro do webhook (RF2.7).
 * Usam a fonte financeira efetiva (`database` só onde liberado e configurado; senão `legacy_env`, P-B31-08). Nenhum segredo sai na resposta
 * nem na auditoria: query da URL e chave Pix mascaradas (T-SEC-08).
 */

/** txid de cobrança imediata: alfanumérico (Efí/Bacen). Bloqueia path injection na URL. */
const TXID_RE = /^[a-zA-Z0-9]{1,35}$/;

export function maskWebhookUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const [base, query] = String(url).split("?");
  if (query == null) return base;
  const masked = query
    .split("&")
    .map(pair => {
      const [k] = pair.split("=");
      return pair.includes("=") ? `${k}=***` : k;
    })
    .join("&");
  return `${base}?${masked}`;
}

export function maskPixKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const k = String(key);
  return k.length <= 4 ? "****" : `****${k.slice(-4)}`;
}

/** GET /saas/finance/efi/charges/:txid — dados da Efí; só `gatewayStatus` é atualizado. */
export async function getEfiChargeForAdmin(txidRaw: string): Promise<Record<string, unknown>> {
  const txid = String(txidRaw || "").trim();
  if (!TXID_RE.test(txid)) {
    throw new AppError("ERR_PIX_TXID_INVALID", 400, "txid inválido.");
  }
  const gateway = await getEfiPixChargeGateway();
  const cob = await gateway.getCharge(txid);
  if (!cob) {
    throw new AppError("ERR_EFI_CHARGE_NOT_FOUND", 404, "Cobrança não encontrada na conta Efí.");
  }
  const status = String(cob.status || "").toUpperCase() || null;
  const attempt = await SaaSPaymentAttempt.findOne({ where: { externalTxid: txid } });
  if (status) {
    // RF2.6: só o espelho do status do gateway; nenhum dado financeiro muda.
    if (attempt && attempt.gatewayStatus !== status) await attempt.update({ gatewayStatus: status });
    // Fatura já paga não recebe espelho (evita mostrar ATIVA/REMOVIDA numa fatura quitada).
    await Invoices.update(
      { gatewayStatus: status },
      { where: { externalTxid: txid, status: { [Op.ne]: "paid" } } }
    );
  }
  const pix = Array.isArray(cob.pix) ? cob.pix : [];
  return {
    txid,
    status,
    valor: cob.valor?.original ?? null,
    criacao: cob.calendario?.criacao ?? null,
    expiracao: cob.calendario?.expiracao != null ? Number(cob.calendario.expiracao) : null,
    solicitacaoPagador: cob.solicitacaoPagador ?? null,
    chaveMasked: maskPixKey(cob.chave),
    pagamentos: pix.map(p => ({
      endToEndId: p.endToEndId ?? null,
      valor: p.valor ?? null,
      horario: p.horario ?? null
    })),
    local: attempt
      ? {
          attemptId: attempt.id,
          invoiceId: attempt.invoiceId,
          companyId: attempt.companyId,
          attemptStatus: attempt.status,
          source: (attempt.payloadSummary as any)?.source ?? "legacy_env"
        }
      : null,
    credentialsSource: gateway.context.source
  };
}

/** GET /saas/finance/efi/webhook — webhook cadastrado para a chave da fonte efetiva. */
export async function getEfiWebhookForAdmin(): Promise<Record<string, unknown>> {
  const gateway = await getEfiPixChargeGateway();
  const wh = await gateway.getWebhook(gateway.context.pixKey);
  return {
    registered: Boolean(wh?.webhookUrl),
    webhookUrlMasked: maskWebhookUrl(wh?.webhookUrl),
    chaveMasked: maskPixKey(gateway.context.pixKey),
    criacao: wh?.criacao ?? null,
    credentialsSource: gateway.context.source,
    efiEnvironment: gateway.context.efiEnvironment,
    registerAvailable: isEfiPixChargeV2Active()
  };
}

/**
 * GET /saas/finance/efi/config/webhook-check (B34-T10) — só leitura: webhook já cadastrado na
 * chave Pix do slot do banco, mesmo com a fonte financeira em `legacy_env`. A Efí mantém um
 * webhook por chave: cadastrar outro substitui o atual. Usar antes de qualquer cadastro.
 */
export async function getEfiSlotWebhookForAdmin(): Promise<
  Record<string, unknown>
> {
  const gateway = await getEfiDatabasePixGateway();
  const wh = await gateway.getWebhook(gateway.context.pixKey);
  const url = typeof wh?.webhookUrl === "string" ? wh.webhookUrl : null;
  let pointsToThisBackend: boolean | null = null;
  try {
    const backend = process.env.BACKEND_URL
      ? new URL(process.env.BACKEND_URL).host
      : null;
    pointsToThisBackend = url && backend ? new URL(url).host === backend : null;
  } catch {
    pointsToThisBackend = null;
  }
  return {
    registered: Boolean(url),
    webhookUrlMasked: maskWebhookUrl(url),
    pointsToThisBackend,
    chaveMasked: maskPixKey(gateway.context.pixKey),
    criacao: wh?.criacao ?? null,
    credentialsSource: gateway.context.source,
    efiEnvironment: gateway.context.efiEnvironment
  };
}

/**
 * POST /saas/finance/efi/webhook/register — cadastro auditado (R-10).
 * C3: só com a cobrança v2 ativa (o checkout legado sobrescreve a URL a cada pagamento);
 * recusado sem chamada à Efí. Com o pipeline `legacy`, usa o formato atual (`?token=`), o
 * mesmo do checkout legado (RF2.7); com o pipeline async ativo, o formato novo (B3.3).
 */
export async function registerEfiWebhookForAdmin(input: {
  actorUserId: number;
  confirm: boolean;
}): Promise<Record<string, unknown>> {
  if (!isEfiPixChargeV2Active()) {
    throw new AppError(
      "ERR_EFI_WEBHOOK_REGISTER_REQUIRES_V2",
      409,
      "O cadastro do webhook pelo painel exige a cobrança Pix v2 ativa (o checkout atual recadastra a URL a cada pagamento)."
    );
  }
  if (!input.confirm) {
    throw new AppError("ERR_EFI_WEBHOOK_CONFIRM_REQUIRED", 400, "Confirme o cadastro do webhook.");
  }
  // RF2.7/T-ACT-08: formato novo (`whToken` + `ignorar=`) só com o pipeline async efetivo;
  // com o legado (inclusive `async` configurado sem liberação de código), o formato atual.
  const asyncActive = isEfiWebhookPipelineAsyncActive();
  const expected = asyncActive ? await getExpectedWebhookSecret() : null;
  const secret = asyncActive
    ? expected?.secret || ""
    : (process.env.WEBHOOK_SUBSCRIPTION_SECRET || "").trim();
  if (!(process.env.BACKEND_URL || "").trim() || !secret) {
    throw new AppError(
      "ERR_EFI_WEBHOOK_URL_INCOMPLETE",
      400,
      "BACKEND_URL e o webhook secret da fonte ativa são obrigatórios para cadastrar o webhook."
    );
  }
  const runtime = getStreamhubRuntimeEnv();
  const slot = getAllowedEfiSlotForRuntime(runtime);
  const gateway = await getEfiPixChargeGateway();
  const url = asyncActive ? buildSubscriptionWebhookUrlV2(secret) : buildSubscriptionWebhookUrl();
  await gateway.putWebhook(gateway.context.pixKey, url);
  const check = await gateway.getWebhook(gateway.context.pixKey).catch(() => null);
  const conferred = check?.webhookUrl === url;

  await recordEfiConfigAudit({
    configId: gateway.context.configId,
    slot,
    actorUserId: input.actorUserId,
    action: "webhook_register",
    diffSummary: {
      credentialsSource: gateway.context.source,
      efiEnvironment: gateway.context.efiEnvironment,
      urlFormat: asyncActive ? "whToken_ignorar" : "token_legacy",
      webhookUrlMasked: maskWebhookUrl(url),
      conferred
    }
  });
  logger.info(
    { actorUserId: input.actorUserId, source: gateway.context.source, conferred },
    "[efiAdmin] webhook_registered"
  );
  return {
    registered: true,
    conferred,
    webhookUrlMasked: maskWebhookUrl(url),
    chaveMasked: maskPixKey(gateway.context.pixKey),
    credentialsSource: gateway.context.source,
    urlFormat: asyncActive ? "whToken_ignorar" : "token_legacy"
  };
}
