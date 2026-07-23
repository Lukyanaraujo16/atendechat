import AppError from "../../../errors/AppError";
import {
  AGENTOS_PAYLOAD_LIMITS,
  AGENTOS_SECRET_KEY_RE
} from "../../../config/automationAgentOsSecurityConstants";

export function assertCompanyIdFromAuth(
  companyId: unknown,
  claimed?: unknown
): number {
  if (companyId == null || companyId === "") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const resolved = Number(companyId);
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  if (claimed != null && claimed !== "" && Number(claimed) !== resolved) {
    throw new AppError("ERR_TENANT_MISMATCH", 403, "companyId inválido");
  }
  return resolved;
}

export function assertResourceBelongsToCompany(
  resourceCompanyId: number | null | undefined,
  authCompanyId: number,
  resourceLabel = "resource"
): void {
  if (resourceCompanyId == null) {
    throw new AppError("ERR_NOT_FOUND", 404, `${resourceLabel} não encontrado`);
  }
  if (Number(resourceCompanyId) !== Number(authCompanyId)) {
    throw new AppError("ERR_TENANT_MISMATCH", 403, `${resourceLabel} fora do tenant`);
  }
}

export function assertSafeId(value: unknown, field = "id"): string {
  if (value == null || value === "") {
    throw new AppError("ERR_VALIDATION", 400, `${field} obrigatório`);
  }
  const s = String(value).trim();
  if (s.length > AGENTOS_PAYLOAD_LIMITS.maxIdLength) {
    throw new AppError("ERR_VALIDATION", 400, `${field} inválido`);
  }
  if (!/^[A-Za-z0-9_.:\-]+$/.test(s)) {
    throw new AppError("ERR_VALIDATION", 400, `${field} inválido`);
  }
  return s;
}

export function assertConfirmation(
  body: Record<string, unknown> | undefined,
  required: boolean
): void {
  if (!required) return;
  const confirmed =
    body?.confirm === true ||
    body?.confirmed === true ||
    body?.confirmation === true;
  if (!confirmed) {
    throw new AppError(
      "ERR_CONFIRMATION_REQUIRED",
      400,
      "Operação sensível exige confirm: true"
    );
  }
}

export function stripSecretsDeep<T>(value: T, depth = 0): T {
  if (depth > 12 || value == null) return value;
  if (Array.isArray(value)) {
    return value.map(v => stripSecretsDeep(v, depth + 1)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (AGENTOS_SECRET_KEY_RE.test(k)) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = stripSecretsDeep(v, depth + 1);
    }
    return out as T;
  }
  return value;
}

export function assertPayloadBounds(body: unknown): void {
  const raw = JSON.stringify(body ?? {});
  if (raw.length > AGENTOS_PAYLOAD_LIMITS.maxJsonBytes) {
    throw new AppError("ERR_PAYLOAD_TOO_LARGE", 413, "Payload excede limite");
  }
}
