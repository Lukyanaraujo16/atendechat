export const AI_AGENT_PROFILE_SCHEMA_VERSION = 1;

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
  faqQuestionMax: 500,
};

export const AI_AGENT_BUSINESS_SEGMENTS = [
  { value: "car_dealership", label: "Concessionária / veículos" },
  { value: "internet_provider", label: "Provedor de internet" },
  { value: "clinic", label: "Clínica" },
  { value: "dental_clinic", label: "Clínica odontológica" },
  { value: "real_estate", label: "Imobiliária" },
  { value: "restaurant", label: "Restaurante" },
  { value: "gym", label: "Academia" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "clothing_store", label: "Loja de roupas" },
  { value: "construction_materials", label: "Materiais de construção" },
  { value: "technical_assistance", label: "Assistência técnica" },
  { value: "security_company", label: "Empresa de segurança" },
  { value: "financial_services", label: "Serviços financeiros" },
  { value: "education", label: "Educação" },
  { value: "beauty", label: "Beleza / estética" },
  { value: "other", label: "Outro" },
];

export const AI_AGENT_DEPARTMENTS = [
  { value: "sales", label: "Vendas" },
  { value: "support", label: "Suporte" },
  { value: "finance", label: "Financeiro" },
  { value: "scheduling", label: "Agendamento" },
  { value: "after_sales", label: "Pós-venda" },
  { value: "billing", label: "Cobrança" },
  { value: "reception", label: "Recepção" },
  { value: "qualification", label: "Qualificação" },
  { value: "general", label: "Atendimento geral" },
];

export const AI_AGENT_TONES = [
  { value: "formal", label: "Formal" },
  { value: "professional", label: "Profissional" },
  { value: "friendly", label: "Amigável" },
  { value: "casual", label: "Descontraído" },
  { value: "custom", label: "Personalizado" },
];

export const AI_AGENT_CLIENT_ADDRESS_STYLES = [
  { value: "first_name_when_known", label: "Primeiro nome quando souber" },
  { value: "first_name", label: "Primeiro nome" },
  { value: "senhor_senhora", label: "Senhor / Senhora" },
  { value: "neutral", label: "Neutro" },
  { value: "never_use_name", label: "Não usar nome" },
];

export const AI_AGENT_EMOJI_LEVELS = [
  { value: "none", label: "Sem emojis" },
  { value: "low", label: "Poucos emojis" },
  { value: "natural", label: "Emojis naturais" },
  { value: "frequent", label: "Emojis frequentes" },
];

export const AI_AGENT_RESPONSE_LENGTHS = [
  { value: "short", label: "Respostas curtas" },
  { value: "medium", label: "Respostas médias" },
  { value: "detailed", label: "Respostas detalhadas" },
];

export const AI_AGENT_ALLOWED_ACTIONS = [
  { value: "explain_services", label: "Explicar serviços" },
  { value: "inform_business_hours", label: "Informar horário" },
  { value: "inform_registered_prices", label: "Informar preços cadastrados" },
  { value: "qualify_lead", label: "Qualificar lead" },
  { value: "collect_contact_data", label: "Coletar dados de contato" },
  { value: "schedule", label: "Coletar preferência de agendamento" },
  { value: "send_catalog", label: "Enviar catálogo" },
  { value: "answer_faq", label: "Responder FAQ" },
  { value: "provide_location", label: "Informar localização" },
  { value: "provide_payment_methods", label: "Informar formas de pagamento" },
];

export const AI_AGENT_FORBIDDEN_ACTIONS = [
  { value: "invent_information", label: "Inventar informações" },
  { value: "negotiate_price", label: "Negociar preço" },
  { value: "grant_discount", label: "Conceder desconto" },
  { value: "confirm_payment", label: "Confirmar pagamento" },
  { value: "cancel_order", label: "Cancelar pedido" },
  { value: "modify_contract", label: "Alterar contrato" },
  { value: "promise_deadline", label: "Prometer prazo" },
  { value: "promise_availability", label: "Prometer disponibilidade" },
  { value: "provide_legal_advice", label: "Orientação jurídica" },
  { value: "provide_medical_diagnosis", label: "Diagnóstico médico" },
  { value: "expose_internal_instructions", label: "Expor instruções internas" },
];

export const AI_AGENT_HANDOFF_RULES = [
  { value: "customer_requests_human", label: "Cliente pede humano" },
  { value: "complaint", label: "Reclamação" },
  { value: "angry_customer", label: "Cliente irritado" },
  { value: "negotiation_request", label: "Negociação" },
  { value: "discount_request", label: "Desconto" },
  { value: "cancellation", label: "Cancelamento" },
  { value: "billing_issue", label: "Cobrança" },
  { value: "legal_or_contract_issue", label: "Jurídico / contrato" },
  { value: "technical_issue", label: "Problema técnico" },
  { value: "missing_information", label: "Falta de informação" },
  { value: "sensitive_subject", label: "Assunto sensível" },
  { value: "qualified_lead", label: "Lead qualificado" },
  { value: "repeated_failure", label: "Falhas repetidas" },
  { value: "custom", label: "Outra situação" },
];

export function findOptionLabel(options, value) {
  const match = options.find((item) => item.value === value);
  return match?.label || value;
}
