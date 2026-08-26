import axios, { AxiosInstance } from "axios";
import WhatsappEvolutionCredential from "../../../../../models/WhatsappEvolutionCredential";
import { decryptEvolutionApiKey } from "../../../../../helpers/evolutionCredentialCrypto";
import { logger } from "../../../../../utils/logger";
import { EVOLUTION_MEDIA_LIMITS } from "./evolutionMediaLimits";
import { assertSafeEvolutionMediaUrlResolved } from "./evolutionUrlSafety";

export class EvolutionHttpError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EvolutionHttpError";
    this.code = code;
  }
}

export type EvolutionGetBase64Result = {
  base64: string;
  mimetype?: string | null;
};

function createAxiosClient(baseUrl: string, apiKey: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.replace(/\/+$/, ""),
    timeout: EVOLUTION_MEDIA_LIMITS.downloadTimeoutMs,
    maxRedirects: 0,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json"
    },
    validateStatus: () => true
  });
}

/**
 * Client HTTP Evolution (Fase 7) — somente obtenção de mídia.
 * API key descriptografada só em memória; nunca logada.
 */
export async function loadEvolutionCredentialForMedia(
  whatsappId: number
): Promise<{
  baseUrl: string;
  instanceName: string;
  apiKey: string;
}> {
  const cred = await WhatsappEvolutionCredential.unscoped().findOne({
    where: { whatsappId },
    attributes: ["baseUrl", "instanceName", "apiKeyEncrypted"]
  });
  if (!cred?.baseUrl || !cred.instanceName || !cred.apiKeyEncrypted) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_CREDENTIAL_MISSING",
      "Credencial Evolution ausente para download de mídia"
    );
  }
  let apiKey: string;
  try {
    apiKey = decryptEvolutionApiKey(cred.apiKeyEncrypted);
  } catch {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_CREDENTIAL_DECRYPT",
      "Falha ao descriptografar API key Evolution"
    );
  }
  return {
    baseUrl: cred.baseUrl.replace(/\/+$/, ""),
    instanceName: cred.instanceName,
    apiKey
  };
}

/**
 * POST /chat/getBase64FromMediaMessage/{instance}
 * Docs: https://doc.evolution-api.com/v2/api-reference/chat-controller/get-base64
 */
export async function evolutionGetBase64FromMediaMessage(input: {
  whatsappId: number;
  messageId: string;
  convertToMp4?: boolean;
}): Promise<EvolutionGetBase64Result> {
  const cred = await loadEvolutionCredentialForMedia(input.whatsappId);
  const client = createAxiosClient(cred.baseUrl, cred.apiKey);

  const path = `/chat/getBase64FromMediaMessage/${encodeURIComponent(
    cred.instanceName
  )}`;

  let response;
  try {
    response = await client.post(path, {
      message: { key: { id: input.messageId } },
      convertToMp4: Boolean(input.convertToMp4)
    });
  } catch (err) {
    logger.warn(
      {
        whatsappId: input.whatsappId,
        messageId: input.messageId,
        code: (err as { code?: string })?.code
      },
      "[EvolutionHttp] getBase64 request failed"
    );
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_TIMEOUT",
      "Timeout/erro de rede ao obter mídia Evolution"
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_HTTP",
      `Evolution getBase64 HTTP ${response.status}`
    );
  }

  const { data } = response;
  let base64: string | null = null;
  if (typeof data === "string") {
    base64 = data;
  } else if (data && typeof data === "object") {
    if (typeof data.base64 === "string") base64 = data.base64;
    else if (data.data && typeof data.data.base64 === "string") {
      base64 = data.data.base64;
    }
  }

  if (!base64 || !String(base64).trim()) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_EMPTY",
      "Evolution getBase64 retornou vazio"
    );
  }

  let mimetype: string | null = null;
  if (data && typeof data === "object") {
    if (typeof data.mimetype === "string") mimetype = data.mimetype;
    else if (typeof data.mimeType === "string") mimetype = data.mimeType;
  }

  return { base64: String(base64).trim(), mimetype };
}

/**
 * Download binário de URL somente se host == baseUrl Evolution (SSRF-safe).
 */
export async function evolutionDownloadMediaFromUrl(input: {
  whatsappId: number;
  mediaUrl: string;
  maxBytes: number;
}): Promise<Buffer> {
  const cred = await loadEvolutionCredentialForMedia(input.whatsappId);
  const safe = await assertSafeEvolutionMediaUrlResolved({
    candidateUrl: input.mediaUrl,
    allowedBaseUrl: cred.baseUrl
  });
  if (safe.ok === false) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_URL_BLOCKED",
      `URL de mídia bloqueada: ${safe.reason}`
    );
  }

  let response;
  try {
    response = await axios.get(safe.url.toString(), {
      responseType: "arraybuffer",
      timeout: EVOLUTION_MEDIA_LIMITS.downloadTimeoutMs,
      maxRedirects: 0,
      maxContentLength: input.maxBytes,
      maxBodyLength: input.maxBytes,
      headers: { apikey: cred.apiKey },
      validateStatus: () => true
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      throw new EvolutionHttpError(
        "ERR_EVOLUTION_MEDIA_TIMEOUT",
        "Timeout ao baixar URL de mídia Evolution"
      );
    }
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_DOWNLOAD",
      "Falha ao baixar URL de mídia Evolution"
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_HTTP",
      `Download mídia HTTP ${response.status}`
    );
  }

  const buf = Buffer.from(response.data);
  if (buf.length > input.maxBytes) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_TOO_LARGE",
      "Arquivo Evolution excede limite"
    );
  }
  return buf;
}
