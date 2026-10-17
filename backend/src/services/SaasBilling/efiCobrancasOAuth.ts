import axios from "axios";
import { logger } from "../../utils/logger";
import {
  sanitizeEfiAuthErrorMessage,
  EfiCobrancasAuthTestResult
} from "./efiIntegrationStatus";

const AUTH_TIMEOUT_MS = 15_000;

/**
 * OAuth Cobranças com credenciais explícitas (banco).
 * Sem GERENCIANET_* / EFI_COBRANCAS_* fallback.
 * Não cria cobranças; não retorna access_token.
 */
export async function testEfiCobrancasOAuthWithCredentials(input: {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
}): Promise<EfiCobrancasAuthTestResult> {
  const started = Date.now();
  const clientId = String(input.clientId || "").trim();
  const clientSecret = String(input.clientSecret || "").trim();

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      message: "Credenciais Cobranças ausentes",
      durationMs: Date.now() - started
    };
  }

  const baseUrl = input.sandbox
    ? "https://cobrancas-h.api.efipay.com.br"
    : "https://cobrancas.api.efipay.com.br";

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const { data, status } = await axios.post(
      `${baseUrl}/v1/authorize`,
      { grant_type: "client_credentials" },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        timeout: AUTH_TIMEOUT_MS,
        validateStatus: () => true
      }
    );

    const durationMs = Date.now() - started;
    const hasToken =
      data &&
      typeof data === "object" &&
      typeof (data as { access_token?: unknown }).access_token === "string" &&
      String((data as { access_token: string }).access_token).length > 0;

    if (status >= 200 && status < 300 && hasToken) {
      logger.info(
        { durationMs, sandbox: input.sandbox },
        "[efiIntegration] cobrancas_oauth_ok_db_credentials"
      );
      return {
        ok: true,
        message: "Autenticação OAuth Cobranças bem-sucedida",
        durationMs
      };
    }

    const sanitized = sanitizeEfiAuthErrorMessage({
      response: { data },
      message: `HTTP ${status}`
    });
    logger.warn(
      { durationMs, status },
      "[efiIntegration] cobrancas_oauth_failed_db_credentials"
    );
    return { ok: false, message: sanitized, durationMs };
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = sanitizeEfiAuthErrorMessage(err);
    logger.warn({ durationMs }, "[efiIntegration] cobrancas_oauth_error_db_credentials");
    return { ok: false, message, durationMs };
  }
}
