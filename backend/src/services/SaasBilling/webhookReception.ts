import crypto from "crypto";
import { Request } from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { logger } from "../../utils/logger";
import { getEfiActivationControls } from "../../config/saasBillingFlags";
import { getEfiFinancialCredentialsSource } from "./efiFinancialSource";
import { getEfiRuntimeCredentials } from "./efiRuntimeCredentials";
import { publishGatewayWebhookEvent } from "../../libs/gatewayWebhookQueue";
import type {
  GatewayWebhookEventStatus,
  GatewayWebhookEventType
} from "../../models/SaaSGatewayWebhookEvent";

/**
 * Recepção durável do webhook Pix Efí — pipeline `async` (B3.3, D-P18, RF3.1–RF3.6, R-22…R-24).
 *
 * autenticar → validar a forma → gravar cada item numa transação
 * (`INSERT … ON CONFLICT ("eventKey") DO NOTHING`) → commit → HTTP 200 → publicar jobs.
 * Nenhuma chamada à Efí e nenhuma dependência do Redis antes do 200. O 200 significa
 * recebimento durável, não pagamento processado.
 *
 * Contrato da notificação (dev.efipay.com.br/docs/api-pix/webhooks, conferido em 2026-10-21):
 * `{ pix: [{ endToEndId, txid, chave, valor, horario, infoPagador, gnExtras, devolucoes[] }] }`,
 * devoluções `{ id, rtrId, valor, natureza, horario.solicitacao, status }`; o cadastro dispara
 * uma notificação de teste (`evento: "teste_webhook"`). Persistimos só o mínimo (R-31):
 * nada de `infoPagador`, `gnExtras` (nome/CPF/conta do pagador), cabeçalhos ou query.
 */

/** Parâmetro novo do token (D-P3, PT-5): nome provisório adotado na B3.2. */
export const WEBHOOK_TOKEN_PARAM = "whToken";
/** Teto de itens por notificação: lote maior que isso não é um envio da Efí. */
export const WEBHOOK_MAX_ITEMS = 1000;
/** Teto de eventos por notificação (itens + devoluções), limite da transação única. */
export const WEBHOOK_MAX_EVENTS = 2000;

const E2E_RE = /^[A-Za-z0-9]{1,64}$/;
const TXID_RE = /^[a-zA-Z0-9]{1,35}$/;
const AMOUNT_RE = /^\d{1,10}\.\d{2}$/;
const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
const STATUS_RE = /^[A-Z_]{1,40}$/;

export type ReceptionResult = { status: number; body: Record<string, unknown> };

export type ParsedWebhookEvent = {
  eventKey: string;
  eventType: GatewayWebhookEventType;
  status: GatewayWebhookEventStatus;
  txid: string | null;
  endToEndId: string | null;
  devolucaoId: string | null;
  amount: string | null;
  payload: Record<string, unknown>;
  /** Classificação já na recepção (itens inválidos e `teste`): terminal, sem job. */
  result?: Record<string, unknown>;
};

const sha256 = (v: string | Buffer): string => crypto.createHash("sha256").update(v).digest("hex");

