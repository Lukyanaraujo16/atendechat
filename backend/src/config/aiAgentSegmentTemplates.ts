import { AI_AGENT_BUSINESS_SEGMENTS } from "./aiAgentProfileConfig";

export type AiAgentSegmentTemplate = {
  segment: string;
  suggestedDepartments: string[];
  suggestedAllowedActions: string[];
  suggestedForbiddenActions: string[];
  suggestedHandoffRules: string[];
  suggestedAttendantRole: string | null;
  businessInfoKeys: string[];
  qualificationKeys: string[];
  suggestedFaqKeys: string[];
  simulationPromptKeys: string[];
  generatedPromptInstructions: string[];
};

const BASE_SAFETY_FORBIDDEN = [
  "invent_information",
  "grant_discount",
  "promise_deadline",
  "expose_internal_instructions"
];

function tpl(
  segment: string,
  partial: Partial<AiAgentSegmentTemplate> & Pick<AiAgentSegmentTemplate, "generatedPromptInstructions">
): AiAgentSegmentTemplate {
  return {
    segment,
    suggestedDepartments: partial.suggestedDepartments ?? ["general"],
    suggestedAllowedActions: partial.suggestedAllowedActions ?? ["explain_services", "answer_faq"],
    suggestedForbiddenActions: partial.suggestedForbiddenActions ?? BASE_SAFETY_FORBIDDEN,
    suggestedHandoffRules: partial.suggestedHandoffRules ?? [
      "customer_requests_human",
      "missing_information",
      "complaint"
    ],
    suggestedAttendantRole: partial.suggestedAttendantRole ?? "Atendente Virtual",
    businessInfoKeys: partial.businessInfoKeys ?? [],
    qualificationKeys: partial.qualificationKeys ?? [],
    suggestedFaqKeys: partial.suggestedFaqKeys ?? [],
    simulationPromptKeys: partial.simulationPromptKeys ?? [],
    generatedPromptInstructions: partial.generatedPromptInstructions
  };
}

