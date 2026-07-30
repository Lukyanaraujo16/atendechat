import { AI_AGENT_PROFILE_LIMITS } from "../../config/aiAgentProfileOptions";
import { LOCKED_FORBIDDEN_ACTIONS } from "./aiAgentWizardDefaults";

const URL_PATTERN = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;

export function validateWizardStep(stepId, formState) {
  const errors = {};

  if (stepId === "company") {
    if (!String(formState.identityName || "").trim()) {
      errors.identityName = "required";
    } else if (String(formState.identityName).trim().length > 120) {
      errors.identityName = "tooLong";
    }

    if (!String(formState.companyName || "").trim()) {
      errors.companyName = "required";
    } else if (
      String(formState.companyName).trim().length > AI_AGENT_PROFILE_LIMITS.companyName
    ) {
      errors.companyName = "tooLong";
    }

    if (!formState.businessSegment) {
      errors.businessSegment = "required";
    }

    if (formState.businessSegment === "other") {
      if (!String(formState.customBusinessSegment || "").trim()) {
        errors.customBusinessSegment = "required";
      }
    }

    const website = String(formState.sourceWebsite || "").trim();
    if (website && !URL_PATTERN.test(website)) {
      errors.sourceWebsite = "invalidUrl";
    }
  }

  if (stepId === "attendant") {
    if (!String(formState.attendantName || "").trim()) {
      errors.attendantName = "required";
    }
    if (!Array.isArray(formState.departments) || formState.departments.length === 0) {
      errors.departments = "required";
    }
  }

  if (stepId === "personality") {
    if (!formState.tone) errors.tone = "required";
    if (formState.tone === "custom" && !String(formState.customTone || "").trim()) {
      errors.customTone = "required";
    }
    if (!formState.emojiLevel) errors.emojiLevel = "required";
    if (!formState.responseLength) errors.responseLength = "required";
  }

  if (stepId === "handoff") {
    if (formState.handoffRules?.includes("custom")) {
      if (!String(formState.handoffCustomText || "").trim()) {
        errors.handoffCustomText = "required";
      }
    }
  }

  if (stepId === "businessKnowledge") {
    const website = String(formState.sourceWebsite || "").trim();
    if (website && !URL_PATTERN.test(website)) {
      errors.sourceWebsite = "invalidUrl";
    }

    const faqs = formState.frequentlyAskedQuestions || [];
    faqs.forEach((item, index) => {
      const q = String(item.question || "").trim();
      const a = String(item.answer || "").trim();
      if ((q && !a) || (!q && a)) {
        errors[`faq_${index}`] = "incomplete";
      }
      if (q.length > AI_AGENT_PROFILE_LIMITS.faqQuestionMax) {
        errors[`faq_${index}_question`] = "tooLong";
      }
      if (a.length > AI_AGENT_PROFILE_LIMITS.faqAnswerMax) {
        errors[`faq_${index}_answer`] = "tooLong";
      }
    });

    const filledFaqs = faqs.filter(
      (item) => String(item.question || "").trim() && String(item.answer || "").trim()
    );
    if (filledFaqs.length > AI_AGENT_PROFILE_LIMITS.faqMaxItems) {
      errors.frequentlyAskedQuestions = "tooMany";
    }
  }

  if (stepId === "policies") {
    if (formState.pricingPolicyPreset === "custom") {
      if (!String(formState.pricingPolicyCustom || "").trim()) {
        errors.pricingPolicyCustom = "required";
      }
    }
    if (formState.negotiationPolicyPreset === "custom") {
      if (!String(formState.negotiationPolicyCustom || "").trim()) {
        errors.negotiationPolicyCustom = "required";
      }
    }
    if (formState.schedulingPolicyPreset === "custom") {
      if (!String(formState.schedulingPolicyCustom || "").trim()) {
        errors.schedulingPolicyCustom = "required";
      }
    }
  }

  return errors;
}

export function hasWizardValidationErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function isForbiddenActionLocked(value) {
  return LOCKED_FORBIDDEN_ACTIONS.includes(value);
}

export function mapBackendErrorToWizardFields(err) {
  const message =
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    "";
  const fields = {};

  if (/Segmento personalizado/i.test(message)) {
    fields.customBusinessSegment = "required";
  }
  if (/Tom personalizado/i.test(message)) {
    fields.customTone = "required";
  }
  if (/Nome da empresa/i.test(message)) {
    fields.companyName = "required";
  }
  if (/Nome do atendente/i.test(message)) {
    fields.attendantName = "required";
  }
  if (/Departamento/i.test(message)) {
    fields.departments = "required";
  }
  if (/URL/i.test(message) || /site/i.test(message)) {
    fields.sourceWebsite = "invalidUrl";
  }

  return { message, fields };
}
