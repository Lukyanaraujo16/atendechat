const SAFE_SERVICE_NAME = /^[a-zA-Z0-9@._-]{1,64}$/;

export function resolveBackendServiceName(): string {
  const raw = String(process.env.BACKEND_SERVICE_NAME || "atendechat-backend").trim();
  if (!SAFE_SERVICE_NAME.test(raw)) {
    return "atendechat-backend";
  }
  return raw;
}