/** Comparação em tempo constante (S3): compara os hashes, então o tamanho não vaza. */
export function constantTimeEquals(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Secret da fonte financeira efetiva (RF3.1): env no `legacy_env`, slot no `database`.
 * No `database` usa a finalidade `database` (B3-FIX01): mesmo slot do runtime e mesma regra D-P2,
 * sem exigir a homologação — cadastro, recepção do `teste` e conferência do `homologate` são
 * pré-requisitos dela. Só autentica: cobrança e processamento seguem na finalidade `financial`.
 */
export async function getExpectedWebhookSecret(): Promise<{
  secret: string | null;
  source: string;
}> {
  const source = getEfiFinancialCredentialsSource();
  if (source === "database") {
    const creds = await getEfiRuntimeCredentials("database");
    return { secret: creds.webhookSecret, source };
  }
  const env = (process.env.WEBHOOK_SUBSCRIPTION_SECRET || "").trim();
  return { secret: env || null, source };
}

/**
 * Autenticação: `whToken` (novo), `token` (transição) e `Authorization: Bearer`. A Efí acrescenta
 * `/pix` ao fim da URL cadastrada; sem `ignorar=`, o sufixo cai no último parâmetro
 * (`token=<secret>/pix`), por isso cada parâmetro vale também sem `/pix`.
 * Devolve qual forma autenticou (só o nome, nunca o valor): evidência do contrato real da URL em
 * sandbox (PT-2/PT-5). `whToken` = formato novo; `token_pix_suffix` = `/pix` caiu no token.
 * `null` = nenhum candidato confere. Compara todos os candidatos (sem curto-circuito).
 */
export function matchWebhookToken(
  req: Pick<Request, "query" | "headers">,
  secret: string | null
): string | null {
  if (!secret) return null;
  const labeled: Array<[string, string]> = [];
  for (const name of [WEBHOOK_TOKEN_PARAM, "token"]) {
    const v = (req.query as any)?.[name];
    if (typeof v === "string" && v !== "") {
      labeled.push([name, v]);
      if (v.endsWith("/pix")) labeled.push([`${name}_pix_suffix`, v.slice(0, -4)]);
    }
  }
  const auth = req.headers?.authorization;
  if (typeof auth === "string") {
    const bearer = auth.replace(/^Bearer\s+/i, "").trim();
    if (bearer) labeled.push(["bearer", bearer]);
  }
  let via: string | null = null;
  for (const [label, value] of labeled) {
    if (constantTimeEquals(value, secret) && via === null) via = label;
  }
  return via;
}

/** Allowlist de IP opcional (RF3.1): só vale com `TRUST_PROXY_HOPS`, senão `req.ip` é o do proxy. */
export function webhookIpAllowlist(): string[] | null {
  const raw = (process.env.EFI_WEBHOOK_IP_ALLOWLIST || "").trim();
  if (!raw || getEfiActivationControls().trustProxyHops === null) return null;
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Rate limit por IP real (S5), em memória por processo, contando só falhas de autenticação:
 * lixo sem token não consome a cota de quem autentica (a Efí nunca é barrada por um atacante).
 * Só vale com TRUST_PROXY_HOPS; sem ele `req.ip` é o do proxy e o limite fica com o nginx.
 */
export const WEBHOOK_RATE_LIMIT_PER_MINUTE = 600;
const RATE_WINDOW_MS = 60000;
const rateBuckets = new Map<string, { windowStart: number; count: number }>();

function pruneRateBuckets(now: number): void {
  for (const [ip, b] of rateBuckets) if (now - b.windowStart >= RATE_WINDOW_MS) rateBuckets.delete(ip);
}

/** Registra uma falha de autenticação; devolve se o IP ainda está abaixo do limite. */
export function checkWebhookRateLimit(ip: string, now = Date.now()): boolean {
  const b = rateBuckets.get(ip);
  if (!b || now - b.windowStart >= RATE_WINDOW_MS) {
    if (rateBuckets.size > 10000) pruneRateBuckets(now);
    rateBuckets.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  b.count += 1;
  return b.count <= WEBHOOK_RATE_LIMIT_PER_MINUTE;
}

export function isWebhookRateLimited(ip: string, now = Date.now()): boolean {
  const b = rateBuckets.get(ip);
  return !!b && now - b.windowStart < RATE_WINDOW_MS && b.count > WEBHOOK_RATE_LIMIT_PER_MINUTE;
}

export function resetWebhookRateLimitForTests(): void {
  rateBuckets.clear();
}

const str = (v: unknown, re: RegExp): string | null =>
  typeof v === "string" && re.test(v.trim()) ? v.trim() : null;

const isoOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : null;

export function maskChave(chave: unknown): string | null {
  if (typeof chave !== "string" || !chave) return null;
  return chave.length <= 4 ? "****" : `****${chave.slice(-4)}`;
}

/** Evidência mínima de um item inválido: nada além de campos já validados. */
function invalidEvidence(item: unknown, reason: string): ParsedWebhookEvent {
  const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const txid = str(o.txid, TXID_RE);
  const e2e = str(o.endToEndId, E2E_RE);
  const amount = str(o.valor, AMOUNT_RE);
  let canonical: string;
  try {
    canonical = JSON.stringify({ txid: o.txid, e2e: o.endToEndId, valor: o.valor, horario: o.horario, reason });
  } catch {
    canonical = reason;
  }
  return {
    eventKey: `invalido:${sha256(canonical)}`,
    eventType: "invalido",
    status: "invalid_permanent",
    result: { reason },
    txid,
    endToEndId: e2e,
    devolucaoId: null,
    amount,
    payload: {
      reason,
      txid,
      endToEndId: e2e,
      valor: amount,
      horario: isoOrNull(o.horario),
      chaveMasked: maskChave(o.chave)
    }
  };
}

/**
 * Converte o corpo em eventos. `null` = corpo sem estrutura reconhecível (400, RF3.2).
 * Item inválido dentro do lote vira `invalid_permanent` e não derruba o lote.
 */
export function parseWebhookBody(body: unknown): ParsedWebhookEvent[] | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const events: ParsedWebhookEvent[] = [];

  if (b.pix === undefined) {
    if (typeof b.evento !== "string" || b.evento.length > 64) return null;
    // Notificação de teste do cadastro (PT-7): evidência de homologação (RF1.7).
    const canonical = JSON.stringify({ evento: b.evento, data_criacao: b.data_criacao ?? null });
    return [
      {
        eventKey: `teste:${sha256(canonical)}`,
        eventType: "teste",
        // RF3.10: `teste` → `ignored_not_saas` (tipo teste), evidência de homologação.
        status: "ignored_not_saas",
        result: { type: "teste" },
        txid: null,
        endToEndId: null,
        devolucaoId: null,
        amount: null,
        payload: { evento: b.evento.slice(0, 64) }
      }
    ];
  }
  if (!Array.isArray(b.pix) || b.pix.length === 0 || b.pix.length > WEBHOOK_MAX_ITEMS) return null;

  for (const item of b.pix) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      events.push(invalidEvidence(item, "item_not_object"));
      continue;
    }
    const o = item as Record<string, unknown>;
    const e2e = str(o.endToEndId, E2E_RE);
    if (!e2e) {
      events.push(invalidEvidence(o, "endToEndId_invalid"));
      continue;
    }
    const amount = str(o.valor, AMOUNT_RE);
    const txidRaw = o.txid;
    const txid = str(txidRaw, TXID_RE);
    const txidInvalid = txidRaw !== undefined && txidRaw !== null && txidRaw !== "" && !txid;
    const chave = typeof o.chave === "string" ? o.chave : null;
    const devolucoes = Array.isArray(o.devolucoes) ? o.devolucoes.slice(0, 20) : [];
    const devSummary = devolucoes
      .filter(d => d && typeof d === "object")
      .map((d: any) => ({
        id: str(d.id, ID_RE),
        rtrId: str(d.rtrId, ID_RE),
        valor: str(d.valor, AMOUNT_RE),
        status: str(d.status, STATUS_RE),
        natureza: str(d.natureza, STATUS_RE)
      }));
    events.push({
      eventKey: `pix:${e2e}`,
      eventType: "pix",
      status: "received",
      txid,
      endToEndId: e2e,
      devolucaoId: null,
      amount,
      payload: {
        endToEndId: e2e,
        txid,
        txidInvalid,
        valor: amount,
        horario: isoOrNull(o.horario),
        chaveMasked: maskChave(chave),
        // Hash (não o valor) da chave recebedora: o worker confere com a chave do slot.
        chaveHash: chave ? sha256(chave) : null,
        tipo: str(o.tipo, /^[A-Z_]{1,40}$/),
        devolucoes: devSummary
      }
    });
    for (const d of devSummary) {
      if (!d.id || !d.status) continue;
      events.push({
        eventKey: `devolucao:${e2e}:${d.id}:${d.status}`,
        eventType: "devolucao",
        status: "received",
        txid,
        endToEndId: e2e,
        devolucaoId: d.id,
        amount: d.valor,
        payload: { endToEndId: e2e, txid, devolucao: d }
      });
    }
  }
  return events.length > WEBHOOK_MAX_EVENTS ? null : events;
}