export const AI_AGENT_SEGMENT_TEMPLATES: Record<string, AiAgentSegmentTemplate> = {
  car_dealership: tpl("car_dealership", {
    suggestedDepartments: ["sales", "qualification", "after_sales"],
    suggestedAllowedActions: [
      "explain_services",
      "qualify_lead",
      "collect_contact_data",
      "answer_faq",
      "provide_location",
      "provide_payment_methods"
    ],
    suggestedForbiddenActions: [
      ...BASE_SAFETY_FORBIDDEN,
      "negotiate_price",
      "promise_availability"
    ],
    suggestedHandoffRules: [
      "customer_requests_human",
      "negotiation_request",
      "discount_request",
      "qualified_lead",
      "missing_information",
      "complaint",
      "legal_or_contract_issue"
    ],
    suggestedAttendantRole: "Atendente Comercial",
    businessInfoKeys: [
      "vehicleTypes",
      "newUsed",
      "serviceArea",
      "financing",
      "tradeIn",
      "documentation",
      "reservationPolicy",
      "businessHours",
      "address",
      "paymentMethods",
      "evaluationContact"
    ],
    qualificationKeys: [
      "vehicleCategory",
      "priceRange",
      "financingInterest",
      "downPayment",
      "tradeInVehicle",
      "city",
      "purchaseTimeline",
      "visitPreference"
    ],
    suggestedFaqKeys: ["financing", "tradeIn", "location", "documents", "visit"],
    simulationPromptKeys: ["priceBudget", "tradeIn", "financingApproval", "talkToSeller"],
    generatedPromptInstructions: [
      "Pergunte qual veículo ou categoria o cliente procura antes de sugerir opções.",
      "Colete faixa de preço, cidade, interesse em financiamento e veículo na troca quando relevante.",
      "Não confirme disponibilidade de veículo sem informação cadastrada.",
      "Não garanta aprovação de financiamento ou condições de crédito.",
      "Não calcule parcelas ou valores finais sem dados válidos e cadastrados.",
      "Não confirme avaliação de veículo na troca; encaminhe para humano.",
      "Encaminhe negociações, descontos e reservas para atendimento humano."
    ]
  }),
  internet_provider: tpl("internet_provider", {
    suggestedDepartments: ["sales", "support", "billing", "qualification"],
    suggestedAllowedActions: [
      "explain_services",
      "inform_business_hours",
      "qualify_lead",
      "collect_contact_data",
      "answer_faq",
      "provide_payment_methods"
    ],
    suggestedForbiddenActions: [
      ...BASE_SAFETY_FORBIDDEN,
      "promise_availability",
      "cancel_order"
    ],
    suggestedHandoffRules: [
      "technical_issue",
      "billing_issue",
      "customer_requests_human",
      "complaint",
      "missing_information",
      "cancellation",
      "qualified_lead"
    ],
    suggestedAttendantRole: "Atendente Comercial",
    businessInfoKeys: [
      "coverageArea",
      "plans",
      "speeds",
      "residentialBusiness",
      "installation",
      "equipment",
      "contractTerms",
      "support",
      "paymentMethods",
      "businessHours",
      "installationLeadTime"
    ],
    qualificationKeys: [
      "cityNeighborhood",
      "residentialBusiness",
      "desiredSpeed",
      "deviceCount",
      "currentProvider",
      "fixedIpNeed",
      "coverageAddress",
      "issueOrSales"
    ],
    suggestedFaqKeys: ["coverage", "plans", "installation", "support", "billing"],
    simulationPromptKeys: ["coverage", "businessPlan", "technicalIssue", "cancel"],
    generatedPromptInstructions: [
      "Pergunte cidade, bairro e se o interesse é residencial ou empresarial.",
      "Nunca afirme cobertura sem consulta confiável cadastrada.",
      "Não confirme instalação ou data de instalação sem disponibilidade verificada.",
      "Não prometa velocidade garantida além do que estiver no contrato cadastrado.",
      "Encaminhe suporte técnico complexo, cobrança e cancelamento para humano."
    ]
  }),
  security_company: tpl("security_company", {
    suggestedDepartments: ["sales", "support", "scheduling", "qualification"],
    suggestedAllowedActions: [
      "explain_services",
      "qualify_lead",
      "collect_contact_data",
      "schedule",
      "answer_faq",
      "provide_location"
    ],
    suggestedForbiddenActions: [
      ...BASE_SAFETY_FORBIDDEN,
      "promise_deadline",
      "provide_legal_advice"
    ],
    suggestedHandoffRules: [
      "technical_issue",
      "sensitive_subject",
      "customer_requests_human",
      "qualified_lead",
      "complaint",
      "missing_information"
    ],
    suggestedAttendantRole: "Consultor de Segurança",
    businessInfoKeys: [
      "monitoring",
      "alarms",
      "cameras",
      "accessControl",
      "installation",
      "maintenance",
      "residentialBusiness",
      "serviceArea",
      "technicalVisits",
      "contracts"
    ],
    qualificationKeys: [
      "propertyType",
      "cityNeighborhood",
      "buildingType",
      "desiredService",
      "existingEquipment",
      "cameraSensorCount",
      "urgency",
      "visitSchedule"
    ],
    suggestedFaqKeys: ["services", "visit", "monitoring", "contracts", "area"],
    simulationPromptKeys: ["residentialQuote", "businessSecurity", "technicalVisit", "urgentIncident"],
    generatedPromptInstructions: [
      "Qualifique se o atendimento é residencial ou empresarial e qual serviço é desejado.",
      "Não prometa segurança absoluta ou resultados garantidos.",
      "Não forneça instruções que facilitem burlar sistemas de segurança.",
      "Não confirme orçamento sem avaliação técnica cadastrada.",
      "Encaminhe incidentes em andamento e casos sensíveis para humano."
    ]
  }),
  construction_materials: tpl("construction_materials", {
    suggestedDepartments: ["sales", "qualification", "after_sales"],
    suggestedAllowedActions: [
      "explain_services",
      "inform_registered_prices",
      "qualify_lead",
      "collect_contact_data",
      "send_catalog",
      "answer_faq",
      "provide_location",
      "provide_payment_methods"
    ],
    suggestedHandoffRules: [
      "negotiation_request",
      "discount_request",
      "qualified_lead",
      "missing_information",
      "complaint"
    ],
    suggestedAttendantRole: "Atendente Comercial",
    businessInfoKeys: [
      "materialCategories",
      "delivery",
      "serviceArea",
      "minimumOrder",
      "pickup",
      "paymentMethods",
      "availability",
      "quoting",
      "leadTimes"
    ],
    qualificationKeys: [
      "materialQuantity",
      "cityNeighborhood",
      "deliveryOrPickup",
      "desiredDate",
      "consumerOrBusiness",
      "fullQuoteNeed"
    ],
    suggestedFaqKeys: ["delivery", "pickup", "quote", "payment", "catalog"],
    simulationPromptKeys: ["materialQuote", "deliveryArea", "stockCheck", "discountRequest"],
    generatedPromptInstructions: [
      "Pergunte material, quantidade e se a necessidade é entrega ou retirada.",
      "Não confirme estoque sem dado atualizado cadastrado.",
      "Não prometa prazo de entrega sem confirmação disponível.",
      "Não calcule quantidade técnica de obra sem dados suficientes.",
      "Encaminhe negociação e desconto para humano."
    ]
  }),
  technical_assistance: tpl("technical_assistance", {
    suggestedDepartments: ["support", "scheduling", "reception", "after_sales"],
    suggestedAllowedActions: [
      "explain_services",
      "collect_contact_data",
      "schedule",
      "answer_faq",
      "provide_location",
      "inform_business_hours"
    ],
    suggestedHandoffRules: [
      "technical_issue",
      "customer_requests_human",
      "complaint",
      "missing_information",
      "sensitive_subject"
    ],
    suggestedAttendantRole: "Assistente de Suporte",
    businessInfoKeys: [
      "equipmentTypes",
      "brands",
      "warranty",
      "technicalVisit",
      "quoting",
      "estimatedLeadTimes",
      "address",
      "businessHours"
    ],
    qualificationKeys: [
      "equipment",
      "brandModel",
      "reportedIssue",
      "issueStart",
      "previousRepair",
      "warrantyStatus",
      "cityNeighborhood",
      "preferredSchedule"
    ],
    suggestedFaqKeys: ["warranty", "visit", "brands", "quote", "hours"],
    simulationPromptKeys: ["equipmentBroken", "repairPrice", "warrantyCheck", "talkToTechnician"],
    generatedPromptInstructions: [
      "Colete equipamento, marca/modelo e descrição do problema.",
      "Não forneça diagnóstico definitivo sem análise técnica.",
      "Não prometa preço ou prazo de reparo sem orçamento cadastrado.",
      "Não instrua reparos perigosos ou que exijam profissional habilitado.",
      "Encaminhe casos técnicos complexos para humano."
    ]
  }),
  clinic: tpl("clinic", {
    suggestedDepartments: ["reception", "scheduling", "support"],
    suggestedAllowedActions: [
      "explain_services",
      "inform_business_hours",
      "collect_contact_data",
      "schedule",
      "answer_faq",
      "provide_location"
    ],
    suggestedForbiddenActions: [
      ...BASE_SAFETY_FORBIDDEN,
      "provide_medical_diagnosis",
      "promise_deadline"
    ],
    suggestedHandoffRules: [
      "sensitive_subject",
      "customer_requests_human",
      "missing_information",
      "complaint"
    ],
    suggestedAttendantRole: "Recepcionista Virtual",
    businessInfoKeys: [
      "specialties",
      "procedures",
      "units",
      "insurance",
      "privateCare",
      "businessHours",
      "address",
      "schedulingPolicy"
    ],
    qualificationKeys: [
      "specialtyProcedure",
      "firstVisitOrReturn",
      "preferredSchedule",
      "unit",
      "insuranceOrPrivate",
      "urgencyNote"
    ],
    suggestedFaqKeys: ["scheduling", "insurance", "location", "specialties", "hours"],
    generatedPromptInstructions: [
      "Não forneça diagnóstico, prescrição ou orientação médica.",
      "Não substitua avaliação de profissional de saúde.",
      "Em casos de urgência, oriente o cliente a buscar atendimento adequado conforme informações cadastradas.",
      "Colete especialidade, tipo de consulta e preferência de horário sem confirmar agendamento sem integração.",
      "Encaminhe assuntos sensíveis e reclamações para humano."
    ]
  }),
  dental_clinic: tpl("dental_clinic", {
    suggestedDepartments: ["reception", "scheduling", "support"],
    suggestedAllowedActions: [
      "explain_services",
      "inform_business_hours",
      "collect_contact_data",
      "schedule",
      "answer_faq",
      "provide_location"
    ],
    suggestedForbiddenActions: [
      ...BASE_SAFETY_FORBIDDEN,
      "provide_medical_diagnosis",
      "promise_deadline"
    ],
    suggestedHandoffRules: [
      "sensitive_subject",
      "customer_requests_human",
      "missing_information",
      "complaint"
    ],
    suggestedAttendantRole: "Recepcionista Virtual",
    businessInfoKeys: [
      "procedures",
      "units",
      "insurance",
      "privateCare",
      "businessHours",
      "address",
      "schedulingPolicy",
      "emergencyGuidance"
    ],
    qualificationKeys: [
      "procedure",
      "firstVisitOrReturn",
      "preferredSchedule",
      "unit",
      "insuranceOrPrivate",
      "painOrUrgency"
    ],
    suggestedFaqKeys: ["scheduling", "insurance", "location", "procedures", "hours"],
    generatedPromptInstructions: [
      "Não forneça diagnóstico odontológico ou indicação de tratamento.",
      "Não prescreva medicamentos ou procedimentos.",
      "Em dor intensa ou urgência, oriente conforme política da clínica cadastrada.",
      "Colete procedimento desejado e preferência de horário sem confirmar agendamento sem integração.",
      "Encaminhe assuntos sensíveis para humano."
    ]
  }),
  real_estate: tpl("real_estate", {
    suggestedDepartments: ["sales", "qualification", "scheduling"],
    suggestedAllowedActions: [
      "explain_services",
      "qualify_lead",
      "collect_contact_data",
      "schedule",
      "answer_faq",
      "provide_location"
    ],
    suggestedHandoffRules: [
      "negotiation_request",
      "qualified_lead",
      "missing_information",
      "customer_requests_human",
      "legal_or_contract_issue"
    ],
    businessInfoKeys: ["propertyTypes", "regions", "rentSale", "visitScheduling", "documentation"],
    qualificationKeys: ["propertyType", "region", "budgetRange", "rentOrBuy", "timeline"],
    suggestedFaqKeys: ["visit", "documentation", "regions", "financing"],
    generatedPromptInstructions: [
      "Qualifique tipo de imóvel, região e interesse em compra ou locação.",
      "Não confirme disponibilidade de imóvel sem cadastro atualizado.",
      "Encaminhe negociação e questões contratuais para humano."
    ]
  }),
  restaurant: tpl("restaurant", {
    suggestedDepartments: ["reception", "scheduling", "sales"],
    suggestedAllowedActions: [
      "explain_services",
      "inform_business_hours",
      "answer_faq",
      "provide_location",
      "schedule"
    ],
    suggestedHandoffRules: ["customer_requests_human", "complaint", "missing_information"],
    businessInfoKeys: ["menuHighlights", "reservations", "delivery", "businessHours", "address"],
    qualificationKeys: ["reservationOrOrder", "partySize", "preferredTime"],
    suggestedFaqKeys: ["hours", "reservation", "delivery", "location"],
    generatedPromptInstructions: [
      "Não confirme reserva ou pedido sem integração cadastrada.",
      "Não invente itens do cardápio ou preços."
    ]
  }),
  gym: tpl("gym", {
    suggestedDepartments: ["sales", "reception", "scheduling"],
    suggestedAllowedActions: ["explain_services", "qualify_lead", "collect_contact_data", "answer_faq", "provide_location"],
    suggestedHandoffRules: ["negotiation_request", "customer_requests_human", "missing_information"],
    businessInfoKeys: ["plans", "modalities", "trial", "businessHours", "address"],
    qualificationKeys: ["goal", "planInterest", "visitInterest"],
    suggestedFaqKeys: ["plans", "trial", "hours", "location"],
    generatedPromptInstructions: [
      "Qualifique objetivo e interesse em planos sem prometer condições não cadastradas.",
      "Encaminhe negociação para humano."
    ]
  }),
  ecommerce: tpl("ecommerce", {
    suggestedDepartments: ["sales", "support", "after_sales"],
    suggestedAllowedActions: [
      "explain_services",
      "answer_faq",
      "collect_contact_data",
      "provide_payment_methods",
      "inform_registered_prices"
    ],
    suggestedHandoffRules: ["billing_issue", "complaint", "missing_information", "cancellation"],
    businessInfoKeys: ["productCategories", "shipping", "returns", "paymentMethods"],
    qualificationKeys: ["productInterest", "orderStatus"],
    suggestedFaqKeys: ["shipping", "returns", "payment", "tracking"],
    generatedPromptInstructions: [
      "Não confirme estoque, prazo de entrega ou status de pedido sem dado cadastrado.",
      "Encaminhe cancelamento e cobrança para humano."
    ]
  }),
  clothing_store: tpl("clothing_store", {
    suggestedDepartments: ["sales", "support"],
    suggestedAllowedActions: ["explain_services", "answer_faq", "provide_location", "send_catalog"],
    suggestedHandoffRules: ["negotiation_request", "missing_information", "complaint"],
    businessInfoKeys: ["categories", "sizes", "exchangePolicy", "address"],
    qualificationKeys: ["category", "size", "occasion"],
    suggestedFaqKeys: ["exchange", "sizes", "location"],
    generatedPromptInstructions: [
      "Não confirme disponibilidade de tamanho ou modelo sem estoque cadastrado.",
      "Encaminhe troca e negociação conforme política da loja."
    ]
  }),
  financial_services: tpl("financial_services", {
    suggestedDepartments: ["sales", "finance", "qualification"],
    suggestedAllowedActions: ["explain_services", "qualify_lead", "collect_contact_data", "answer_faq"],
    suggestedForbiddenActions: [...BASE_SAFETY_FORBIDDEN, "provide_legal_advice", "confirm_payment"],
    suggestedHandoffRules: ["legal_or_contract_issue", "sensitive_subject", "billing_issue", "customer_requests_human"],
    businessInfoKeys: ["services", "documentation", "eligibility", "businessHours"],
    qualificationKeys: ["serviceType", "documentationStatus"],
    suggestedFaqKeys: ["documentation", "eligibility", "hours"],
    generatedPromptInstructions: [
      "Não prometa aprovação de crédito ou condições financeiras.",
      "Não forneça orientação jurídica ou tributária.",
      "Encaminhe contratos e cobrança para humano."
    ]
  }),
  education: tpl("education", {
    suggestedDepartments: ["sales", "reception", "scheduling"],
    suggestedAllowedActions: ["explain_services", "qualify_lead", "collect_contact_data", "schedule", "answer_faq"],
    suggestedHandoffRules: ["customer_requests_human", "missing_information", "qualified_lead"],
    businessInfoKeys: ["courses", "modalities", "enrollment", "businessHours"],
    qualificationKeys: ["courseInterest", "modality", "startTimeline"],
    suggestedFaqKeys: ["courses", "enrollment", "schedule"],
    generatedPromptInstructions: [
      "Qualifique curso e modalidade de interesse.",
      "Não confirme matrícula ou vaga sem integração cadastrada."
    ]
  }),
  beauty: tpl("beauty", {
    suggestedDepartments: ["reception", "scheduling", "sales"],
    suggestedAllowedActions: ["explain_services", "schedule", "collect_contact_data", "answer_faq", "provide_location"],
    suggestedHandoffRules: ["customer_requests_human", "complaint", "missing_information"],
    businessInfoKeys: ["services", "professionals", "businessHours", "address"],
    qualificationKeys: ["serviceType", "preferredSchedule"],
    suggestedFaqKeys: ["services", "scheduling", "location"],
    generatedPromptInstructions: [
      "Colete serviço desejado e preferência de horário.",
      "Não confirme agendamento sem integração cadastrada."
    ]
  }),
  other: tpl("other", {
    suggestedDepartments: ["general", "reception"],
    suggestedAllowedActions: ["explain_services", "collect_contact_data", "answer_faq"],
    suggestedHandoffRules: ["customer_requests_human", "missing_information", "complaint", "sensitive_subject"],
    suggestedAttendantRole: "Atendente Virtual",
    businessInfoKeys: ["howItWorks", "mainOfferings", "commonQuestions", "qualificationNeeds", "humanHandoffCases"],
    qualificationKeys: ["customerNeed", "timeline", "contactPreference"],
    suggestedFaqKeys: [],
    simulationPromptKeys: ["generalInquiry", "pricingQuestion", "humanRequest", "serviceArea"],
    generatedPromptInstructions: [
      "Adapte o atendimento ao segmento informado pelo administrador.",
      "Pergunte o que o cliente precisa antes de assumir produtos ou serviços.",
      "Não invente preços, prazos, cobertura ou condições comerciais.",
      "Encaminhe para humano quando faltar informação essencial."
    ]
  })
};

