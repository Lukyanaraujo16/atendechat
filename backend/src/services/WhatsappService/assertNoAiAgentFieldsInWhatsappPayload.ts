import AppError from "../../errors/AppError";

/** Campos AI Agent proibidos em POST/PUT /whatsapp (Fase 2.6). */
export const AI_AGENT_WHATSAPP_MUTATION_FIELDS = [
  "aiAgentId",
  "aiAgentMode",
  "aiAgentEnabled"
] as const;

export const ERR_AI_AGENT_FIELDS_MANAGED_BY_PRODUCT_API =
  "ERR_AI_AGENT_FIELDS_MANAGED_BY_PRODUCT_API";

const CLIENT_MESSAGE =
  "A configuração do AI Agent deve ser realizada pela área AI Agent.";

/**
 * Rejeita mutação comercial de AI Agent via rotas WhatsApp.
 * Presença do campo (mesmo null/false/disabled) = tentativa de mutação.
 */
export function assertNoAiAgentFieldsInWhatsappPayload(body: unknown): void {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return;
  }
  const record = body as Record<string, unknown>;
  const present = AI_AGENT_WHATSAPP_MUTATION_FIELDS.filter(key =>
    Object.prototype.hasOwnProperty.call(record, key)
  );
  if (present.length === 0) {
    return;
  }
  throw new AppError(
    ERR_AI_AGENT_FIELDS_MANAGED_BY_PRODUCT_API,
    400,
    CLIENT_MESSAGE
  );
}
