/**
 * Base64url helpers compatíveis com Node antigo (fallback manual).
 */
export const encodeBase64Url = (input: Buffer | string): string => {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64url");
};

export const decodeBase64UrlToBuffer = (input: string): Buffer => {
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

export const decodeBase64UrlToUtf8 = (input: string): string =>
  decodeBase64UrlToBuffer(input).toString("utf8");
