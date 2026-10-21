import crypto from "crypto";
import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import Invoices from "../../models/Invoices";
import SaaSPaymentAttempt from "../../models/SaaSPaymentAttempt";
import { getAppBuildCommit } from "../../config/appBuildInfo";
import { logger } from "../../utils/logger";
import {
  EfiPixChargeContext,
  EfiPixChargeGateway,
  EfiPixCob,
  EfiPixCobBody,
  getEfiPixChargeGateway,
  isEfiPixRetryable
} from "./efiPixChargeGateway";

/**
 * Cobrança Pix v2 (B3.2, RF2.1–RF2.5, D-P4, D-P5, R-4, R-5, R-13).
 *
 * Três passos, **sem chamada Efí dentro de lock** (RF2.2):
 * 1. Transação curta com `FOR UPDATE` da fatura: escolhe a tentativa a tratar (ou reserva uma
 *    nova `creating` com txid local, commit próprio: nunca existe cobrança sem registro).
 * 2. Fora do lock: GET/PUT na Efí. PUT com conflito (409 `txid_duplicado`) → GET + comparação (PT-3).
 * 3. Transação curta: grava o resultado e revalida a fatura (paga/cancelada → QR não exibido).
 *
 * Regra central (D-P4): uma tentativa cujo txid **pode existir** na Efí (`creating`, `pending`,
 * `blocked`, `failed` com resultado incerto) só é abandonada depois de um GET conclusivo:
 * cobrança inexistente, REMOVIDA ou vencida pelo relógio da Efí (com margem). Enquanto ela
 * estiver pagável e não puder ser reusada, **nenhuma nova é criada** (409 com o prazo). Paga
 * (CONCLUIDA) sem baixa local → bloqueio até a confirmação: nunca uma segunda cobrança.
 */

export const PIX_V2_EXPIRATION_SEC = 3600;
/** Abaixo disso a cobrança ativa não é exibida (QR que expira durante o pagamento). */
export const PIX_V2_REUSE_MIN_REMAINING_MS = 120_000;
/** Folga para relógios diferentes (local × Efí) ao concluir que uma cobrança venceu. */
export const PIX_V2_EXPIRY_MARGIN_MS = 120_000;
export const PIX_V2_TXID_RE = /^[a-zA-Z0-9]{26,35}$/;
const TXID_PREFIX = "shc";
const MAX_ROUNDS = 6;

/** Status em que o txid pode existir na Efí e a cobrança pode estar pagável. */
const LIVE_STATUSES = ["creating", "pending", "blocked", "failed"];

/** Recusas da Efí que comprovam que a cobrança não foi criada (validação do pedido). */
const DEFINITIVE_REJECTIONS = new Set([
  "valor_invalido",
  "chave_invalida",
  "documento_bloqueado",
  "txid_invalido",
  "json_invalido",
  "calendario_invalido",
  "solicitacao_pagador_invalida"
]);

type AttemptSummary = {
  chargeVersion?: string;
  source?: string;
  configId?: number | null;
  slot?: string | null;
  efiEnvironment?: string;
  commit?: string | null;
  expiracao?: number;
  expiresAt?: string | null;
  locId?: number | string | null;
  /** A cobrança pode existir na Efí (falha com resultado incerto). */
  outcomeUnknown?: boolean;
  blockedReason?: string | null;
  invoiceClosedDuringCheckout?: string | null;
};

export type PixChargeV2Result = {
  txid: string;
  status: string;
  valor: { original: string };
  calendario: { expiracao: number };
  qrcode: { qrcode: string; imagemQrcode?: string };
  expiresAt: string;
  expiresInSeconds: number;
  reused: boolean;
};

