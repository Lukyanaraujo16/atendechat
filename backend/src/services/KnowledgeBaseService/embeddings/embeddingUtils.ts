/** Estimativa ~4 chars/token — explícita, não exata. */
export function estimateTokensFromChars(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function float32ArrayToBuffer(values: number[]): Buffer {
  const buf = Buffer.allocUnsafe(values.length * 4);
  for (let i = 0; i < values.length; i += 1) {
    buf.writeFloatLE(values[i], i * 4);
  }
  return buf;
}

export function bufferToFloat32Array(buf: Buffer): number[] {
  const out: number[] = [];
  for (let i = 0; i + 3 < buf.length; i += 4) {
    out.push(buf.readFloatLE(i));
  }
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;
  return dot / denom;
}

export function sanitizeProviderError(err: unknown): {
  code: string;
  message: string;
  retryable: boolean;
} {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err || "Erro desconhecido");

  // Remover possíveis fragmentos de chave
  const message = raw
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/AIza[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 500);

  const lower = message.toLowerCase();
  if (
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("timeout") ||
    lower.includes("econnreset") ||
    lower.includes("503") ||
    lower.includes("502")
  ) {
    return {
      code: "ERR_KNOWLEDGE_EMBEDDING_TRANSIENT",
      message,
      retryable: true
    };
  }
  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("invalid api") ||
    lower.includes("unauthorized") ||
    lower.includes("permission")
  ) {
    return {
      code: "ERR_KNOWLEDGE_EMBEDDING_AUTH",
      message: "Credencial de embedding inválida ou sem permissão.",
      retryable: false
    };
  }
  if (lower.includes("model") && lower.includes("not")) {
    return {
      code: "ERR_KNOWLEDGE_EMBEDDING_MODEL",
      message: "Modelo de embedding inválido ou indisponível.",
      retryable: false
    };
  }
  return {
    code: "ERR_KNOWLEDGE_EMBEDDING_FAILED",
    message,
    retryable: false
  };
}
