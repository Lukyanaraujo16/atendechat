import Gerencianet from "gn-api-sdk-typescript";
import AppError from "../../errors/AppError";
import options from "../../config/Gn";
import { saasBillingFlags } from "../../config/saasBillingFlags";
import type {
  PlatformEfiEnvironment,
  PlatformEfiSlot
} from "../../models/PlatformEfiConfig";
import type { EfiCredentialsSource } from "../../config/saasBillingFlags";
import { createEfiPixClient, EFI_PIX_REQUEST_TIMEOUT_MS } from "./efiPixClient";
import { getEfiFinancialCredentialsSource } from "./efiFinancialSource";
import { getEfiRuntimeCredentials } from "./efiRuntimeCredentials";
import { redactEfiSensitiveText } from "./efiIntegrationStatus";

/**
 * Operações Pix da cobrança v2 (B3.2), pela fonte financeira efetiva (P-B31-08):
 * - `legacy_env`: SDK `gn-api-sdk-typescript` com `config/Gn.ts` (mesma conta do checkout atual);
 * - `database`: cliente próprio com mTLS em memória (D-P12). Só alcançável quando a fonte
 *   `database` for liberada para o financeiro.
 *
 * Contratos (dev.efipay.com.br/docs/api-pix/cobrancas-imediatas e /webhooks, PT-2/PT-3):
 * - `PUT /v2/cob/:txid` com txid já usado → 409 `txid_duplicado` (repetição idempotente com o
 *   mesmo corpo **não** é documentada: tratamos 409 como "pode ser nossa" → GET + comparação);
 * - `GET /v2/cob/:txid` → `status`, `valor.original`, `chave`, `calendario.{criacao,expiracao}`,
 *   `pixCopiaECola`, `loc`, `solicitacaoPagador`;
 * - erros `{ nome, mensagem }`.
 * Toda chamada tem teto de 20 s e erro tipado/sanitizado (RNF1/RNF2): o SDK não resolve a
 * promise em falha de rede sem resposta, por isso o teto é aplicado aqui.
 */

export type EfiPixChargeContext = {
  source: EfiCredentialsSource;
  configId: number | null;
  slot: PlatformEfiSlot | null;
  efiEnvironment: PlatformEfiEnvironment;
  configFingerprint: string | null;
  pixKey: string;
};

export type EfiPixCob = {
  txid: string;
  status: string;
  valor?: { original?: string };
  chave?: string;
  solicitacaoPagador?: string;
  calendario?: { criacao?: string; expiracao?: number | string };
  loc?: { id?: number | string };
  pixCopiaECola?: string;
  pix?: Array<{ endToEndId?: string; valor?: string; horario?: string }>;
};

export type EfiPixCobBody = {
  calendario: { expiracao: number };
  valor: { original: string };
  chave: string;
  solicitacaoPagador: string;
};

export type EfiPixWebhook = { webhookUrl?: string; chave?: string; criacao?: string };

export interface EfiPixChargeGateway {
  context: EfiPixChargeContext;
  putCharge(txid: string, body: EfiPixCobBody): Promise<EfiPixCob>;
  /** `null` quando a cobrança não existe na conta. */
  getCharge(txid: string): Promise<EfiPixCob | null>;
  qrCode(locId: number | string): Promise<{ qrcode?: string; imagemQrcode?: string }>;
  putWebhook(chave: string, webhookUrl: string): Promise<void>;
  /** `null` quando não há webhook cadastrado para a chave. */
  getWebhook(chave: string): Promise<EfiPixWebhook | null>;
}

/** Erro Efí já normalizado; `retryable` = resultado incerto (timeout, rede, 5xx, 429). */
export function efiPixOperationError(
  code: string,
  status: number,
  message: string,
  data: { retryable: boolean; efiNome?: string | null; efiStatus?: number | null }
): AppError {
  return new AppError(code, status, message, data);
}

export function isEfiPixRetryable(err: unknown): boolean {
  return Boolean((err as AppError)?.data && (err as any).data.retryable === true);
}

const NOT_FOUND_NAMES = /nao_encontrad|not_found|inexistente/;

function classifyEfiFailure(input: {
  timeout?: boolean;
  network?: boolean;
  httpStatus?: number | null;
  nome?: string | null;
  text: string;
}): AppError {
  const { httpStatus, nome } = input;
  if (input.timeout) {
    return efiPixOperationError("ERR_EFI_PIX_TIMEOUT", 504, "Timeout na API Pix Efí.", {
      retryable: true
    });
  }
  if (nome === "txid_duplicado" || httpStatus === 409) {
    return efiPixOperationError(
      "ERR_EFI_PIX_TXID_CONFLICT",
      409,
      "txid já utilizado em outra cobrança na Efí.",
      { retryable: false, efiNome: nome ?? null, efiStatus: httpStatus ?? null }
    );
  }
  const transient =
    input.network || httpStatus === 429 || (typeof httpStatus === "number" && httpStatus >= 500) ||
    nome === "erro_aplicacao";
  return efiPixOperationError(
    transient ? "ERR_EFI_PIX_UNAVAILABLE" : "ERR_EFI_PIX_REJECTED",
    502,
    `API Pix Efí: ${redactEfiSensitiveText(input.text)}`,
    { retryable: transient, efiNome: nome ?? null, efiStatus: httpStatus ?? null }
  );
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("deadline"), { __efiDeadline: true })), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/** O SDK rejeita com o corpo `{ nome, mensagem }` (sem status HTTP) ou com Error. */
function fromSdkError(err: any): AppError {
  if (err instanceof AppError) return err;
  if (err?.__efiDeadline) return classifyEfiFailure({ timeout: true, text: "timeout" });
  const nome = typeof err?.nome === "string" && /^[a-z_]{1,64}$/.test(err.nome) ? err.nome : null;
  const text = err?.mensagem || err?.message || err?.nome || "falha";
  return classifyEfiFailure({ nome, network: !nome, text: String(text) });
}

