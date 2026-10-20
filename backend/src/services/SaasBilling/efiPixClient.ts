import https from "https";
import tls from "tls";
import axios, { Method } from "axios";
import AppError from "../../errors/AppError";
import type { PlatformEfiEnvironment } from "../../models/PlatformEfiConfig";
import { redactEfiSensitiveText } from "./efiIntegrationStatus";

/**
 * Cliente Pix próprio do caminho `database` (D-P12, R-2) — Fase 8.3-B3.1.
 *
 * Contratos confirmados na documentação oficial (PT-4, dev.efipay.com.br/docs/api-pix/credenciais):
 * - bases: produção `https://pix.api.efipay.com.br`, homologação `https://pix-h.api.efipay.com.br`;
 * - OAuth: `POST /oauth/token`, Basic `client_id:client_secret`, corpo `{"grant_type":"client_credentials"}`;
 * - mTLS com o P12 obrigatório no OAuth e em todas as chamadas; token Bearer com `expires_in` (3600 s no exemplo);
 * - escopos são definidos na aplicação Efí (ex.: cob.write/cob.read, pix.read, webhook.write/webhook.read).
 *
 * O P12 fica só em memória (`https.Agent({ pfx })`): nada é gravado em disco.
 * O SDK `gn-api-sdk-typescript` continua só no `legacy_env`.
 */
export const EFI_PIX_BASE_URLS: Record<PlatformEfiEnvironment, string> = {
  sandbox: "https://pix-h.api.efipay.com.br",
  production: "https://pix.api.efipay.com.br"
};
export const EFI_PIX_OAUTH_PATH = "/oauth/token";
export const EFI_PIX_OAUTH_TIMEOUT_MS = 15_000;
export const EFI_PIX_REQUEST_TIMEOUT_MS = 20_000;
/** Certificados Efí são emitidos sem senha (o SDK também usa senha vazia). */
const P12_PASSPHRASE = "";
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export type EfiPixClientInput = {
  efiEnvironment: PlatformEfiEnvironment;
  clientId: string;
  clientSecret: string;
  pfx: Buffer;
  /** Chave do cache de token, ex. `db:<configId>:<updatedAt>:<ambiente>`. Sem chave, sem cache. */
  tokenCacheKey?: string | null;
  /** Só para testes locais. */
  baseUrl?: string;
};

export type EfiPixResponse<T = unknown> = { status: number; data: T };

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export function invalidateEfiPixTokenCache(): void {
  tokenCache.clear();
}

/** Valida que o P12 abre (RF1.8). Lança erro tipado sem detalhes do conteúdo. */
export function assertEfiP12Opens(pfx: Buffer): void {
  if (!Buffer.isBuffer(pfx) || pfx.length === 0) {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_MISSING",
      400,
      "Certificado P12 Efí ausente."
    );
  }
  try {
    tls.createSecureContext({ pfx, passphrase: P12_PASSPHRASE });
  } catch {
    throw new AppError(
      "ERR_EFI_CERTIFICATE_INVALID",
      400,
      "O certificado P12 não pôde ser aberto (arquivo inválido, protegido por senha ou com algoritmo legado não suportado)."
    );
  }
}

function isTimeout(err: any): boolean {
  return (
    err?.code === "ECONNABORTED" ||
    err?.code === "ETIMEDOUT" ||
    err?.code === "ERR_CANCELED" ||
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    err?.name === "TimeoutError"
  );
}

function efiErrorText(err: any): string {
  const data = err?.response?.data;
  const raw =
    (data && typeof data === "object"
      ? data.error_description || data.mensagem || data.message || data.error || data.nome
      : null) ||
    err?.message ||
    "falha";
  return redactEfiSensitiveText(raw);
}

/** Converte qualquer falha de transporte/HTTP em AppError tipado e sanitizado (RNF2). */
function toEfiPixError(err: any, stage: "oauth" | "request"): AppError {
  if (err instanceof AppError) return err;
  if (isTimeout(err)) {
    return new AppError(
      "ERR_EFI_PIX_TIMEOUT",
      504,
      stage === "oauth"
        ? "Timeout ao autenticar na API Pix Efí."
        : "Timeout na chamada à API Pix Efí."
    );
  }
  const status = err?.response?.status;
  if (typeof status === "number") {
    if (stage === "oauth" && (status === 400 || status === 401 || status === 403)) {
      return new AppError(
        "ERR_EFI_PIX_AUTH_FAILED",
        502,
        `Autenticação Pix Efí recusada (HTTP ${status}): ${efiErrorText(err)}`,
        { efiStatus: status }
      );
    }
    return new AppError(
      "ERR_EFI_PIX_HTTP_ERROR",
      502,
      `API Pix Efí respondeu HTTP ${status}: ${efiErrorText(err)}`,
      { efiStatus: status }
    );
  }
  return new AppError(
    "ERR_EFI_PIX_NETWORK",
    502,
    `Falha de rede na API Pix Efí: ${efiErrorText(err)}`,
    { networkCode: typeof err?.code === "string" ? err.code : null }
  );
}

