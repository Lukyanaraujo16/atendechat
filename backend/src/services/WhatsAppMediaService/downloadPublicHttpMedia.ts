import axios, { AxiosError } from "axios";
import { assertSafePublicHttpUrlResolved } from "../../helpers/httpUrlSafety";
import {
  EVOLUTION_MEDIA_LIMITS,
  EvolutionBinaryMediaKind,
  maxBytesForEvolutionMediaKind
} from "../../modules/whatsapp/providers/evolution/inbound/evolutionMediaLimits";
import { AutomationMediaError } from "./AutomationMediaError";

export type DownloadPublicHttpMediaKind = Extract<
  EvolutionBinaryMediaKind,
  "image" | "audio" | "video" | "document"
>;

export type DownloadPublicHttpMediaResult = {
  buffer: Buffer;
  contentType: string | null;
  byteLength: number;
};

export type DownloadPublicHttpMediaDeps = {
  axiosGet?: typeof axios.get;
  assertUrl?: typeof assertSafePublicHttpUrlResolved;
};

/**
 * Download HTTP(S) público com SSRF, timeout e teto de bytes do projeto.
 * maxRedirects=0: redirect para IP privado não é seguido.
 */
export async function downloadPublicHttpMedia(input: {
  url: string;
  kind: DownloadPublicHttpMediaKind;
  deps?: DownloadPublicHttpMediaDeps;
}): Promise<DownloadPublicHttpMediaResult> {
  const assertUrl = input.deps?.assertUrl || assertSafePublicHttpUrlResolved;
  const axiosGet = input.deps?.axiosGet || axios.get;
  const maxBytes = maxBytesForEvolutionMediaKind(input.kind);
  const timeoutMs = EVOLUTION_MEDIA_LIMITS.downloadTimeoutMs;

  const safe = await assertUrl(input.url);
  if (safe.ok === false) {
    const code = safe.reason === "invalid_url" ? "invalid_url" : "ssrf";
    throw new AutomationMediaError(
      code,
      "URL de mídia rejeitada pela política SSRF",
      { reason: safe.reason }
    );
  }

  let response;
  try {
    response = await axiosGet(safe.url.toString(), {
      responseType: "arraybuffer",
      timeout: timeoutMs,
      maxRedirects: 0,
      maxContentLength: maxBytes,
      maxBodyLength: maxBytes,
      validateStatus: () => true
    });
  } catch (err) {
    const code = (err as AxiosError)?.code;
    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      throw new AutomationMediaError(
        "timeout",
        "Timeout ao baixar mídia de automação"
      );
    }
    const axiosMax =
      (err as AxiosError)?.message?.includes("maxContentLength") ||
      (err as AxiosError)?.message?.includes("maxBodyLength");
    if (axiosMax) {
      throw new AutomationMediaError(
        "too_large",
        "Mídia de automação excede o limite"
      );
    }
    throw new AutomationMediaError(
      "download_failed",
      "Falha ao baixar mídia de automação"
    );
  }

  const status = Number(response.status);
  if (status < 200 || status >= 300) {
    throw new AutomationMediaError(
      "http_status",
      `Download de mídia HTTP ${status}`,
      { httpStatus: status }
    );
  }

  const buffer = Buffer.from(response.data);
  if (buffer.length > maxBytes) {
    throw new AutomationMediaError(
      "too_large",
      "Mídia de automação excede o limite"
    );
  }

  const rawType = response.headers?.["content-type"];
  const contentType =
    typeof rawType === "string" ? rawType.split(";")[0].trim() : null;

  return { buffer, contentType, byteLength: buffer.length };
}
