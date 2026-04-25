/**
 * Gravação de áudio no navegador com MIME compatível (Edge/Firefox/Chrome).
 * @see https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
 */

const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4", // Safari / alguns WebKit
];

/**
 * @returns {{ mime: string, explicit: boolean }} explicit=false → usar new MediaRecorder(stream) sem opções
 */
export function getBestAudioMimeType() {
  if (typeof window === "undefined" || !window.MediaRecorder) {
    return { mime: "", explicit: false };
  }
  for (const t of AUDIO_MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(t)) {
        return { mime: t, explicit: true };
      }
    } catch {
      /* ignore */
    }
  }
  return { mime: "", explicit: false };
}

/**
 * Cria MediaRecorder: tenta com mime explícito; se falhar, deixa o padrão do navegador.
 * @param {MediaStream} stream
 * @param {string} preferredMime
 * @param {boolean} hasExplicit
 */
export function createAudioMediaRecorder(stream, preferredMime, hasExplicit) {
  if (hasExplicit && preferredMime) {
    try {
      return new MediaRecorder(stream, { mimeType: preferredMime });
    } catch (err) {
      console.error(
        "[AudioRecorder] MediaRecorder ctor failed with mimeType, retrying default",
        preferredMime,
        err
      );
    }
  }
  try {
    return new MediaRecorder(stream);
  } catch (err) {
    console.error("[AudioRecorder] MediaRecorder ctor failed (default)", err);
    throw err;
  }
}

/**
 * Mapeia Blob.type / mime do recorder para extensão de ficheiro.
 * @param {string} type
 * @returns {string}
 */
export function getAudioFileExtension(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "m4a";
  return "webm";
}

const PREFIX = "[AudioRecorder]";

/**
 * @param {unknown} err
 * @returns {string} chave (sem path) em messagesInput.audioRecorder.<key>
 */
export function getAudioErrorI18nKey(err) {
  if (!err || typeof err !== "object") {
    return "generic";
  }
  const name = err.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "permissionDenied";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "noDevice";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "deviceInUse";
  }
  if (name === "OverconstrainedError" || name === "ConstraintError") {
    return "constraints";
  }
  if (name === "SecurityError" || name === "NotSupportedError") {
    return "notSupported";
  }
  if (name === "InvalidStateError") {
    return "invalidState";
  }
  return "generic";
}

/**
 * @param {string} code contexto: getUserMedia | start | stop | blob
 * @param {unknown} err
 */
export function logAudioRecorderError(code, err) {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(PREFIX, code, { name: err?.name, message: msg, stack });
}
