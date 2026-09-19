import fs from "fs";
import os from "os";
import path from "path";
import type { WhatsAppOutbound } from "../../modules/whatsapp/outbound/WhatsAppOutbound";
import { logger } from "../../utils/logger";
import { AutomationMediaError } from "../WhatsAppMediaService/AutomationMediaError";
import { downloadPublicHttpMedia } from "../WhatsAppMediaService/downloadPublicHttpMedia";
import { prepareWhatsAppPttAudio } from "../WhatsAppMediaService/prepareWhatsAppPttAudio";

export type TypebotRemoteMediaKind = "image" | "audio";

export type SendTypebotRemoteMediaDeps = {
  download?: typeof downloadPublicHttpMedia;
  preparePtt?: typeof prepareWhatsAppPttAudio;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
  unlinkSync?: typeof fs.unlinkSync;
};

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

/**
 * Typebot URL → Buffer (+ PTT se áudio) → WhatsAppOutbound.sendContent.
 * Evolution nunca recebe image/audio como objeto URL.
 */
export async function sendTypebotRemoteMedia(input: {
  outbound: WhatsAppOutbound;
  jid: string;
  kind: TypebotRemoteMediaKind;
  url: string;
  caption?: string | null;
  ticketId?: number;
  deps?: SendTypebotRemoteMediaDeps;
}): Promise<void> {
  const download = input.deps?.download || downloadPublicHttpMedia;
  const preparePtt = input.deps?.preparePtt || prepareWhatsAppPttAudio;
  const writeFileSync = input.deps?.writeFileSync || fs.writeFileSync;
  const readFileSync = input.deps?.readFileSync || fs.readFileSync;
  const unlinkSync = input.deps?.unlinkSync || fs.unlinkSync;

  const downloaded = await download({
    url: input.url,
    kind: input.kind
  });

  if (input.kind === "image") {
    const content: Record<string, unknown> = {
      image: downloaded.buffer,
      mimetype: downloaded.contentType || "image/jpeg"
    };
    if (input.caption) {
      content.caption = input.caption;
    }
    await input.outbound.sendContent({ jid: input.jid, content });
    return;
  }

  const tmpSource = path.join(
    os.tmpdir(),
    `atendechat-typebot-audio-${Date.now()}`
  );
  writeFileSync(tmpSource, downloaded.buffer);
  let outputPath: string | null = null;
  try {
    const prepared = await preparePtt({
      sourcePath: tmpSource,
      provider: input.outbound.provider,
      unlinkSource: true,
      outputDir: os.tmpdir()
    });
    outputPath = prepared.outputPath;
    const audio = readFileSync(prepared.outputPath);
    await input.outbound.sendContent({
      jid: input.jid,
      content: {
        audio,
        mimetype: prepared.mimetype,
        ptt: prepared.ptt
      }
    });
  } finally {
    try {
      unlinkSync(tmpSource);
    } catch {
      // best-effort — preparePtt already unlinks on success
    }
    if (outputPath) {
      try {
        unlinkSync(outputPath);
      } catch {
        // best-effort
      }
    }
  }
}

export async function trySendTypebotRemoteMedia(
  input: Parameters<typeof sendTypebotRemoteMedia>[0]
): Promise<boolean> {
  try {
    await sendTypebotRemoteMedia(input);
    return true;
  } catch (err) {
    const mediaErr = err instanceof AutomationMediaError ? err : null;
    logger.warn(
      {
        ticketId: input.ticketId,
        kind: input.kind,
        code: mediaErr?.code || "download_failed",
        httpStatus: mediaErr?.httpStatus,
        reason: mediaErr?.reason,
        host: safeHost(input.url)
      },
      "[Typebot] media skipped (controlled failure)"
    );
    return false;
  }
}
