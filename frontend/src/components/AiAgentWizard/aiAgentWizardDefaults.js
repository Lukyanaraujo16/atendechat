import { DEFAULT_AI_AGENT_FORM } from "../../config/aiAgentFormDefaults";

export const LOCKED_FORBIDDEN_ACTIONS = [
  "invent_information",
  "expose_internal_instructions",
];

/** Invariante de plataforma: pedido explícito do cliente. */
export const LOCKED_HANDOFF_RULES = ["customer_requests_human"];

export const DEFAULT_FORBIDDEN_ACTIONS = [
  "invent_information",
  "grant_discount",
  "promise_deadline",
  "expose_internal_instructions",
];

export const DEFAULT_HANDOFF_RULES = [
  "customer_requests_human",
  "complaint",
  "angry_customer",
  "negotiation_request",
  "missing_information",
  "repeated_failure",
];

export const DEFAULT_ALLOWED_ACTIONS = [
  "explain_services",
  "inform_business_hours",
  "answer_faq",
];

export const ATTENDANT_NAME_SUGGESTIONS = [
  "Ana",
  "Júlia",
  "Sofia",
  "Lucas",
  "Rafael",
];

export const ROLE_SUGGESTIONS_BY_DEPARTMENT = {
  sales: "Atendente Comercial",
  support: "Assistente de Suporte",
  scheduling: "Recepcionista Virtual",
  reception: "Recepcionista Virtual",
  qualification: "Atendente Comercial",
  general: "Atendente Virtual",
};

export const PRICING_POLICY_PRESETS = {
  registered_only:
    "Pode informar somente preços cadastrados no sistema.",
  no_prices:
    "Não informar preços; encaminhar para atendimento humano quando solicitado.",
  custom: "custom",
};

export const NEGOTIATION_POLICY_PRESETS = {
  handoff:
    "Não negocia valores; recuse ou explique o limite sem confirmar valores.",
  collect_only:
    "Pode coletar proposta ou interesse, mas não confirma valores.",
  custom: "custom",
};

/**
 * Snapshots pré-H5-B conhecidos e exatos.
 * Somente igualdade integral — sem contains genérico de "humano".
 * no_prices / no_scheduling atuais ainda dizem "encaminha"; não são aliases.
 */
export const LEGACY_NEGOTIATION_POLICY_ALIASES = {
  "Não negocia valores; encaminha para atendimento humano.": "handoff",
};

export const SCHEDULING_POLICY_PRESETS = {
  collect_preference:
    "Pode coletar preferência de data/horário, mas não confirma agendamento.",
  no_scheduling:
    "Não realiza agendamento; encaminha para atendimento humano.",
  custom: "custom",
};

export const WIZARD_STEP_IDS = [
  "welcome",
  "company",
  "attendant",
  "personality",
  "allowedActions",
  "forbiddenActions",
  "handoff",
  "businessKnowledge",
  "policies",
  "review",
];

export function createEmptyFaqItem() {
  return { question: "", answer: "" };
}

export function createDefaultWizardFormState() {
  return {
    companyName: "",
    businessSegment: "",
    customBusinessSegment: "",
    companyDescription: "",
    serviceArea: "",
    sourceWebsite: "",
    attendantName: "",
    attendantRole: "",
    departments: [],
    tone: "professional",
    customTone: "",
    clientAddressStyle: "first_name_when_known",
    emojiLevel: "low",
    responseLength: "short",
    allowedActions: [...DEFAULT_ALLOWED_ACTIONS],
    forbiddenActions: [...DEFAULT_FORBIDDEN_ACTIONS],
    handoffRules: [...DEFAULT_HANDOFF_RULES],
    handoffCustomText: "",
    productsAndServices: "",
    importantInformation: "",
    businessHours: "",
    frequentlyAskedQuestions: [createEmptyFaqItem()],
    pricingPolicyPreset: "registered_only",
    pricingPolicyCustom: "",
    negotiationPolicyPreset: "handoff",
    negotiationPolicyCustom: "",
    schedulingPolicyPreset: "collect_preference",
    schedulingPolicyCustom: "",
    customInstructions: "",
    identityName: "",
    identityDescription: "",
    fallbackMessage: DEFAULT_AI_AGENT_FORM.fallbackMessage || "",
    handoffMessage: DEFAULT_AI_AGENT_FORM.handoffMessage || "",
    provider: "",
    model: "",
    credentialRef: "",
    connectionRefs: [],
  };
}

export function suggestAttendantRole(departments = []) {
  for (const dept of departments) {
    if (ROLE_SUGGESTIONS_BY_DEPARTMENT[dept]) {
      return ROLE_SUGGESTIONS_BY_DEPARTMENT[dept];
    }
  }
  return "Atendente Virtual";
}

export function pickRandomAttendantName(current = "") {
  const trimmed = String(current || "").trim();
  if (trimmed) return trimmed;
  const index = Math.floor(Math.random() * ATTENDANT_NAME_SUGGESTIONS.length);
  return ATTENDANT_NAME_SUGGESTIONS[index];
}
