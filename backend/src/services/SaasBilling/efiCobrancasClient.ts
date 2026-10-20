import crypto from "crypto";
import axios, { AxiosInstance } from "axios";
import { saasBillingFlags } from "../../config/saasBillingFlags";
import { getEfiRuntimeCredentials } from "./efiRuntimeCredentials";
import { getEfiFinancialCredentialsSource } from "./efiFinancialSource";
import { logger } from "../../utils/logger";

/**
 * Cliente HTTP mínimo da API Cobranças Efí.
 * Contratos: https://dev.efipay.com.br/docs/api-cobrancas/credenciais/
 * Settle: PUT /v1/charge/{id}/settle (OpenAPI oficial / referência Gerencianet).
 *
 * Desabilitado por default (EFI_BOLETO_ENABLED / EFI_CARD_ENABLED / EFI_COBRANCAS_SETTLE_ENABLED).
 */

const COBRANCAS_BASE_URLS = {
  sandbox: "https://cobrancas-h.api.efipay.com.br",
  production: "https://cobrancas.api.efipay.com.br"
} as const;

/**
 * Credencial e base pela fonte financeira efetiva (D-P1, RF1.9, P-B31-08):
 * - `legacy_env`: EFI_COBRANCAS_* → GERENCIANET_*, base por GERENCIANET_SANDBOX (comportamento atual);
 * - `database`: credencial Cobranças do slot (ou a Pix, se não houver dedicada), base pelo ambiente do slot.
 * Na B3.1 a fonte financeira é sempre `legacy_env`, mesmo com `EFI_CREDENTIALS_SOURCE=database`,
 * para o settle não usar credencial diferente da do checkout/webhook.
 */
async function cobrancasCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  cacheKey: string;
}> {
  if (getEfiFinancialCredentialsSource() === "database") {
    const creds = await getEfiRuntimeCredentials("financial");
    return {
      clientId: creds.cobrancasClientId,
      clientSecret: creds.cobrancasClientSecret,
      baseUrl: COBRANCAS_BASE_URLS[creds.efiEnvironment],
      cacheKey: `cobrancas:${creds.tokenCacheKey}`
    };
  }

  const clientId = process.env.EFI_COBRANCAS_CLIENT_ID || process.env.GERENCIANET_CLIENT_ID;
  const clientSecret =
    process.env.EFI_COBRANCAS_CLIENT_SECRET || process.env.GERENCIANET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais API Cobranças Efí ausentes (EFI_COBRANCAS_CLIENT_ID/SECRET)");
  }
  const baseUrl = saasBillingFlags.gerencianetSandbox()
    ? COBRANCAS_BASE_URLS.sandbox
    : COBRANCAS_BASE_URLS.production;
  const credHash = crypto
    .createHash("sha256")
    .update(`${clientId}:${clientSecret}`)
    .digest("hex")
    .slice(0, 16);
  return { clientId, clientSecret, baseUrl, cacheKey: `cobrancas:env:${baseUrl}:${credHash}` };
}

/** Um token por credencial/base (R14): trocar credencial nunca reaproveita token antigo. */
let cachedToken: { key: string; access_token: string; expiresAt: number } | null = null;

async function getCobrancasToken(creds: {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  cacheKey: string;
}): Promise<string> {
  if (
    cachedToken &&
    cachedToken.key === creds.cacheKey &&
    Date.now() < cachedToken.expiresAt - 30_000
  ) {
    return cachedToken.access_token;
  }

  const auth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const { data } = await axios.post(
    `${creds.baseUrl}/v1/authorize`,
    { grant_type: "client_credentials" },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      timeout: 20000,
      // Teto total (o `timeout` do axios é de inatividade do socket).
      signal: AbortSignal.timeout(20000)
    }
  );

  const expiresIn = Number(data.expires_in || 600) * 1000;
  cachedToken = {
    key: creds.cacheKey,
    access_token: data.access_token,
    expiresAt: Date.now() + expiresIn
  };
  return cachedToken.access_token;
}

async function cobrancasClient(): Promise<AxiosInstance> {
  const creds = await cobrancasCredentials();
  const token = await getCobrancasToken(creds);
  const client = axios.create({
    baseURL: creds.baseUrl,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });
  // Teto total por chamada (sinal novo a cada requisição).
  client.interceptors.request.use(config => ({
    ...config,
    signal: config.signal || AbortSignal.timeout(30000)
  }));
  return client;
}

/**
 * Baixa manual oficial (boleto/cartão) — NÃO usar para Pix.
 * Fonte: status `settled` + endpoint PUT /v1/charge/{id}/settle
 */
export async function settleEfiCobrancasCharge(chargeId: string): Promise<unknown> {
  if (!saasBillingFlags.cobrancasSettleEnabled()) {
    throw new Error("EFI_COBRANCAS_SETTLE_ENABLED=false");
  }
  const client = await cobrancasClient();
  try {
    const { data } = await client.put(`/v1/charge/${chargeId}/settle`);
    return data;
  } catch (err: any) {
    const msg =
      err?.response?.data?.error_description ||
      err?.response?.data?.message ||
      err?.message ||
      "settle_failed";
    logger.warn({ chargeId, msg }, "[efiCobrancas] settle_failed");
    throw new Error(String(msg));
  }
}

export async function cancelEfiCobrancasCharge(chargeId: string): Promise<unknown> {
  const client = await cobrancasClient();
  const { data } = await client.put(`/v1/charge/${chargeId}/cancel`);
  return data;
}

export type CreateBoletoChargeInput = {
  amountCents: number;
  description: string;
  expireAt: string; // YYYY-MM-DD
  customer: {
    name: string;
    cpf?: string;
    cnpj?: string;
    email?: string;
    phone_number?: string;
  };
  metadata?: { custom_id?: string; notification_url?: string };
};

/**
 * Emite boleto one-step — só se EFI_BOLETO_ENABLED=true.
 * Contrato: API Cobranças (não Pix).
 */
export async function createEfiBoletoCharge(
  input: CreateBoletoChargeInput
): Promise<{ chargeId: string; raw: unknown }> {
  if (!saasBillingFlags.boletoEnabled()) {
    throw new Error("EFI_BOLETO_ENABLED=false");
  }
  const client = await cobrancasClient();
  const body = {
    items: [
      {
        name: input.description.slice(0, 255),
        value: input.amountCents,
        amount: 1
      }
    ],
    metadata: input.metadata || {},
    payment: {
      banking_billet: {
        expire_at: input.expireAt,
        customer: input.customer
      }
    }
  };
  const { data } = await client.post("/v1/charge/one-step", body);
  const chargeId = String(
    data?.data?.charge_id ?? data?.charge_id ?? data?.data?.charge?.id ?? ""
  );
  if (!chargeId) {
    throw new Error("Resposta Cobranças sem charge_id");
  }
  return { chargeId, raw: data };
}

export async function detailEfiCobrancasCharge(chargeId: string): Promise<unknown> {
  const client = await cobrancasClient();
  const { data } = await client.get(`/v1/charge/${chargeId}`);
  return data;
}