/** txid local, um por tentativa (R-4): `shc` + fatura(10) + tentativa(10) + aleatório(8) = 31. */
export function buildPixV2Txid(
  invoiceId: number,
  attemptId: number,
  random: string = crypto.randomBytes(4).toString("hex")
): string {
  const txid = `${TXID_PREFIX}${String(invoiceId).padStart(10, "0")}${String(attemptId).padStart(10, "0")}${random}`;
  if (!PIX_V2_TXID_RE.test(txid)) {
    throw new AppError("ERR_PIX_TXID_INVALID", 500, "txid local fora do formato da Efí.");
  }
  return txid;
}

/** Formato Efí `\d+\.\d{2}` (o legado usa toLocaleString, que quebra acima de 999,99). */
export function formatEfiAmount(value: number | string): string {
  return Number(value).toFixed(2);
}

const cents = (v: unknown): number => Math.round(Number(String(v ?? "").replace(",", ".")) * 100);

export function chargeMatchesInvoice(
  cob: EfiPixCob,
  invoice: { id: number; value: number | string },
  pixKey: string
): { ok: boolean; reason: string | null } {
  if (cents(cob.valor?.original) !== cents(invoice.value)) return { ok: false, reason: "valor" };
  if ((cob.chave || "") !== pixKey) return { ok: false, reason: "chave" };
  if (cob.solicitacaoPagador != null && cob.solicitacaoPagador !== `#Fatura:${invoice.id}`) {
    return { ok: false, reason: "solicitacaoPagador" };
  }
  return { ok: true, reason: null };
}

function summaryOf(attempt: SaaSPaymentAttempt): AttemptSummary {
  return (attempt.payloadSummary || {}) as AttemptSummary;
}

/** Expiração local: `expiresAt` gravado; senão criação + 1 h (D-P5, cobranças legadas). */
export function attemptExpiresAtMs(attempt: SaaSPaymentAttempt): number {
  const s = summaryOf(attempt);
  const fromSummary = s.expiresAt ? Date.parse(s.expiresAt) : NaN;
  if (Number.isFinite(fromSummary)) return fromSummary;
  return new Date(attempt.createdAt).getTime() + PIX_V2_EXPIRATION_SEC * 1000;
}

/** Vencimento pelo relógio da Efí (`criacao + expiracao`); null se a Efí não informou. */
function efiExpiresAtMs(cob: EfiPixCob): number | null {
  const criacao = cob.calendario?.criacao ? Date.parse(cob.calendario.criacao) : NaN;
  const exp = Number(cob.calendario?.expiracao);
  return Number.isFinite(criacao) && Number.isFinite(exp) ? criacao + exp * 1000 : null;
}

/** Tentativa ainda pode ter cobrança pagável na Efí. */
function isLive(attempt: SaaSPaymentAttempt): boolean {
  if (!LIVE_STATUSES.includes(attempt.status)) return false;
  return attempt.status !== "failed" || summaryOf(attempt).outcomeUnknown === true;
}

const sameContext = (s: AttemptSummary, ctx: EfiPixChargeContext): boolean =>
  // Tentativas legadas (antes da v2) não gravavam fonte: são da conta env.
  (s.source || "legacy_env") === ctx.source && (s.configId ?? null) === ctx.configId;

function blocked(code: string, message: string, untilMs: number | null): AppError {
  const retryAfterSec = untilMs ? Math.max(1, Math.ceil((untilMs - Date.now()) / 1000)) : null;
  return new AppError(code, 409, message, retryAfterSec ? { retryAfterSec } : undefined);
}

function assertInvoicePayable(invoice: Invoices | null, companyId: number): Invoices {
  if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);
  if (invoice.companyId !== companyId) throw new AppError("ERR_FORBIDDEN_INVOICE", 403);
  const status = String(invoice.status).toLowerCase();
  if (status === "paid") throw new AppError("ERR_INVOICE_ALREADY_PAID", 400);
  if (status === "cancelled") throw new AppError("ERR_INVOICE_CANCELLED", 400);
  return invoice;
}

