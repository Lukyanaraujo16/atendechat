/**
 * Base64url helpers (sem padding, sem + / =).
 * Fallback manual para Node sem suporte nativo a "base64url".
 */
export const base64UrlEncode = (input: Buffer | string): string => {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64url");
};

export const base64UrlDecodeToBuffer = (input: string): Buffer => {
  const value = input.trim();
  if (!value) {
    throw new Error("empty_base64url");
  }

  try {
    return Buffer.from(value, "base64url");
  } catch {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding =
      normalized.length % 4 === 0
        ? ""
        : "=".repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + padding, "base64");
  }
};

export const base64UrlDecodeToString = (input: string): string =>
  base64UrlDecodeToBuffer(input).toString("utf8");

/** @deprecated use base64UrlEncode */
export const encodeBase64Url = base64UrlEncode;

/** @deprecated use base64UrlDecodeToBuffer */
export const decodeBase64UrlToBuffer = base64UrlDecodeToBuffer;

/** @deprecated use base64UrlDecodeToString */
export const decodeBase64UrlToUtf8 = base64UrlDecodeToString;
