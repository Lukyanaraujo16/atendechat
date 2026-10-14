import axios, { AxiosInstance } from "axios";
import { saasBillingFlags } from "../../config/saasBillingFlags";
import { logger } from "../../utils/logger";

/**
 * Cliente HTTP mínimo da API Cobranças Efí.
 * Contratos: https://dev.efipay.com.br/docs/api-cobrancas/credenciais/
 * Settle: PUT /v1/charge/{id}/settle (OpenAPI oficial / referência Gerencianet).
 *
 * Desabilitado por default (EFI_BOLETO_ENABLED / EFI_CARD_ENABLED / EFI_COBRANCAS_SETTLE_ENABLED).
 */

function cobrancasBaseUrl(): string {
  return saasBillingFlags.gerencianetSandbox()
    ? "https://cobrancas-h.api.efipay.com.br"
    : "https://cobrancas.api.efipay.com.br";
}

let cachedToken: { access_token: string; expiresAt: number } | null = null;

async function getCobrancasToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.access_token;
  }

  const clientId = process.env.EFI_COBRANCAS_CLIENT_ID || process.env.GERENCIANET_CLIENT_ID;
  const clientSecret =
    process.env.EFI_COBRANCAS_CLIENT_SECRET || process.env.GERENCIANET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais API Cobranças Efí ausentes (EFI_COBRANCAS_CLIENT_ID/SECRET)");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const { data } = await axios.post(
    `${cobrancasBaseUrl()}/v1/authorize`,
    { grant_type: "client_credentials" },
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      timeout: 20000
    }
  );

  const expiresIn = Number(data.expires_in || 600) * 1000;
  cachedToken = {
    access_token: data.access_token,
    expiresAt: Date.now() + expiresIn
  };
  return cachedToken.access_token;
}

async function cobrancasClient(): Promise<AxiosInstance> {
  const token = await getCobrancasToken();
  return axios.create({
    baseURL: cobrancasBaseUrl(),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    timeout: 30000
  });
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