export function createEfiPixClient(input: EfiPixClientInput) {
  const clientId = String(input.clientId || "").trim();
  const clientSecret = String(input.clientSecret || "").trim();
  if (!clientId || !clientSecret) {
    throw new AppError(
      "ERR_EFI_CONFIG_INCOMPLETE",
      400,
      "Client ID/Secret Pix Efí ausentes."
    );
  }
  assertEfiP12Opens(input.pfx);

  const baseURL = input.baseUrl || EFI_PIX_BASE_URLS[input.efiEnvironment];
  if (!baseURL) {
    throw new AppError("ERR_EFI_ENVIRONMENT_INVALID", 500, "Ambiente Efí inválido.");
  }
  const httpsAgent = new https.Agent({ pfx: input.pfx, passphrase: P12_PASSPHRASE });
  const cacheKey = input.tokenCacheKey || null;

  async function getAccessToken(): Promise<string> {
    const cached = cacheKey ? tokenCache.get(cacheKey) : undefined;
    if (cached && Date.now() < cached.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return cached.token;
    }
    try {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const { data } = await axios.post(
        `${baseURL}${EFI_PIX_OAUTH_PATH}`,
        { grant_type: "client_credentials" },
        {
          httpsAgent,
          headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
          timeout: EFI_PIX_OAUTH_TIMEOUT_MS,
          // `timeout` do axios não cobre conexão pendurada; o signal garante o teto total.
          signal: AbortSignal.timeout(EFI_PIX_OAUTH_TIMEOUT_MS)
        }
      );
      const token = data?.access_token;
      if (typeof token !== "string" || token.length === 0) {
        throw new AppError(
          "ERR_EFI_PIX_AUTH_FAILED",
          502,
          "Resposta OAuth Pix Efí sem access_token."
        );
      }
      const ttlMs = (Number(data?.expires_in) || 600) * 1000;
      if (cacheKey) tokenCache.set(cacheKey, { token, expiresAt: Date.now() + ttlMs });
      return token;
    } catch (err) {
      throw toEfiPixError(err, "oauth");
    }
  }

  async function request<T = unknown>(opts: {
    method: Method;
    path: string;
    data?: unknown;
  }): Promise<EfiPixResponse<T>> {
    const token = await getAccessToken();
    try {
      const res = await axios.request<T>({
        method: opts.method,
        url: `${baseURL}${opts.path}`,
        data: opts.data,
        httpsAgent,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        timeout: EFI_PIX_REQUEST_TIMEOUT_MS,
        signal: AbortSignal.timeout(EFI_PIX_REQUEST_TIMEOUT_MS)
      });
      return { status: res.status, data: res.data };
    } catch (err: any) {
      if (cacheKey && err?.response?.status === 401) tokenCache.delete(cacheKey);
      throw toEfiPixError(err, "request");
    }
  }

  return { baseURL, getAccessToken, request };
}

export type EfiPixAuthTestResult = {
  ok: boolean;
  certificateValid: boolean;
  message: string;
  durationMs: number;
};

/**
 * Teste de conexão Pix (RF1.8): abre o P12 e faz OAuth com mTLS. Não cria cobrança,
 * não usa nem preenche o cache, não devolve o token.
 */
export async function testEfiPixOAuth(
  input: Omit<EfiPixClientInput, "tokenCacheKey">
): Promise<EfiPixAuthTestResult> {
  const started = Date.now();
  let certificateValid = false;
  try {
    assertEfiP12Opens(input.pfx);
    certificateValid = true;
    await createEfiPixClient({ ...input, tokenCacheKey: null }).getAccessToken();
    return {
      ok: true,
      certificateValid,
      message: "Autenticação OAuth Pix (mTLS) bem-sucedida",
      durationMs: Date.now() - started
    };
  } catch (err) {
    const e = toEfiPixError(err, "oauth");
    return {
      ok: false,
      certificateValid,
      message: (e.clientMessage || e.message).slice(0, 240),
      durationMs: Date.now() - started
    };
  }
}
