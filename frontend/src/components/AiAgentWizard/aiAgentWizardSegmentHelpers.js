import { LOCKED_FORBIDDEN_ACTIONS, createEmptyFaqItem } from "./aiAgentWizardDefaults";
import { getSegmentTemplate, segmentI18nKey } from "../../config/aiAgentSegmentTemplates";
import { i18n } from "../../translate/i18n";

function mergeUnique(list = [], additions = []) {
  return Array.from(new Set([...(list || []), ...additions]));
}

function isEmptyText(value) {
  return !String(value || "").trim();
}

export function previewApplySegmentRecommendations(formState, segment) {
  const template = getSegmentTemplate(segment);
  const summary = {
    departments: 0,
    allowedActions: 0,
    forbiddenActions: 0,
    handoffRules: 0,
    attendantRole: false,
  };

  template.suggestedDepartments.forEach((item) => {
    if (!(formState.departments || []).includes(item)) summary.departments += 1;
  });
  template.suggestedAllowedActions.forEach((item) => {
    if (!(formState.allowedActions || []).includes(item)) summary.allowedActions += 1;
  });
  template.suggestedForbiddenActions.forEach((item) => {
    if (!(formState.forbiddenActions || []).includes(item)) summary.forbiddenActions += 1;
  });
  template.suggestedHandoffRules.forEach((item) => {
    if (!(formState.handoffRules || []).includes(item)) summary.handoffRules += 1;
  });
  if (isEmptyText(formState.attendantRole) && template.suggestedAttendantRole) {
    summary.attendantRole = true;
  }

  return summary;
}

export function applySegmentRecommendations(formState, segment) {
  const template = getSegmentTemplate(segment);
  const patch = {};

  patch.departments = mergeUnique(formState.departments, template.suggestedDepartments);
  patch.allowedActions = mergeUnique(
    formState.allowedActions,
    template.suggestedAllowedActions
  );
  patch.forbiddenActions = mergeUnique(
    mergeUnique(formState.forbiddenActions, template.suggestedForbiddenActions),
    LOCKED_FORBIDDEN_ACTIONS
  );
  patch.handoffRules = mergeUnique(formState.handoffRules, template.suggestedHandoffRules);

  if (isEmptyText(formState.attendantRole) && template.suggestedAttendantRole) {
    patch.attendantRole = template.suggestedAttendantRole;
  }

  return { ...formState, ...patch };
}

export function suggestFaqsFromSegment(segment, existingFaqs = []) {
  const template = getSegmentTemplate(segment);
  const existingQuestions = new Set(
    (existingFaqs || [])
      .map((item) => String(item.question || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const additions = [];
  template.suggestedFaqKeys.forEach((key) => {
    const question = i18n.t(segmentI18nKey(segment, "faq", key));
    const normalized = question.trim().toLowerCase();
    if (!normalized || existingQuestions.has(normalized)) return;
    existingQuestions.add(normalized);
    additions.push({ question, answer: "" });
  });

  const base = (existingFaqs || []).filter(
    (item) => String(item.question || "").trim() || String(item.answer || "").trim()
  );

  if (!base.length && !additions.length) {
    return [createEmptyFaqItem()];
  }

  return [...base, ...additions];
}

const FIELD_MAP = {
  vehicleTypes: "productsAndServices",
  newUsed: "productsAndServices",
  serviceArea: "serviceArea",
  financing: "productsAndServices",
  tradeIn: "importantInformation",
  documentation: "importantInformation",
  reservationPolicy: "importantInformation",
  businessHours: "businessHours",
  address: "importantInformation",
  paymentMethods: "importantInformation",
  evaluationContact: "importantInformation",
  coverageArea: "serviceArea",
  plans: "productsAndServices",
  speeds: "productsAndServices",
  residentialBusiness: "importantInformation",
  installation: "importantInformation",
  equipment: "productsAndServices",
  contractTerms: "importantInformation",
  support: "importantInformation",
  installationLeadTime: "importantInformation",
  monitoring: "productsAndServices",
  alarms: "productsAndServices",
  cameras: "productsAndServices",
  accessControl: "productsAndServices",
  maintenance: "importantInformation",
  technicalVisits: "importantInformation",
  contracts: "importantInformation",
  materialCategories: "productsAndServices",
  delivery: "importantInformation",
  minimumOrder: "importantInformation",
  pickup: "importantInformation",
  availability: "importantInformation",
  quoting: "importantInformation",
  leadTimes: "importantInformation",
  equipmentTypes: "productsAndServices",
  brands: "productsAndServices",
  warranty: "importantInformation",
  technicalVisit: "importantInformation",
  estimatedLeadTimes: "importantInformation",
  specialties: "productsAndServices",
  procedures: "productsAndServices",
  units: "importantInformation",
  insurance: "importantInformation",
  privateCare: "importantInformation",
  schedulingPolicy: "importantInformation",
  emergencyGuidance: "importantInformation",
  howItWorks: "companyDescription",
  mainOfferings: "productsAndServices",
  commonQuestions: "importantInformation",
  qualificationNeeds: "importantInformation",
  humanHandoffCases: "importantInformation",
  propertyTypes: "productsAndServices",
  regions: "serviceArea",
  rentSale: "importantInformation",
  visitScheduling: "importantInformation",
  menuHighlights: "productsAndServices",
  reservations: "importantInformation",
  modalities: "productsAndServices",
  trial: "importantInformation",
  productCategories: "productsAndServices",
  shipping: "importantInformation",
  returns: "importantInformation",
  categories: "productsAndServices",
  sizes: "importantInformation",
  exchangePolicy: "importantInformation",
  services: "productsAndServices",
  documentation: "importantInformation",
  eligibility: "importantInformation",
  courses: "productsAndServices",
  enrollment: "importantInformation",
  professionals: "importantInformation",
};

export function buildBusinessInfoChecklist(formState, segment) {
  const template = getSegmentTemplate(segment);
  return template.businessInfoKeys.map((key) => {
    const field = FIELD_MAP[key] || "importantInformation";
    const informed = !isEmptyText(formState[field]);
    return {
      key,
      labelKey: segmentI18nKey(segment, "businessInfo", key),
      informed,
    };
  });
}

export function buildQualificationHints(segment) {
  const template = getSegmentTemplate(segment);
  return template.qualificationKeys.map((key) => ({
    key,
    labelKey: segmentI18nKey(segment, "qualification", key),
  }));
}
