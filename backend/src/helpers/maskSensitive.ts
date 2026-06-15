/** Mascara valores sensíveis para logs e mensagens de erro. */
export function maskToken(value: string | null | undefined): string {
  if (!value || typeof value !== "string") {
    return "***";
  }
  const trimmed = value.trim();
  if (trimmed.length < 8) {
    return "***";
  }
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/** Remove possíveis tokens de strings antes de logar. */
export function redactSensitiveText(text: string): string {
  if (!text) return text;
  return text.replace(
    /(access_token|input_token|pageAccessToken|Bearer)\s*[=:]\s*["']?[\w.-]+["']?/gi,
    "$1=***"
  ).replace(
    /[\?&](access_token|input_token)=[^&\s"']+/gi,
    (match, key) => `${match.startsWith("?") ? "?" : "&"}${key}=***`
  );
}