/**
 * Grava os eventos numa única transação. Lança em qualquer falha: nenhuma linha parcial
 * (RF3.4). Devolve só as linhas novas (reentrega = `ON CONFLICT DO NOTHING`).
 */
export async function persistWebhookEvents(
  events: ParsedWebhookEvent[],
  credentialsSource: string
): Promise<Array<{ id: number; status: string; attempts: number }>> {
  return sequelize.transaction(async t => {
    const created: Array<{ id: number; status: string; attempts: number }> = [];
    for (const e of events) {
      const terminal = e.status !== "received";
      const rows = await sequelize.query<{ id: number; status: string; attempts: number }>(
        `INSERT INTO "SaaSGatewayWebhookEvents"
           ("provider","eventKey","eventType","status","txid","endToEndId","devolucaoId","amount",
            "credentialsSource","payload","result","attempts","nextAttemptAt","attemptLog","adminActions",
            "receivedAt","processedAt","createdAt","updatedAt")
         VALUES ('efi', :eventKey, :eventType, :status, :txid, :e2e, :devolucaoId, :amount,
            :source, CAST(:payload AS jsonb), CAST(:result AS jsonb), 0, now(), '[]'::jsonb, '[]'::jsonb,
            now(), ${terminal ? "now()" : "NULL"}, now(), now())
         ON CONFLICT ("eventKey") DO NOTHING
         RETURNING id, status, attempts`,
        {
          type: QueryTypes.SELECT,
          transaction: t,
          replacements: {
            eventKey: e.eventKey,
            eventType: e.eventType,
            status: e.status,
            txid: e.txid,
            e2e: e.endToEndId,
            devolucaoId: e.devolucaoId,
            amount: e.amount,
            source: credentialsSource,
            payload: JSON.stringify(e.payload),
            result: e.result ? JSON.stringify(e.result) : null
          }
        }
      );
      if (rows[0]) created.push(rows[0]);
    }
    return created;
  });
}