type InvoiceSnapshot = { id: number; value: number | string; companyId: number };
type Plan =
  /** Tentativa nova: PUT direto. */
  | { mode: "create"; attempt: SaaSPaymentAttempt }
  /** Tentativa viva dentro do prazo local: conferir (e recuperar se ainda não existir). */
  | { mode: "resolve"; attempt: SaaSPaymentAttempt }
  /** Tentativa viva vencida pelo prazo local: GET conclusivo antes de abandonar. */
  | { mode: "confirmExpiry"; attempt: SaaSPaymentAttempt };

/** Passo 1: decisão e reserva sob lock da fatura. Nenhuma chamada Efí aqui. */
async function reserve(
  invoiceId: number,
  companyId: number,
  ctx: EfiPixChargeContext
): Promise<{ invoice: InvoiceSnapshot; plan: Plan }> {
  return sequelize.transaction(async transaction => {
    const invoice = assertInvoicePayable(
      await Invoices.findByPk(invoiceId, { transaction, lock: transaction.LOCK.UPDATE }),
      companyId
    );
    const snapshot = { id: invoice.id, value: invoice.value, companyId: invoice.companyId };
    const now = Date.now();

    const live = (
      await SaaSPaymentAttempt.findAll({
        where: {
          invoiceId,
          method: "pix",
          externalTxid: { [Op.not]: null },
          status: { [Op.in]: LIVE_STATUSES }
        },
        order: [["id", "DESC"]],
        limit: 50,
        transaction
      })
    ).filter(isLive);

    const attempt = live[0];
    if (attempt) {
      const localExpiry = attemptExpiresAtMs(attempt);
      if (now >= localExpiry + PIX_V2_EXPIRY_MARGIN_MS) {
        return { invoice: snapshot, plan: { mode: "confirmExpiry", attempt } };
      }
      if (now >= localExpiry - PIX_V2_REUSE_MIN_REMAINING_MS) {
        throw blocked(
          "ERR_PIX_CHARGE_EXPIRING",
          "A cobrança Pix atual está expirando. Aguarde alguns instantes e tente novamente.",
          localExpiry + PIX_V2_EXPIRY_MARGIN_MS
        );
      }
      if (!sameContext(summaryOf(attempt), ctx)) {
        throw blocked(
          "ERR_PIX_CHARGE_CREDENTIALS_CHANGED",
          "Há uma cobrança Pix aberta criada com outra credencial Efí. Aguarde a expiração.",
          localExpiry + PIX_V2_EXPIRY_MARGIN_MS
        );
      }
      return { invoice: snapshot, plan: { mode: "resolve", attempt } };
    }

    const summary: AttemptSummary = {
      chargeVersion: "v2",
      source: ctx.source,
      configId: ctx.configId,
      slot: ctx.slot,
      efiEnvironment: ctx.efiEnvironment,
      commit: getAppBuildCommit(),
      expiracao: PIX_V2_EXPIRATION_SEC,
      // Prazo local conservador desde a reserva; o passo 3 grava o da Efí.
      expiresAt: new Date(now + PIX_V2_EXPIRATION_SEC * 1000).toISOString()
    };
    const created = await SaaSPaymentAttempt.create(
      {
        companyId: invoice.companyId,
        invoiceId,
        method: "pix",
        status: "creating",
        gatewayProvider: "efi",
        amount: Number(invoice.value),
        payloadSummary: summary as Record<string, unknown>
      },
      { transaction }
    );
    created.externalTxid = buildPixV2Txid(invoiceId, created.id);
    await created.save({ transaction });
    return { invoice: snapshot, plan: { mode: "create", attempt: created } };
  });
}

/**
 * Atualiza a tentativa só a partir dos status permitidos: um pedido concorrente nunca rebaixa
 * o que outro já gravou (ex.: `failed` por cima de `pending`, `pending` por cima de `completed`).
 */
