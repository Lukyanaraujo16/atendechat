import AppError from "../../errors/AppError";

/**
 * O estado `enabled` da credencial é autoridade exclusiva da Product Credential API
 * (POST .../enable e POST .../disable). O PUT legado não pode alterá-lo.
 */
export const ERR_AI_PROVIDER_CREDENTIAL_ENABLED_MANAGED_BY_PRODUCT_API =
  "ERR_AI_PROVIDER_CREDENTIAL_ENABLED_MANAGED_BY_PRODUCT_API";

const CLIENT_MESSAGE =
  "O estado habilitado da credencial deve ser gerenciado pela área AI Agent.";

/**
 * Rejeita mutação de `enabled` via PUT /ai-provider-credentials/:id.
 * Presença da propriedade (true/false/null) = tentativa de mutação.
 * Ausência da chave = permitido.
 */
export function assertNoEnabledInLegacyCredentialPayload(body: unknown): void {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return;
  }
  const record = body as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, "enabled")) {
    return;
  }
  throw new AppError(
    ERR_AI_PROVIDER_CREDENTIAL_ENABLED_MANAGED_BY_PRODUCT_API,
    400,
    CLIENT_MESSAGE
  );
}
