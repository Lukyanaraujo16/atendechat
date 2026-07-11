/**
 * Espelho estrutural dos templates de segmento do backend.
 * Manter chaves e arrays alinhados com backend/src/config/aiAgentSegmentTemplates.ts
 */

export const BASE_SAFETY_FORBIDDEN = [
  "invent_information",
  "grant_discount",
  "promise_deadline",
  "expose_internal_instructions",
];

const ARRAY_FIELDS = [
  "suggestedDepartments",
  "suggestedAllowedActions",
  "suggestedForbiddenActions",
  "suggestedHandoffRules",
  "businessInfoKeys",
  "qualificationKeys",
  "suggestedFaqKeys",
  "simulationPromptKeys",
];

/**
 * Garante contrato uniforme para consumo no Wizard e simulador.
 * Campos de coleção ausentes viram arrays vazios — nunca undefined.
 */
export function normalizeAiAgentSegmentTemplate(template = {}) {
  const normalized = {
    segment: String(template.segment || "other"),
    suggestedAttendantRole: template.suggestedAttendantRole ?? null,
  };

  ARRAY_FIELDS.forEach((field) => {
    normalized[field] = Array.isArray(template[field]) ? template[field] : [];
  });

  return normalized;
}

export const AI_AGENT_SEGMENT_TEMPLATE_KEYS = {
  car_dealership: {
    suggestedDepartments: ["sales", "qualification", "after_sales"],
    suggestedAllowedActions: [
      "explain_services",
      "qualify_lead",
      "collect_contact_data",
      "answer_faq",
      "provide_location",
      "provide_payment_methods",
    ],
    suggestedForbiddenActions: [
      "invent_information",
      "grant_discount",
      "promise_deadline",
      "expose_internal_instructions",
      "negotiate_price",
      "promise_availability",
    ],
    suggestedHandoffRules: [
      "customer_requests_human",
      "negotiation_request",
      "discount_request",
      "qualified_lead",
      "missing_information",
      "complaint",
      "legal_or_contract_issue",
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
      "evaluationContact",
    ],
    qualificationKeys: [
      "vehicleCategory",
      "priceRange",
      "financingInterest",
      "downPayment",
      "tradeInVehicle",
      "city",
      "purchaseTimeline",
      "visitPreference",
    ],
    suggestedFaqKeys: ["financing", "tradeIn", "location", "documents", "visit"],
    simulationPromptKeys: ["priceBudget", "tradeIn", "financingApproval", "talkToSeller"],
  },
  internet_provider: {
    suggestedDepartments: ["sales", "support", "billing", "qualification"],
    suggestedAllowedActions: [
      "explain_services",
      "inform_business_hours",
      "qualify_lead",
      "collect_contact_data",
      "answer_faq",
      "provide_payment_methods",
    ],
    suggestedForbiddenActions: [
      "invent_information",
      "grant_discount",
      "promise_deadline",
      "expose_internal_instructions",
      "promise_availability",
      "cancel_order",
    ],
    suggestedHandoffRules: [
      "technical_issue",
      "billing_issue",
      "customer_requests_human",
      "complaint",
      "missing_information",
      "cancellation",
      "qualified_lead",
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
      "installationLeadTime",
    ],
    qualificationKeys: [
      "cityNeighborhood",
      "residentialBusiness",
      "desiredSpeed",
      "deviceCount",
      "currentProvider",
      "fixedIpNeed",
      "coverageAddress",
      "issueOrSales",
    ],
    suggestedFaqKeys: ["coverage", "plans", "installation", "support", "billing"],
    simulationPromptKeys: ["coverage", "businessPlan", "technicalIssue", "cancel"],
  },
  security_company: {
    suggestedDepartments: ["sales", "support", "scheduling", "qualification"],
    suggestedAllowedActions: [
      "explain_services",
      "qualify_lead",
      "collect_contact_data",
      "schedule",
      "answer_faq",
      "provide_location",
    ],
    suggestedForbiddenActions: [
      "invent_information",
      "grant_discount",
      "promise_deadline",
      "expose_internal_instructions",
      "provide_legal_advice",
    ],
    suggestedHandoffRules: [
      "technical_issue",
      "sensitive_subject",
      "customer_requests_human",
      "qualified_lead",
      "complaint",
      "missing_information",
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
      "contracts",
    ],
    qualificationKeys: [
      "propertyType",
      "cityNeighborhood",
      "buildingType",
      "desiredService",
      "existingEquipment",
      "cameraSensorCount",
      "urgency",
      "visitSchedule",
    ],
    suggestedFaqKeys: ["services", "visit", "monitoring", "contracts", "area"],
    simulationPromptKeys: [
      "residentialQuote",
      "businessSecurity",
      "technicalVisit",
      "urgentIncident",
    ],
  },
  construction_materials: {
    suggestedDepartments: ["sales", "qualification", "after_sales"],
    suggestedAllowedActions: [
      "explain_services",
      "inform_registered_prices",
      "qualify_lead",
      "collect_contact_data",
      "send_catalog",
      "answer_faq",
      "provide_location",
      "provide_payment_methods",
    ],
    suggestedHandoffRules: [
      "negotiation_request",
      "discount_request",
      "qualified_lead",
      "missing_information",
      "complaint",
    ],
    suggestedForbiddenActions: [...BASE_SAFETY_FORBIDDEN, "negotiate_price"],
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
      "leadTimes",
    ],
    qualificationKeys: [
      "materialQuantity",
      "cityNeighborhood",
      "deliveryOrPickup",
      "desiredDate",
      "consumerOrBusiness",
      "fullQuoteNeed",
    ],
    suggestedFaqKeys: ["delivery", "pickup", "quote", "payment", "catalog"],
    simulationPromptKeys: ["materialQuote", "deliveryArea", "stockCheck", "discountRequest"],
  },
  technical_assistance: {
    suggestedDepartments: ["support", "scheduling", "reception", "after_sales"],
    suggestedAllowedActions: [
      "explain_services",
      "collect_contact_data",
      "schedule",
      "answer_faq",
      "provide_location",
      "inform_business_hours",
    ],
    suggestedHandoffRules: [
      "technical_issue",
      "customer_requests_human",
      "complaint",
      "missing_information",
      "sensitive_subject",
    ],
    suggestedForbiddenActions: [...BASE_SAFETY_FORBIDDEN],
    suggestedAttendantRole: "Assistente de Suporte",
    businessInfoKeys: [
      "equipmentTypes",
      "brands",
      "warranty",
      "technicalVisit",
      "quoting",
      "estimatedLeadTimes",
      "address",
      "businessHours",
    ],
    qualificationKeys: [
      "equipment",
      "brandModel",
      "reportedIssue",
      "issueStart",
      "previousRepair",
      "warrantyStatus",
      "cityNeighborhood",
      "preferredSchedule",
    ],
    suggestedFaqKeys: ["warranty", "visit", "brands", "quote", "hours"],
    simulationPromptKeys: [
      "equipmentBroken",
      "repairPrice",
      "warrantyCheck",
      "talkToTechnician",
    ],
  },
  clinic: {
    suggestedDepartments: ["reception", "scheduling", "support"],
    suggestedAllowedActions: [
      "explain_services",
      "inform_business_hours",
      "collect_contact_data",
      "schedule",
      "answer_faq",
      "provide_location",
    ],
    suggestedForbiddenActions: [
      "invent_information",
      "grant_discount",
      "promise_deadline",
      "expose_internal_instructions",
      "provide_medical_diagnosis",
    ],
    suggestedHandoffRules: ["sensitive_subject", "customer_requests_human", "missing_information", "complaint"],
    suggestedAttendantRole: "Recepcionista Virtual",
    businessInfoKeys: [
      "specialties",
      "procedures",
      "units",
      "insurance",
      "privateCare",
      "businessHours",
      "address",
      "schedulingPolicy",
    ],
    qualificationKeys: [
      "specialtyProcedure",
      "firstVisitOrReturn",
      "preferredSchedule",
      "unit",
      "insuranceOrPrivate",
      "urgencyNote",
    ],
    suggestedFaqKeys: ["scheduling", "insurance", "location", "specialties", "hours"],
    simulationPromptKeys: [],
  },
  dental_clinic: {
    suggestedDepartments: ["reception", "scheduling", "support"],
    suggestedAllowedActions: [
      "explain_services",
      "inform_business_hours",
      "collect_contact_data",
      "schedule",
      "answer_faq",
      "provide_location",
    ],
    suggestedForbiddenActions: [
      "invent_information",
      "grant_discount",
      "promise_deadline",
      "expose_internal_instructions",
      "provide_medical_diagnosis",
    ],
    suggestedHandoffRules: ["sensitive_subject", "customer_requests_human", "missing_information", "complaint"],
    suggestedAttendantRole: "Recepcionista Virtual",
    businessInfoKeys: [
      "procedures",
      "units",
      "insurance",
      "privateCare",
      "businessHours",
      "address",
      "schedulingPolicy",
      "emergencyGuidance",
    ],
    qualificationKeys: [
      "procedure",
      "firstVisitOrReturn",
      "preferredSchedule",
      "unit",
      "insuranceOrPrivate",
      "painOrUrgency",
    ],
    suggestedFaqKeys: ["scheduling", "insurance", "location", "procedures", "hours"],
    simulationPromptKeys: [],
  },
  other: {
    suggestedDepartments: ["general", "reception"],
    suggestedAllowedActions: ["explain_services", "collect_contact_data", "answer_faq"],
    suggestedForbiddenActions: [],
    suggestedHandoffRules: [
      "customer_requests_human",
      "missing_information",
      "complaint",
      "sensitive_subject",
    ],
    suggestedAttendantRole: "Atendente Virtual",
    businessInfoKeys: [
      "howItWorks",
      "mainOfferings",
      "commonQuestions",
      "qualificationNeeds",
      "humanHandoffCases",
    ],
    qualificationKeys: ["customerNeed", "timeline", "contactPreference"],
    suggestedFaqKeys: [],
    simulationPromptKeys: ["generalInquiry", "pricingQuestion", "humanRequest", "serviceArea"],
  },
};