async function transition(
  attemptId: number,
  from: string[],
  patch: { status?: string; summary?: AttemptSummary; errorMessage?: string | null; gatewayStatus?: string },
  transaction?: Transaction
): Promise<boolean> {
  const run = async (t: Transaction) => {
    const attempt = await SaaSPaymentAttempt.findByPk(attemptId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!attempt || !from.includes(attempt.status)) return false;
    if (patch.status) attempt.status = patch.status;
    if (patch.gatewayStatus) attempt.gatewayStatus = patch.gatewayStatus;
    if (patch.summary) {
      attempt.payloadSummary = { ...summaryOf(attempt), ...patch.summary } as Record<string, unknown>;
    }
    if (patch.errorMessage !== undefined) attempt.errorMessage = patch.errorMessage;
    await attempt.save({ transaction: t });
    return true;
  };
  return transaction ? run(transaction) : sequelize.transaction(run);
}

function cobBody(invoice: { id: number; value: number | string }, pixKey: string): EfiPixCobBody {
  return {
    calendario: { expiracao: PIX_V2_EXPIRATION_SEC },
    valor: { original: formatEfiAmount(invoice.value) },
    chave: pixKey,
    // RF2.4a: o pipeline legado localiza a fatura por este texto após um rollback.
    solicitacaoPagador: `#Fatura:${invoice.id}`
  };
}

/** PUT com o txid da tentativa; 409 → GET. Erro do PUT só é "não criada" se for recusa de validação. */
async function putOrFetch(
  gateway: EfiPixChargeGateway,
  txid: string,
  invoice: InvoiceSnapshot
): Promise<EfiPixCob> {
  try {
    return await gateway.putCharge(txid, cobBody(invoice, gateway.context.pixKey));
  } catch (err) {
    if ((err as AppError).message !== "ERR_EFI_PIX_TXID_CONFLICT") throw err;
    const existing = await gateway.getCharge(txid);
    if (!existing) throw err;
    return existing;
  }
}

function putMayHaveCreated(err: unknown): boolean {
  const e = err as AppError;
  if (isEfiPixRetryable(err)) return true;
  if (e?.message === "ERR_EFI_PIX_TXID_CONFLICT") return true;
  const nome = (e?.data as any)?.efiNome;
  // Só uma recusa de validação conhecida prova que nada foi criado.
  return !(e?.message === "ERR_EFI_PIX_REJECTED" && typeof nome === "string" && DEFINITIVE_REJECTIONS.has(nome));
}

async function qrFor(
  gateway: EfiPixChargeGateway,
  cob: EfiPixCob
): Promise<{ qrcode: string; imagemQrcode?: string }> {
  if (cob.pixCopiaECola) return { qrcode: cob.pixCopiaECola };
  if (cob.loc?.id != null) {
    const qr = await gateway.qrCode(cob.loc.id);
    if (qr?.qrcode) return { qrcode: qr.qrcode, imagemQrcode: qr.imagemQrcode };
  }
  throw new AppError("ERR_PIX_QRCODE_UNAVAILABLE", 502, "A Efí não devolveu o código Pix da cobrança.");
}

function failureMessage(err: unknown): string {
  const e = err as AppError;
  return String(e?.clientMessage || e?.message || "falha").slice(0, 240);
}

const logCtx = (invoice: InvoiceSnapshot, attempt: SaaSPaymentAttempt) => ({
  invoiceId: invoice.id,
  companyId: invoice.companyId,
  attemptId: attempt.id,
  txidSuffix: String(attempt.externalTxid || "").slice(-6)
});

/**
 * Checkout Pix v2: cria ou reusa a cobrança da fatura. Só chamado com
 * `isEfiPixChargeV2Active()`; o default continua no fluxo legado do controller.
 */
