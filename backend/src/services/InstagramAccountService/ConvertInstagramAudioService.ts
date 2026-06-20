import { execFile, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import AppError from "../../errors/AppError";
import {
  assertInstagramMetaAudioFileSize,
  getInstagramMediaDirectory,
  INSTAGRAM_META_AUDIO_MIMES,
  isInstagramMetaCompatibleAudioMime,
  needsInstagramAudioConversion
} from "../../helpers/instagramMediaStorage";
import { logger } from "../../utils/logger";

const execFileAsync = promisify(execFile);

export interface ConvertInstagramAudioResult {
  relativePath: string;
  absolutePath: string;
  bytes: number;
  mimeType: string;
  converted: boolean;
  durationMs: number;
}

interface Request {
  companyId: number;
  inputAbsolutePath: string;
  inputMime: string;
  inputRelativePath: string;
}

const OUTPUT_MIME = "audio/mp4";

export const resolveInstagramFfmpegPath = (): string => {
  const envPath = process.env.FFMPEG_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  try {
    const systemPath = execSync("which ffmpeg", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    if (systemPath && fs.existsSync(systemPath)) {
      return systemPath;
    }
  } catch {
    /* fallback to bundled installer */
  }

  if (ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
    return ffmpegInstaller.path;
  }

  throw new AppError(
    "ERR_INSTAGRAM_AUDIO_FFMPEG_UNAVAILABLE",
    500,
    "Não foi possível preparar o áudio para envio pelo Instagram."
  );
};

const buildConvertedOutputPath = (
  companyId: number,
  inputAbsolutePath: string
): { absolutePath: string; relativePath: string } => {
  const dir = getInstagramMediaDirectory(companyId);
  const inputBase = path.parse(inputAbsolutePath).name;
  const filename = `${inputBase}_aac.m4a`;
  const absolutePath = path.join(dir, filename);
  const relativePath = path.posix.join("instagram", String(companyId), filename);
  return { absolutePath, relativePath };
};

const ConvertInstagramAudioService = async ({
  companyId,
  inputAbsolutePath,
  inputMime,
  inputRelativePath
}: Request): Promise<ConvertInstagramAudioResult> => {
  const normalizedMime = (inputMime || "").toLowerCase();
  const inputSize = fs.statSync(inputAbsolutePath).size;

  if (isInstagramMetaCompatibleAudioMime(normalizedMime)) {
    logger.info(
      {
        inputFile: inputRelativePath,
        mimeType: normalizedMime,
        reason: "already_meta_compatible"
      },
      "[InstagramAudioOutbound] conversion_skipped"
    );

    assertInstagramMetaAudioFileSize(inputSize);

    return {
      relativePath: inputRelativePath,
      absolutePath: inputAbsolutePath,
      bytes: inputSize,
      mimeType: normalizedMime,
      converted: false,
      durationMs: 0
    };
  }

  if (!needsInstagramAudioConversion(normalizedMime)) {
    throw new AppError(
      "ERR_INSTAGRAM_AUDIO_FORMAT_UNSUPPORTED",
      400,
      "Formato de áudio não suportado pelo Instagram."
    );
  }

  logger.info(
    {
      inputFile: inputRelativePath,
      inputMime: normalizedMime,
      inputSize
    },
    "[InstagramAudioOutbound] conversion_started"
  );

  const startedAt = Date.now();
  let ffmpegPath: string;

  try {
    ffmpegPath = resolveInstagramFfmpegPath();
  } catch (err) {
    logger.warn(
      {
        inputFile: inputRelativePath,
        inputMime: normalizedMime,
        error: err instanceof Error ? err.message : String(err)
      },
      "[InstagramAudioOutbound] conversion_failed"
    );
    throw err;
  }

  const { absolutePath: outputAbsolutePath, relativePath: outputRelativePath } =
    buildConvertedOutputPath(companyId, inputAbsolutePath);

  try {
    await execFileAsync(
      ffmpegPath,
      [
        "-y",
        "-i",
        inputAbsolutePath,
        "-vn",
        "-acodec",
        "aac",
        "-b:a",
        "128k",
        outputAbsolutePath
      ],
      { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (err) {
    const execErr = err as NodeJS.ErrnoException & {
      stderr?: string;
      stdout?: string;
    };

    logger.warn(
      {
        inputFile: inputRelativePath,
        inputMime: normalizedMime,
        ffmpegPath,
        error: execErr.message,
        stderr: execErr.stderr,
        stdout: execErr.stdout
      },
      "[InstagramAudioOutbound] conversion_failed"
    );

    try {
      if (fs.existsSync(outputAbsolutePath)) {
        fs.unlinkSync(outputAbsolutePath);
      }
    } catch {
      /* ignore cleanup errors */
    }

    throw new AppError(
      "ERR_INSTAGRAM_AUDIO_CONVERSION_FAILED",
      500,
      "Não foi possível converter o áudio para envio pelo Instagram."
    );
  }

  if (!fs.existsSync(outputAbsolutePath)) {
    logger.warn(
      {
        inputFile: inputRelativePath,
        outputFile: outputRelativePath
      },
      "[InstagramAudioOutbound] conversion_failed"
    );
    throw new AppError(
      "ERR_INSTAGRAM_AUDIO_CONVERSION_FAILED",
      500,
      "Não foi possível converter o áudio para envio pelo Instagram."
    );
  }

  const outputSize = fs.statSync(outputAbsolutePath).size;
  const durationMs = Date.now() - startedAt;

  try {
    assertInstagramMetaAudioFileSize(outputSize);
  } catch {
    try {
      fs.unlinkSync(outputAbsolutePath);
    } catch {
      /* ignore cleanup errors */
    }
    logger.warn(
      {
        inputFile: inputRelativePath,
        outputFile: outputRelativePath,
        outputSize
      },
      "[InstagramAudioOutbound] conversion_failed"
    );
    throw new AppError(
      "ERR_INSTAGRAM_AUDIO_TOO_LARGE",
      400,
      "Áudio muito grande para envio pelo Instagram."
    );
  }

  try {
    fs.unlinkSync(inputAbsolutePath);
  } catch {
    /* ignore cleanup errors */
  }

  logger.info(
    {
      inputFile: inputRelativePath,
      outputFile: outputRelativePath,
      outputMime: OUTPUT_MIME,
      outputSize,
      durationMs,
      metaCompatibleMime: Array.from(INSTAGRAM_META_AUDIO_MIMES)
    },
    "[InstagramAudioOutbound] conversion_done"
  );

  return {
    relativePath: outputRelativePath,
    absolutePath: outputAbsolutePath,
    bytes: outputSize,
    mimeType: OUTPUT_MIME,
    converted: true,
    durationMs
  };
};

export default ConvertInstagramAudioService;
