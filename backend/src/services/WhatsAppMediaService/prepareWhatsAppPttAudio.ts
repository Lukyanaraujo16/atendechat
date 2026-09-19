import { exec } from "child_process";
import fs from "fs";
import path from "path";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import type { WhatsAppOutboundProvider } from "../../modules/whatsapp/outbound/WhatsAppOutbound";
import { AutomationMediaError } from "./AutomationMediaError";

const defaultOutputDir = path.resolve(__dirname, "..", "..", "..", "public");

export type PrepareWhatsAppPttAudioResult = {
  outputPath: string;
  mimetype: string;
  ptt: true;
};

export type PrepareWhatsAppPttAudioDeps = {
  execFn?: typeof exec;
  unlinkSync?: typeof fs.unlinkSync;
};

/**
 * Preparação PTT compartilhada (humano, Flow, Typebot).
 * Evolution: OGG/Opus homologado. Baileys: AAC/MP4 legado.
 */
export async function prepareWhatsAppPttAudio(input: {
  sourcePath: string;
  provider: WhatsAppOutboundProvider;
  unlinkSource?: boolean;
  outputDir?: string;
  deps?: PrepareWhatsAppPttAudioDeps;
}): Promise<PrepareWhatsAppPttAudioResult> {
  const outputDir = input.outputDir || defaultOutputDir;
  const execFn = input.deps?.execFn || exec;
  const unlinkSync = input.deps?.unlinkSync || fs.unlinkSync;
  const stamp = new Date().getTime();
  const useEvolution = input.provider === "evolution";
  const outputPath = useEvolution
    ? path.join(outputDir, `${stamp}.ogg`)
    : path.join(outputDir, `${stamp}.mp3`);
  const cmd = useEvolution
    ? `${ffmpegPath.path} -i ${input.sourcePath} -vn -ac 1 -c:a libopus -b:a 64k -f ogg ${outputPath} -y`
    : `${ffmpegPath.path} -i ${input.sourcePath} -vn -ab 128k -ar 44100 -f ipod ${outputPath} -y`;

  try {
    await new Promise<void>((resolve, reject) => {
      execFn(cmd, error => {
        if (error) reject(error);
        else resolve();
      });
    });
  } catch {
    throw new AutomationMediaError(
      "prepare_failed",
      "Falha ao preparar áudio PTT"
    );
  }

  if (input.unlinkSource) {
    try {
      unlinkSync(input.sourcePath);
    } catch {
      // best-effort
    }
  }

  return {
    outputPath,
    mimetype: useEvolution ? "audio/ogg; codecs=opus" : "audio/mp4",
    ptt: true
  };
}