export async function createOrReusePixChargeV2(input: {
  invoiceId: number;
  companyId: number;
}): Promise<PixChargeV2Result> {
  const gateway = await getEfiPixChargeGateway();
  const ctx = gateway.context;

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const { invoice, plan } = await reserve(input.invoiceId, input.companyId, ctx);
    const { attempt } = plan;
    const txid = attempt.externalTxid as string;
    const liveStatuses = LIVE_STATUSES;

    // Passo 2 — fora de lock.
    let cob: EfiPixCob | null;
    try {
      if (plan.mode === "create") {
        cob = await putOrFetch(gateway, txid, invoice);
      } else {
        // RF2.3: tentativa existente → GET antes de qualquer criação.
        cob = await gateway.getCharge(txid);
        const mayBeMissing = attempt.status === "creating" || attempt.status === "failed";
        if (!cob && plan.mode === "resolve" && mayBeMissing) {
          cob = await putOrFetch(gateway, txid, invoice); // mesmo txid: nunca duplica
        }
      }
    } catch (err) {
      const mayExist = plan.mode !== "create" || putMayHaveCreated(err);
      // Só rebaixa tentativas ainda não concluídas por outro pedido.
      await transition(attempt.id, ["creating", "failed"], {
        status: "failed",
        summary: { outcomeUnknown: mayExist },
        errorMessage: failureMessage(err)
      });
      logger.warn(
        { ...logCtx(invoice, attempt), code: (err as AppError).message, mayExist },
        "[pixV2] falha na Efí"
      );
      throw err;
    }

    const status = String(cob?.status || "").toUpperCase();
    const efiExpiry = cob ? efiExpiresAtMs(cob) : null;
    const efiExpired = efiExpiry !== null && Date.now() >= efiExpiry + PIX_V2_EXPIRY_MARGIN_MS;

    if (!cob) {
      if (plan.mode === "confirmExpiry") {
        // Vencida localmente (com margem) e inexistente na conta: pode abandonar.
        await transition(attempt.id, liveStatuses, { status: "expired", summary: { blockedReason: "not_found_after_expiry" } });
        continue;
      }
      // `pending`/`blocked` sem cobrança visível na conta atual: não dá para conferir.
      await transition(attempt.id, liveStatuses, { summary: { blockedReason: "not_found" } });
      throw blocked(
        "ERR_PIX_CHARGE_NOT_VERIFIABLE",
        "A cobrança Pix aberta não pôde ser conferida na Efí. Aguarde a expiração ou contate o suporte.",
        attemptExpiresAtMs(attempt) + PIX_V2_EXPIRY_MARGIN_MS
      );
    }

    if (status === "CONCLUIDA") {
      // Paga na Efí e ainda não baixada: nunca gerar outra (pagamento em dobro).
      await transition(attempt.id, liveStatuses, { gatewayStatus: status, summary: { blockedReason: "concluida" } });
      logger.warn(logCtx(invoice, attempt), "[pixV2] cobrança paga aguardando confirmação — nova cobrança bloqueada");
      throw new AppError(
        "ERR_PIX_CHARGE_ALREADY_PAID",
        409,
        "Esta cobrança Pix já foi paga e está em confirmação. Aguarde alguns instantes."
      );
    }
    if (status.startsWith("REMOVIDA") || (status === "ATIVA" && efiExpired)) {
      await transition(attempt.id, liveStatuses, { status: "expired", gatewayStatus: status, summary: { blockedReason: status.startsWith("REMOVIDA") ? status : "efi_expired" } });
      continue; // removida ou vencida na Efí: pode criar outra (D-P4)
    }

    if (efiExpiry === null && plan.mode === "confirmExpiry") {
      // Sem `calendario` não dá para saber se ainda é pagável: bloqueia em vez de reusar ou abandonar.
      await transition(attempt.id, liveStatuses, { summary: { blockedReason: "sem_calendario" } });
      throw blocked(
        "ERR_PIX_CHARGE_NOT_VERIFIABLE",
        "A cobrança Pix aberta não pôde ser conferida na Efí. Contate o suporte.",
        null
      );
    }

    const match = chargeMatchesInvoice(cob, invoice, ctx.pixKey);
    const efiRemaining = efiExpiry !== null ? efiExpiry - Date.now() : null;
    if (status !== "ATIVA" || !match.ok || (efiRemaining !== null && efiRemaining < PIX_V2_REUSE_MIN_REMAINING_MS)) {
      const reason = status !== "ATIVA" ? `status:${status}` : !match.ok ? match.reason : "expirando";
      // Cobrança viva que não serve: fica `blocked` (viva) até vencer na Efí.
      await transition(attempt.id, liveStatuses, {
        status: "blocked",
        gatewayStatus: status || undefined,
        summary: {
          blockedReason: reason,
          outcomeUnknown: false,
          ...(efiExpiry !== null ? { expiresAt: new Date(efiExpiry).toISOString() } : {})
        }
      });
      logger.warn({ ...logCtx(invoice, attempt), reason }, "[pixV2] cobrança aberta não reutilizável — nova bloqueada até vencer");
      throw blocked(
        reason === "expirando" ? "ERR_PIX_CHARGE_EXPIRING" : "ERR_PIX_CHARGE_DIVERGENT",
        reason === "expirando"
          ? "A cobrança Pix atual está expirando. Aguarde alguns instantes e tente novamente."
          : "Há uma cobrança Pix aberta que não confere com a fatura. Aguarde a expiração ou contate o suporte.",
        (efiExpiry ?? attemptExpiresAtMs(attempt)) + PIX_V2_EXPIRY_MARGIN_MS
      );
    }

    const expiresAtMs = efiExpiry ?? attemptExpiresAtMs(attempt);
    const qrcode = await qrFor(gateway, cob);

    // Passo 3 — grava e revalida a fatura, sob lock.
    const outcome = await sequelize.transaction(async transaction => {
      const fresh = await Invoices.findByPk(invoice.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!fresh) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);
      const freshStatus = String(fresh.status).toLowerCase();
      const closed = freshStatus === "paid" || freshStatus === "cancelled" ? freshStatus : null;
      const valueChanged = cents(fresh.value) !== cents(invoice.value);
      // A cobrança existe e é pagável: a tentativa fica registrada mesmo se a fatura mudou.
      const recorded = await transition(
        attempt.id,
        liveStatuses,
        {
          status: "pending",
          gatewayStatus: status,
          errorMessage: null,
          summary: {
            expiresAt: new Date(expiresAtMs).toISOString(),
            locId: cob?.loc?.id ?? null,
            outcomeUnknown: false,
            blockedReason: valueChanged ? "valor_fatura_alterado" : null,
            invoiceClosedDuringCheckout: closed
          }
        },
        transaction
      );
      // Outro pedido já concluiu/abandonou a tentativa: não expor este QR.
      if (!recorded) return { closed, valueChanged, superseded: true };
      if (!closed && !valueChanged) {
        await fresh.update(
          { externalTxid: txid, gatewayProvider: "efi", gatewayStatus: status, gatewaySyncStatus: "pending" },
          { transaction }
        );
      }
      return { closed, valueChanged, superseded: false };
    });

    // RF2.2 passo 3: fatura paga/cancelada no intervalo → QR não exibido.
    if (outcome.closed === "paid") throw new AppError("ERR_INVOICE_ALREADY_PAID", 400);
    if (outcome.closed === "cancelled") throw new AppError("ERR_INVOICE_CANCELLED", 400);
    if (outcome.superseded) continue; // relê o estado na próxima rodada
    if (outcome.valueChanged) {
      throw blocked(
        "ERR_PIX_CHARGE_DIVERGENT",
        "O valor da fatura mudou durante a geração do Pix. Aguarde a expiração da cobrança.",
        expiresAtMs + PIX_V2_EXPIRY_MARGIN_MS
      );
    }

    return {
      txid,
      status,
      valor: { original: formatEfiAmount(invoice.value) },
      calendario: { expiracao: PIX_V2_EXPIRATION_SEC },
      qrcode,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresInSeconds: Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)),
      reused: plan.mode !== "create" && attempt.status === "pending"
    };
  }
  throw new AppError("ERR_PIX_CHARGE_UNAVAILABLE", 502, "Não foi possível gerar a cobrança Pix. Tente novamente.");
}