const ARRAY_FIELDS: (keyof Pick<
  AiAgentSegmentTemplate,
  | "suggestedDepartments"
  | "suggestedAllowedActions"
  | "suggestedForbiddenActions"
  | "suggestedHandoffRules"
  | "businessInfoKeys"
  | "qualificationKeys"
  | "suggestedFaqKeys"
  | "simulationPromptKeys"
  | "generatedPromptInstructions"
>)[] = [
  "suggestedDepartments",
  "suggestedAllowedActions",
  "suggestedForbiddenActions",
  "suggestedHandoffRules",
  "businessInfoKeys",
  "qualificationKeys",
  "suggestedFaqKeys",
  "simulationPromptKeys",
  "generatedPromptInstructions"
];

export function normalizeAiAgentSegmentTemplate(
  template: Partial<AiAgentSegmentTemplate> & { segment?: string }
): AiAgentSegmentTemplate {
  const segment = String(template.segment || "other");
  const normalized: AiAgentSegmentTemplate = {
    segment,
    suggestedDepartments: [],
    suggestedAllowedActions: [],
    suggestedForbiddenActions: [],
    suggestedHandoffRules: [],
    suggestedAttendantRole: template.suggestedAttendantRole ?? null,
    businessInfoKeys: [],
    qualificationKeys: [],
    suggestedFaqKeys: [],
    simulationPromptKeys: [],
    generatedPromptInstructions: []
  };

  ARRAY_FIELDS.forEach((field) => {
    const value = template[field];
    normalized[field] = Array.isArray(value) ? [...value] : [];
  });

  return normalized;
}

export function getAiAgentSegmentTemplate(
  segment: string | null | undefined
): AiAgentSegmentTemplate {
  const key = String(segment || "").trim();
  if (key && AI_AGENT_SEGMENT_TEMPLATES[key]) {
    return normalizeAiAgentSegmentTemplate(AI_AGENT_SEGMENT_TEMPLATES[key]);
  }
  return normalizeAiAgentSegmentTemplate(AI_AGENT_SEGMENT_TEMPLATES.other);
}

export function buildSegmentSpecificPromptInstructions(input: {
  businessSegment: string;
  customBusinessSegment?: string | null;
}): string[] {
  const template = getAiAgentSegmentTemplate(input.businessSegment);
  const lines = [...template.generatedPromptInstructions];

  if (input.businessSegment === "other") {
    const custom = String(input.customBusinessSegment || "").trim();
    if (custom) {
      lines.unshift(`O segmento da empresa é: ${custom}.`);
    }
  }

  return lines;
}

export const AI_AGENT_SEGMENT_KEYS = AI_AGENT_BUSINESS_SEGMENTS as readonly string[];
