import axios, { AxiosError } from "axios";
import { redactSensitiveText } from "../../helpers/maskSensitive";
import {
  getInstagramMediaMaxBytes,
  saveInstagramMediaBuffer
} from "../../helpers/instagramMediaStorage";
import { logger } from "../../utils/logger";

export type InstagramDownloadMediaKind = "image" | "video";

interface Request {
  url: string;
  accessToken: string;
  companyId: number;
  messageId: string;
  mediaKind?: InstagramDownloadMediaKind;
}

export interface DownloadInstagramMediaResult {
  relativePath: string;
  absolutePath: string;
  bytes: number;
  mimeType: string | null;
}

const LOG_PREFIX: Record<InstagramDownloadMediaKind, string> = {
  image: "[InstagramMediaInbound]",
  video: "[InstagramVideoInbound]"
};

const downloadWithAuth = async (
  url: string,
  accessToken: string,
  maxBytes: number,
  timeoutMs: number
): Promise<{ buffer: Buffer; mimeType: string | null }> => {
  const attempts: Array<Record<string, string>> = [
    { Authorization: `Bearer ${accessToken}` },
    {}
  ];

  let lastError: unknown;

  for (const headers of attempts) {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: "arraybuffer",
        timeout: timeoutMs,
        maxContentLength: maxBytes + 1024,
        maxBodyLength: maxBytes + 1024,
        headers,
        params: headers.Authorization ? undefined : { access_token: accessToken }
      });

      const mimeType =
        typeof response.headers["content-type"] === "string"
          ? response.headers["content-type"].split(";")[0].trim()
          : null;

      return {
        buffer: Buffer.from(response.data),
        mimeType
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
};

const DownloadInstagramMediaService = async ({
  url,
  accessToken,
  companyId,
  messageId,
  mediaKind = "image"
}: Request): Promise<DownloadInstagramMediaResult> => {
  const logPrefix = LOG_PREFIX[mediaKind];
  const maxBytes = getInstagramMediaMaxBytes(
    mediaKind === "video" ? "video/mp4" : "image/jpeg"
  );
  const timeoutMs = mediaKind === "video" ? 120000 : 30000;

  logger.info(
    {
      companyId,
      messageId,
      mediaKind,
      urlHost: (() => {
        try {
          return new URL(url).host;
        } catch {
          return undefined;
        }
      })()
    },
    `${logPrefix} downloading`
  );

  try {
    const { buffer, mimeType } = await downloadWithAuth(
      url,
      accessToken,
      maxBytes,
      timeoutMs
    );

    const effectiveMax = getInstagramMediaMaxBytes(mimeType);
    if (buffer.length > effectiveMax) {
      throw new Error(
        mediaKind === "video"
          ? "ERR_INSTAGRAM_VIDEO_TOO_LARGE"
          : "ERR_INSTAGRAM_IMAGE_TOO_LARGE"
      );
    }

    const saved = saveInstagramMediaBuffer({
      companyId,
      buffer,
      mimeType,
      basename: messageId
    });

    logger.info(
      {
        companyId,
        messageId,
        mediaKind,
        relativePath: saved.relativePath,
        bytes: saved.bytes,
        mimeType
      },
      `${logPrefix} saved`
    );

    return {
      relativePath: saved.relativePath,
      absolutePath: saved.absolutePath,
      bytes: saved.bytes,
      mimeType
    };
  } catch (err) {
    const axiosErr = err as AxiosError;
    logger.warn(
      {
        companyId,
        messageId,
        mediaKind,
        statusCode: axiosErr.response?.status,
        error: err instanceof Error ? redactSensitiveText(err.message) : String(err)
      },
      `${logPrefix} download_failed`
    );
    throw err;
  }
};

export default DownloadInstagramMediaService;
