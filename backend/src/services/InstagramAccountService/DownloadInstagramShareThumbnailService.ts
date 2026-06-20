import { logger } from "../../utils/logger";
import { isShareThumbnailSourceUrl } from "./instagramShareUtils";
import DownloadInstagramMediaService from "./DownloadInstagramMediaService";

interface Request {
  thumbnailSourceUrl: string;
  accessToken: string;
  companyId: number;
  messageId: string;
}

export interface DownloadInstagramShareThumbnailResult {
  relativePath: string;
  bytes: number;
}

const DownloadInstagramShareThumbnailService = async ({
  thumbnailSourceUrl,
  accessToken,
  companyId,
  messageId
}: Request): Promise<DownloadInstagramShareThumbnailResult | null> => {
  if (!isShareThumbnailSourceUrl(thumbnailSourceUrl)) {
    return null;
  }

  try {
    const downloaded = await DownloadInstagramMediaService({
      url: thumbnailSourceUrl,
      accessToken,
      companyId,
      messageId: `${messageId}_share_thumb`,
      mediaKind: "image"
    });

    logger.info(
      {
        companyId,
        messageId,
        relativePath: downloaded.relativePath,
        bytes: downloaded.bytes
      },
      "[InstagramShare] thumbnail_saved"
    );

    return {
      relativePath: downloaded.relativePath,
      bytes: downloaded.bytes
    };
  } catch {
    logger.warn(
      {
        companyId,
        messageId,
        urlHost: (() => {
          try {
            return new URL(thumbnailSourceUrl).host;
          } catch {
            return undefined;
          }
        })()
      },
      "[InstagramShare] thumbnail_download_failed"
    );
    return null;
  }
};

export default DownloadInstagramShareThumbnailService;