/**
 * Recepção completa. `publish=false` só em teste. Erros de persistência → 503; o chamador
 * nunca recebe 200 sem as linhas commitadas.
 */
export async function receiveGatewayWebhook(
  req: Pick<Request, "query" | "headers" | "body" | "ip">
): Promise<ReceptionResult & { createdIds: number[]; afterResponse: () => Promise<void> }> {
  const noop = async () => undefined;
  const ip = String(req.ip || "unknown");
  const allow = webhookIpAllowlist();
  if (allow && !allow.includes(ip)) {
    logger.warn({ ip }, "[webhook:async] ip fora da allowlist");
    return { status: 403, body: { error: "ERR_WEBHOOK_FORBIDDEN" }, createdIds: [], afterResponse: noop };
  }
  const rateLimited = getEfiActivationControls().trustProxyHops !== null;
  if (rateLimited && isWebhookRateLimited(ip)) {
    return { status: 429, body: { error: "ERR_WEBHOOK_RATE_LIMIT" }, createdIds: [], afterResponse: noop };
  }

  let expected: { secret: string | null; source: string };
  try {
    expected = await getExpectedWebhookSecret();
  } catch (err) {
    // Credencial da fonte indisponível: 503 para a Efí reenviar; nada persistido.
    logger.error({ code: (err as any)?.message }, "[webhook:async] secret da fonte indisponível");
    return { status: 503, body: { error: "ERR_WEBHOOK_UNAVAILABLE" }, createdIds: [], afterResponse: noop };
  }
  const authVia = matchWebhookToken(req, expected.secret);
  if (!authVia) {
    if (rateLimited) checkWebhookRateLimit(ip);
    logger.warn({ ip, source: expected.source }, "[webhook:async] token inválido ou ausente");
    return { status: 401, body: { error: "ERR_WEBHOOK_UNAUTHORIZED" }, createdIds: [], afterResponse: noop };
  }

  const parsed = parseWebhookBody(req.body);
  if (!parsed) {
    return { status: 400, body: { error: "ERR_WEBHOOK_INVALID_BODY" }, createdIds: [], afterResponse: noop };
  }
  const events = parsed.map(e => ({ ...e, payload: { ...e.payload, authVia } }));

  let created: Array<{ id: number; status: string; attempts: number }>;
  try {
    created = await persistWebhookEvents(events, expected.source);
  } catch (err) {
    logger.error(
      { err: (err as Error)?.name, items: events.length },
      "[webhook:async] persistência falhou — 503 para a Efí reenviar"
    );
    return { status: 503, body: { error: "ERR_WEBHOOK_PERSIST_FAILED" }, createdIds: [], afterResponse: noop };
  }

  logger.info(
    {
      items: events.length,
      created: created.length,
      authVia,
      ids: created.map(c => c.id),
      txidSuffixes: events.map(e => (e.txid ? e.txid.slice(-6) : null)),
      e2eSuffixes: events.map(e => (e.endToEndId ? e.endToEndId.slice(-6) : null))
    },
    "[webhook:async] recebido"
  );

  const toPublish = created.filter(c => c.status === "received");
  return {
    status: 200,
    // Só "recebido": não afirma pagamento processado (RF3.4, T-ASY-20).
    body: { ok: true, received: true },
    createdIds: created.map(c => c.id),
    afterResponse: async () => {
      for (const c of toPublish) await publishGatewayWebhookEvent(c.id, c.attempts);
    }
  };
}
