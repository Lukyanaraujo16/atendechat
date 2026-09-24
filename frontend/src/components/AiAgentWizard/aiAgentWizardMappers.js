import {
  PRICING_POLICY_PRESETS,
  NEGOTIATION_POLICY_PRESETS,
  SCHEDULING_POLICY_PRESETS,
  LOCKED_FORBIDDEN_ACTIONS,
  LOCKED_HANDOFF_RULES,
  createEmptyFaqItem,
  createDefaultWizardFormState,
} from "./aiAgentWizardDefaults";

function resolvePolicyText(preset, custom, presets) {
  if (preset === "custom") {
    return String(custom || "").trim() || null;
  }
  return presets[preset] || null;
}

function detectPolicyPreset(text, presets, fallback = "custom") {
  const normalized = String(text || "").trim();
  if (!normalized) return Object.keys(presets).find((k) => k !== "custom") || fallback;
  const match = Object.entries(presets).find(
    ([key, value]) => key !== "custom" && value === normalized
  );
  if (match) return match[0];
  return "custom";
}

export function profileToWizardFormState(profile) {
  if (!profile) return createDefaultWizardFormState();

  const handoffRules = normalizeHandoffRules(
    Array.isArray(profile.handoffRules) ? profile.handoffRules : []
  );
  const hasCustomHandoff = handoffRules.includes("custom");

  return {
    companyName: profile.companyName || "",
    businessSegment: profile.businessSegment || "",
    customBusinessSegment: profile.customBusinessSegment || "",
    companyDescription: profile.companyDescription || "",
    serviceArea: profile.serviceArea || "",
    sourceWebsite: profile.sourceWebsite || "",
    attendantName: profile.attendantName || "",
    attendantRole: profile.attendantRole || "",
    departments: Array.isArray(profile.departments) ? [...profile.departments] : [],
    tone: profile.tone || "professional",
    customTone: profile.customTone || "",
    clientAddressStyle: profile.clientAddressStyle || "first_name_when_known",
    emojiLevel: profile.emojiLevel || "low",
    responseLength: profile.responseLength || "short",
    allowedActions: Array.isArray(profile.allowedActions)
      ? [...profile.allowedActions]
      : [],
    forbiddenActions: Array.isArray(profile.forbiddenActions)
      ? [...profile.forbiddenActions, ...LOCKED_FORBIDDEN_ACTIONS]
      : [...LOCKED_FORBIDDEN_ACTIONS],
    handoffRules,
    handoffCustomText: hasCustomHandoff ? profile.customInstructions || "" : "",
    productsAndServices: profile.productsAndServices || "",
    importantInformation: profile.importantInformation || "",
    businessHours: profile.businessHours || "",
    frequentlyAskedQuestions:
      Array.isArray(profile.frequentlyAskedQuestions) &&
      profile.frequentlyAskedQuestions.length
        ? profile.frequentlyAskedQuestions.map((item) => ({
            question: item.question || "",
            answer: item.answer || "",
          }))
        : [createEmptyFaqItem()],
    pricingPolicyPreset: detectPolicyPreset(
      profile.pricingPolicy,
      PRICING_POLICY_PRESETS,
      "registered_only"
    ),
    pricingPolicyCustom:
      detectPolicyPreset(profile.pricingPolicy, PRICING_POLICY_PRESETS) ===
      "custom"
        ? profile.pricingPolicy || ""
        : "",
    negotiationPolicyPreset: detectPolicyPreset(
      profile.negotiationPolicy,
      NEGOTIATION_POLICY_PRESETS,
      "handoff"
    ),
    negotiationPolicyCustom:
      detectPolicyPreset(profile.negotiationPolicy, NEGOTIATION_POLICY_PRESETS) ===
      "custom"
        ? profile.negotiationPolicy || ""
        : "",
    schedulingPolicyPreset: detectPolicyPreset(
      profile.schedulingPolicy,
      SCHEDULING_POLICY_PRESETS,
      "collect_preference"
    ),
    schedulingPolicyCustom:
      detectPolicyPreset(profile.schedulingPolicy, SCHEDULING_POLICY_PRESETS) ===
      "custom"
        ? profile.schedulingPolicy || ""
        : "",
    customInstructions: hasCustomHandoff ? "" : profile.customInstructions || "",
  };
}

