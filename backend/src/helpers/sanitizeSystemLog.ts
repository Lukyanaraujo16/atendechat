const SENSITIVE_PATTERNS: RegExp[] = [
  /(password|passwd|secret|token|api[_-]?key|authorization)\s*[=:]\s*\S+/gi,
  /(DB_PASS|JWT_SECRET|JWT_REFRESH_SECRET|REDIS_URI|DB_IMPORT_PASS)\s*=\s*\S+/gi,
  /Bearer\s+[A-Za-z0-9._\-+/=]+/gi,
  /postgres:\/\/[^\s]+/gi,
  /redis:\/\/[^\s]+/gi,
  /mysql:\/\/[^\s]+/gi
];

export function sanitizeSystemLogLine(line: string): string {
  let out = String(line || "");
  for (const pattern of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, (match) => {
      const key = match.split(/[=:]/)[0];
      return `${key}=[REDACTED]`;
    });
  }
  if (/\.env$/i.test(out) || out.includes("backend/.env")) {
    out = out.replace(/\.env\b/g, "[env-file]");
  }
  return out;
}
