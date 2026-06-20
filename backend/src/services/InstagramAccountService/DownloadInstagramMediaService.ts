import axios, { AxiosError } from "axios";
import { redactSensitiveText } from "../../helpers/maskSensitive";
import {
  INSTAGRAM_IMAGE_MAX_BYTES,
  saveInstagramMediaBuffer
} from "../../helpers/instagramMediaStorage";
import { logger } from "../../utils/logger";

interface Request {
  url: string;
  accessToken: string;
  companyId: number;
  messageId: string;
}

export interface DownloadInstagramMediaResult {
  relativePath: string;
  absolutePath: string;
  bytes: number;
  mimeType: string | null;
}

const downloadWithAuth = async (
  url: string,
  accessToken: string
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
        timeout: 30000,
        maxContentLength: INSTAGRAM_IMAGE_MAX_BYTES + 1024,
        maxBodyLength: INSTAGRAM_IMAGE_MAX_BYTES + 1024,
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
  messageId
}: Request): Promise<DownloadInstagramMediaResult> => {
  logger.info(
    {
      companyId,
      messageId,
      urlHost: (() => {
        try {
          return new URL(url).host;
        } catch {
          return undefined;
        }
      })()
    },
    "[InstagramMediaInbound] downloading"
  );

  try {
    const { buffer, mimeType } = await downloadWithAuth(url, accessToken);

    if (buffer.length > INSTAGRAM_IMAGE_MAX_BYTES) {
      throw new Error("ERR_INSTAGRAM_IMAGE_TOO_LARGE");
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
        relativePath: saved.relativePath,
        bytes: saved.bytes,
        mimeType
      },
      "[InstagramMediaInbound] saved"
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
        statusCode: axiosErr.response?.status,
        error: err instanceof Error ? redactSensitiveText(err.message) : String(err)
      },
      "[InstagramMediaInbound] download_failed"
    );
    throw err;
  }
};

export default DownloadInstagramMediaService;
