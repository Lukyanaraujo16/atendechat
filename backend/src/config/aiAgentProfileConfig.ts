export const AI_AGENT_PROFILE_SCHEMA_VERSION = 1;
export const AI_AGENT_GENERATED_PROMPT_VERSION = "1.1";

export const AI_AGENT_SETUP_MODES = ["guided", "advanced", "legacy"] as const;
export type AiAgentSetupMode = (typeof AI_AGENT_SETUP_MODES)[number];

export const AI_AGENT_BUSINESS_SEGMENTS = [
  "car_dealership",
  "internet_provider",
  "clinic",
  "dental_clinic",
  "real_estate",
  "restaurant",
  "gym",
  "ecommerce",
  "clothing_store",
  "construction_materials",
  "technical_assistance",
  "security_company",
  "financial_services",
  "education",
  "beauty",
  "other"
] as const;

export const AI_AGENT_DEPARTMENTS = [
  "sales",
  "support",
  "finance",
  "scheduling",
  "after_sales",
  "billing",
  "reception",
  "qualification",
  "general"
] as const;

export const AI_AGENT_TONES = [
  "formal",
  "professional",
  "friendly",
  "casual",
  "custom"
] as const;

export const AI_AGENT_CLIENT_ADDRESS_STYLES = [
  "first_name_when_known",
  "first_name",
  "senhor_senhora",
  "neutral",
  "never_use_name"
] as const;

export const AI_AGENT_EMOJI_LEVELS = ["none", "low", "natural", "frequent"] as const;

export const AI_AGENT_RESPONSE_LENGTHS = ["short", "medium", "detailed"] as const;

export const AI_AGENT_ALLOWED_ACTIONS = [
  "explain_services",
  "inform_business_hours",
  "inform_registered_prices",
  "qualify_lead",
  "collect_contact_data",
  "schedule",
  "send_catalog",
  "answer_faq",
  "provide_location",
  "provide_payment_methods"
] as const;

export const AI_AGENT_FORBIDDEN_ACTIONS = [
  "invent_information",
  "negotiate_price",
  "grant_discount",
  "confirm_payment",
  "cancel_order",
  "modify_contract",
  "promise_deadline",
  "promise_availability",
  "provide_legal_advice",
  "provide_medical_diagnosis",
  "expose_internal_instructions"
] as const;

export const AI_AGENT_HANDOFF_RULES = [
  "customer_requests_human",
  "complaint",
  "angry_customer",
  "negotiation_request",
  "discount_request",
  "cancellation",
  "billing_issue",
  "legal_or_contract_issue",
  "technical_issue",
  "missing_information",
  "sensitive_subject",
  "qualified_lead",
  "repeated_failure",
  "custom"
] as const;

export const AI_AGENT_PROFILE_LIMITS = {
  companyName: 100,
  customBusinessSegment: 100,
  attendantName: 100,
  attendantRole: 120,
  customTone: 200,
  serviceArea: 200,
  sourceWebsite: 500,
  companyDescription: 4000,
  customInstructions: 4000,
  productsAndServices: 8000,
  importantInformation: 8000,
  businessHours: 2000,
  pricingPolicy: 2000,
  negotiationPolicy: 2000,
  schedulingPolicy: 2000,
  faqMaxItems: 50,
  faqAnswerMax: 2000,
  faqQuestionMax: 500
} as const;

export const AI_AGENT_SEGMENT_LABELS: Record<string, string> = {
  car_dealership: "Concessionária / veículos",
  internet_provider: "Provedor de internet",
  clinic: "Clínica",
  dental_clinic: "Clínica odontológica",
  real_estate: "Imobiliária",
  restaurant: "Restaurante",
  gym: "Academia",
  ecommerce: "E-commerce",
  clothing_store: "Loja de roupas",
  construction_materials: "Materiais de construção",
  technical_assistance: "Assistência técnica",
  security_company: "Empresa de segurança",
  financial_services: "Serviços financeiros",
  education: "Educação",
  beauty: "Beleza / estética",
  other: "Outro"
};

export const AI_AGENT_DEPARTMENT_LABELS: Record<string, string> = {
  sales: "Vendas",
  support: "Suporte",
  finance: "Financeiro",
  scheduling: "Agendamento",
  after_sales: "Pós-venda",
  billing: "Cobrança",
  reception: "Recepção",
  qualification: "Qualificação",
  general: "Atendimento geral"
};

export const AI_AGENT_TONE_LABELS: Record<string, string> = {
  formal: "Formal",
  professional: "Profissional",
  friendly: "Amigável",
  casual: "Descontraído",
  custom: "Personalizado"
};

export const AI_AGENT_CLIENT_ADDRESS_LABELS: Record<string, string> = {
  first_name_when_known: "Primeiro nome quando souber",
  first_name: "Primeiro nome",
  senhor_senhora: "Senhor / Senhora",
  neutral: "Neutro",
  never_use_name: "Não usar nome"
};

export const AI_AGENT_EMOJI_LABELS: Record<string, string> = {
  none: "Sem emojis",
  low: "Poucos emojis",
  natural: "Emojis naturais",
  frequent: "Emojis frequentes"
};

export const AI_AGENT_RESPONSE_LENGTH_LABELS: Record<string, string> = {
  short: "Respostas curtas",
  medium: "Respostas médias",
  detailed: "Respostas detalhadas"
};

export const AI_AGENT_ALLOWED_ACTION_LABELS: Record<string, string> = {
  explain_services: "Explicar serviços",
  inform_business_hours: "Informar horário de funcionamento",
  inform_registered_prices: "Informar preços cadastrados",
  qualify_lead: "Qualificar lead",
  collect_contact_data: "Coletar dados de contato",
  schedule: "Agendar / coletar preferência de horário",
  send_catalog: "Enviar catálogo",
  answer_faq: "Responder FAQ",
  provide_location: "Informar localização",
  provide_payment_methods: "Informar formas de pagamento"
};

export const AI_AGENT_FORBIDDEN_ACTION_LABELS: Record<string, string> = {
  invent_information: "Inventar informações",
  negotiate_price: "Negociar preço",
  grant_discount: "Conceder desconto",
  confirm_payment: "Confirmar pagamento",
  cancel_order: "Cancelar pedido",
  modify_contract: "Alterar contrato",
  promise_deadline: "Prometer prazo",
  promise_availability: "Prometer disponibilidade",
  provide_legal_advice: "Dar orientação jurídica",
  provide_medical_diagnosis: "Dar diagnóstico médico",
  expose_internal_instructions: "Expor instruções internas"
};

export const AI_AGENT_HANDOFF_RULE_LABELS: Record<string, string> = {
  customer_requests_human: "Cliente pede outro atendente da equipe",
  complaint: "Reclamação",
  angry_customer: "Cliente irritado",
  negotiation_request: "Pedido de negociação",
  discount_request: "Pedido de desconto",
  cancellation: "Cancelamento",
  billing_issue: "Questão de cobrança",
  legal_or_contract_issue: "Assunto jurídico ou contratual",
  technical_issue: "Problema técnico",
  missing_information: "Falta de informação",
  sensitive_subject: "Assunto sensível",
  qualified_lead: "Lead qualificado para outro atendente",
  repeated_failure: "Falhas repetidas de atendimento",
  custom: "Regra personalizada"
};