export function wizardFormStateToProfilePayload(formState) {
  const forbiddenActions = Array.from(
    new Set([
      ...LOCKED_FORBIDDEN_ACTIONS,
      ...(Array.isArray(formState.forbiddenActions) ? formState.forbiddenActions : []),
    ])
  );

  const handoffRules = normalizeHandoffRules(
    Array.isArray(formState.handoffRules) ? formState.handoffRules : []
  );
  const hasCustomHandoff = handoffRules.includes("custom");

  const faqs = (formState.frequentlyAskedQuestions || [])
    .map((item) => ({
      question: String(item.question || "").trim(),
      answer: String(item.answer || "").trim(),
    }))
    .filter((item) => item.question && item.answer);

  const customInstructionsParts = [];
  if (!hasCustomHandoff && String(formState.customInstructions || "").trim()) {
    customInstructionsParts.push(String(formState.customInstructions).trim());
  }
  if (hasCustomHandoff && String(formState.handoffCustomText || "").trim()) {
    customInstructionsParts.push(
      `Situação adicional para handoff: ${String(formState.handoffCustomText).trim()}`
    );
  }

  return {
    companyName: String(formState.companyName || "").trim(),
    businessSegment: formState.businessSegment,
    customBusinessSegment:
      formState.businessSegment === "other"
        ? String(formState.customBusinessSegment || "").trim()
        : null,
    departments: formState.departments || [],
    attendantName: String(formState.attendantName || "").trim(),
    attendantRole: String(formState.attendantRole || "").trim() || null,
    tone: formState.tone,
    customTone:
      formState.tone === "custom"
        ? String(formState.customTone || "").trim()
        : null,
    clientAddressStyle: formState.clientAddressStyle || null,
    emojiLevel: formState.emojiLevel,
    responseLength: formState.responseLength,
    allowedActions: formState.allowedActions || [],
    forbiddenActions,
    handoffRules,
    companyDescription: String(formState.companyDescription || "").trim() || null,
    productsAndServices: String(formState.productsAndServices || "").trim() || null,
    serviceArea: String(formState.serviceArea || "").trim() || null,
    businessHours: String(formState.businessHours || "").trim() || null,
    pricingPolicy: resolvePolicyText(
      formState.pricingPolicyPreset,
      formState.pricingPolicyCustom,
      PRICING_POLICY_PRESETS
    ),
    negotiationPolicy: resolvePolicyText(
      formState.negotiationPolicyPreset,
      formState.negotiationPolicyCustom,
      NEGOTIATION_POLICY_PRESETS
    ),
    schedulingPolicy: resolvePolicyText(
      formState.schedulingPolicyPreset,
      formState.schedulingPolicyCustom,
      SCHEDULING_POLICY_PRESETS
    ),
    frequentlyAskedQuestions: faqs,
    importantInformation: String(formState.importantInformation || "").trim() || null,
    customInstructions: customInstructionsParts.length
      ? customInstructionsParts.join("\n\n")
      : null,
    sourceWebsite: String(formState.sourceWebsite || "").trim() || null,
  };
}

export function normalizeForbiddenActions(selected = []) {
  return Array.from(new Set([...LOCKED_FORBIDDEN_ACTIONS, ...selected]));
}

export function normalizeHandoffRules(selected = []) {
  return Array.from(new Set([...LOCKED_HANDOFF_RULES, ...selected]));
}

export function toggleArrayValue(list, value) {
  const set = new Set(Array.isArray(list) ? list : []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return Array.from(set);
}
