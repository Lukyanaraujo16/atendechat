export const SHADOW_STATUS_LABELS = {
  generated: "Gerada",
  failed: "Falhou",
  skipped: "Ignorada",
  rate_limited: "Limite atingido",
  queued: "Na fila",
  not_requested: "Não solicitada",
};

export const SHADOW_ERROR_LABELS = {
  ai_auth_error: "Falha de autenticação",
  rate_limited: "Limite do provedor atingido",
  ai_usage_limit_reached: "Limite diário da empresa atingido",
  provider_timeout: "Tempo limite excedido",
  provider_unavailable: "Provedor indisponível",
  invalid_model: "Modelo inválido",
  empty_ai_response: "Resposta vazia",
  context_build_failed: "Erro ao montar contexto",
  generation_failed: "Falha na geração",
  billing_required: "Crédito ou faturamento necessário",
  insufficient_quota: "Quota ou saldo insuficiente",
  invalid_provider: "Provedor inválido",
  debounced_superseded: "Substituída por mensagem mais recente",
  not_eligible: "Não elegível",
  not_shadow_mode: "Fora do Shadow Mode",
};

export const CREDENTIAL_SOURCE_LABELS = {
  agent_credential: "Credencial do agente",
  company_default: "Credencial padrão",
  legacy_prompt: "OpenAI legado (Prompt)",
  missing: "Nenhuma credencial",
};

export const REVIEW_RATING_OPTIONS = [
  { value: "good", labelKey: "aiAgent.shadowSection.review.ratings.good" },
  { value: "bad", labelKey: "aiAgent.shadowSection.review.ratings.bad" },
  { value: "neutral", labelKey: "aiAgent.shadowSection.review.ratings.neutral" },
];

export const REVIEW_TAG_OPTIONS = [
  { value: "useful", labelKey: "aiAgent.shadowSection.review.tags.useful" },
  { value: "invented_information", labelKey: "aiAgent.shadowSection.review.tags.inventedInformation" },
  { value: "too_long", labelKey: "aiAgent.shadowSection.review.tags.tooLong" },
  { value: "too_short", labelKey: "aiAgent.shadowSection.review.tags.tooShort" },
  { value: "needs_human", labelKey: "aiAgent.shadowSection.review.tags.needsHuman" },
  { value: "wrong_tone", labelKey: "aiAgent.shadowSection.review.tags.wrongTone" },
  { value: "incomplete", labelKey: "aiAgent.shadowSection.review.tags.incomplete" },
  { value: "other", labelKey: "aiAgent.shadowSection.review.tags.other" },
];

export function resolveShadowErrorLabel(errorCode) {
  if (!errorCode) return "-";
  return SHADOW_ERROR_LABELS[errorCode] || errorCode;
}

export function resolveShadowStatusLabel(status) {
  if (!status) return "-";
  return SHADOW_STATUS_LABELS[status] || status;
}

export function resolveCredentialSourceLabel(source) {
  if (!source) return "-";
  return CREDENTIAL_SOURCE_LABELS[source] || source;
}