function fromClientError(err: any): AppError {
  const code = (err as AppError)?.message;
  if (code === "ERR_EFI_PIX_TIMEOUT") return classifyEfiFailure({ timeout: true, text: "timeout" });
  if (code === "ERR_EFI_PIX_NETWORK") return classifyEfiFailure({ network: true, text: err.clientMessage || code });
  const data = (err as AppError)?.data as any;
  if (data && typeof data.efiStatus === "number") {
    return classifyEfiFailure({
      httpStatus: data.efiStatus,
      nome: data.efiNome ?? null,
      text: err.clientMessage || code
    });
  }
  if (err instanceof AppError) return err;
  return classifyEfiFailure({ network: true, text: String(err?.message || err) });
}

function legacyGateway(): EfiPixChargeGateway {
  const pixKey = (process.env.GERENCIANET_PIX_KEY || "").trim();
  if (!pixKey) {
    throw new AppError("ERR_EFI_PIX_KEY_MISSING", 500, "GERENCIANET_PIX_KEY ausente.");
  }
  const sdk = () => Gerencianet(options) as any;
  const run = async <T>(call: () => Promise<T>): Promise<T> => {
    try {
      return await withDeadline(call(), EFI_PIX_REQUEST_TIMEOUT_MS);
    } catch (err) {
      throw fromSdkError(err);
    }
  };
  const notFoundToNull = async <T>(call: () => Promise<T>): Promise<T | null> => {
    try {
      return await run(call);
    } catch (err) {
      const nome = ((err as AppError).data as any)?.efiNome;
      if (typeof nome === "string" && NOT_FOUND_NAMES.test(nome)) return null;
      throw err;
    }
  };
  return {
    context: {
      source: "legacy_env",
      configId: null,
      slot: null,
      efiEnvironment: saasBillingFlags.gerencianetSandbox() ? "sandbox" : "production",
      configFingerprint: null,
      pixKey
    },
    putCharge: (txid, body) => run(() => sdk().pixCreateCharge({ txid }, body)),
    getCharge: txid => notFoundToNull(() => sdk().pixDetailCharge({ txid })),
    qrCode: locId => run(() => sdk().pixGenerateQRCode({ id: locId })),
    putWebhook: async (chave, webhookUrl) => {
      await run(() => sdk().pixConfigWebhook({ chave }, { webhookUrl }));
    },
    getWebhook: chave => notFoundToNull(() => sdk().pixDetailWebhook({ chave }))
  };
}

async function databaseGateway(): Promise<EfiPixChargeGateway> {
  const creds = await getEfiRuntimeCredentials("financial");
  if (creds.certificate.kind !== "memory" || !creds.pixKey) {
    throw new AppError("ERR_EFI_CONFIG_INCOMPLETE", 400, "Configuração Efí do banco incompleta.");
  }
  const client = createEfiPixClient({
    efiEnvironment: creds.efiEnvironment,
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    pfx: creds.certificate.pfx,
    tokenCacheKey: creds.tokenCacheKey
  });
  const call = async <T>(
    method: "GET" | "PUT",
    path: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<T> => {
    try {
      return (await client.request<T>({ method, path, data, headers })).data;
    } catch (err) {
      throw fromClientError(err);
    }
  };
  const notFoundToNull = async <T>(run: () => Promise<T>): Promise<T | null> => {
    try {
      return await run();
    } catch (err) {
      if (((err as AppError).data as any)?.efiStatus === 404) return null;
      throw err;
    }
  };
  const enc = encodeURIComponent;
  return {
    context: {
      source: "database",
      configId: creds.configId,
      slot: creds.slot,
      efiEnvironment: creds.efiEnvironment,
      configFingerprint: creds.configFingerprint,
      pixKey: creds.pixKey
    },
    putCharge: (txid, body) => call("PUT", `/v2/cob/${enc(txid)}`, body),
    getCharge: txid => notFoundToNull(() => call("GET", `/v2/cob/${enc(txid)}`)),
    qrCode: locId => call("GET", `/v2/loc/${enc(String(locId))}/qrcode`),
    putWebhook: async (chave, webhookUrl) => {
      // Mesmo cabeçalho que o SDK envia hoje no cadastro (mTLS do receptor: PT-6, B3.3).
      await call("PUT", `/v2/webhook/${enc(chave)}`, { webhookUrl }, { "x-skip-mtls-checking": "true" });
    },
    getWebhook: chave => notFoundToNull(() => call("GET", `/v2/webhook/${enc(chave)}`))
  };
}

/** Gateway da fonte financeira efetiva (hoje sempre `legacy_env`, P-B31-08). */
export async function getEfiPixChargeGateway(): Promise<EfiPixChargeGateway> {
  return getEfiFinancialCredentialsSource() === "database" ? databaseGateway() : legacyGateway();
}
