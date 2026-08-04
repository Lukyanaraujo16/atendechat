/**
 * Script de diagnóstico local (NÃO é endpoint HTTP).
 *
 * Uso controlado:
 *   AI_AGENT_AUDIO_DIAG=1 OPENAI_API_KEY=sk-... \\
 *     npx ts-node src/scripts/diagnoseAiAgentAudioTranscription.ts /abs/path/audio.ogg
 *
 * Imprime apenas: sucesso/falha, chars, provider, modelo, duração, errorCode.
 * Nunca imprime a transcrição completa nem a API key.
 */
import fs from "fs";
import path from "path";
import { inspectAiAgentAudioFile } from "../services/AiAgentService/inspectAiAgentAudioFile";
import { executeOpenAiTranscription } from "../services/OpenAi/OpenAiManager";
import { resolveWhisperUploadFilename } from "../services/AiAgentService/resolveAiAgentLocalMediaPath";

async function main(): Promise<void> {
  if (process.env.AI_AGENT_AUDIO_DIAG !== "1") {
    console.error(
      "Recusado: defina AI_AGENT_AUDIO_DIAG=1 para executar este diagnóstico."
    );
    process.exit(2);
  }

  const audioPath = process.argv[2];
  if (!audioPath || !path.isAbsolute(audioPath)) {
    console.error("Uso: ...diagnoseAiAgentAudioTranscription.ts /abs/path/file.ogg");
    process.exit(2);
  }

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    console.error("OPENAI_API_KEY ausente.");
    process.exit(2);
  }

  const inspection = await inspectAiAgentAudioFile({
    absolutePath: audioPath,
    mimeHint: "audio/ogg"
  });

  console.log(
    JSON.stringify(
      {
        stage: "inspect",
        exists: inspection.exists,
        isFile: inspection.isFile,
        readable: inspection.readable,
        byteSize: inspection.byteSize,
        extension: inspection.extension,
        container: inspection.container,
        magicHex: inspection.magicHex,
        normalizedMimeType: inspection.normalizedMimeType
      },
      null,
      2
    )
  );

  if (!inspection.readable || inspection.byteSize <= 0) {
    console.log(
      JSON.stringify({
        ok: false,
        errorCode: "audio_file_missing",
        provider: "openai",
        model: "whisper-1"
      })
    );
    process.exit(1);
  }

  const started = Date.now();
  const filename = resolveWhisperUploadFilename(
    audioPath,
    inspection.normalizedMimeType
  );
  const result = await executeOpenAiTranscription({
    companyId: 0,
    apiKey,
    absolutePath: audioPath,
    filename,
    mimeType: inspection.normalizedMimeType,
    timeoutMs: 45_000
  });
  const durationMs = Date.now() - started;

  if (result.ok === true) {
    console.log(
      JSON.stringify({
        ok: true,
        transcriptionChars: result.text.length,
        provider: "openai",
        model: "whisper-1",
        durationMs
      })
    );
    process.exit(0);
    return;
  }

  console.log(
    JSON.stringify({
      ok: false,
      errorCode: result.error,
      httpStatus: result.httpStatus ?? null,
      providerErrorCode: result.providerErrorCode ?? null,
      errorStage: result.errorStage ?? null,
      timedOut: result.timedOut === true,
      provider: "openai",
      model: "whisper-1",
      durationMs,
      stillExists: fs.existsSync(audioPath)
    })
  );
  process.exit(1);
}

main().catch(err => {
  console.error(
    JSON.stringify({
      ok: false,
      errorCode: "script_crash",
      message: err instanceof Error ? err.message.slice(0, 120) : "unknown"
    })
  );
  process.exit(1);
});