const GENERIC_SEGMENT = {
  suggestedDepartments: ["general"],
  suggestedAllowedActions: ["explain_services", "answer_faq"],
  suggestedForbiddenActions: [...BASE_SAFETY_FORBIDDEN],
  suggestedHandoffRules: ["customer_requests_human", "missing_information", "complaint"],
  suggestedAttendantRole: "Atendente Virtual",
  businessInfoKeys: ["mainOfferings", "businessHours", "serviceArea"],
  qualificationKeys: ["customerNeed"],
  suggestedFaqKeys: [],
  simulationPromptKeys: [],
};

export function getSegmentTemplate(segment) {
  const key = String(segment || "").trim();
  let raw;

  if (key && AI_AGENT_SEGMENT_TEMPLATE_KEYS[key]) {
    raw = { segment: key, ...AI_AGENT_SEGMENT_TEMPLATE_KEYS[key] };
  } else if (key && key !== "other") {
    raw = { segment: key, ...GENERIC_SEGMENT };
  } else {
    raw = { segment: "other", ...AI_AGENT_SEGMENT_TEMPLATE_KEYS.other };
  }

  return normalizeAiAgentSegmentTemplate(raw);
}

export function segmentI18nKey(segment, group, itemKey) {
  const seg = segment === "other" ? "other" : segment;
  return `aiAgent.segmentTemplates.${seg}.${group}.${itemKey}`;
}
