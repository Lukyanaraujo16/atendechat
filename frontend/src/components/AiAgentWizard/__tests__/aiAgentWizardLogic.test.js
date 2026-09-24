import {
  createDefaultWizardFormState,
  LOCKED_FORBIDDEN_ACTIONS,
  LOCKED_HANDOFF_RULES,
  LEGACY_NEGOTIATION_POLICY_ALIASES,
  NEGOTIATION_POLICY_PRESETS,
  PRICING_POLICY_PRESETS,
  SCHEDULING_POLICY_PRESETS,
} from "../aiAgentWizardDefaults";
import {
  detectPolicyPreset,
  normalizeForbiddenActions,
  normalizeHandoffRules,
  profileToWizardFormState,
  resolvePolicyText,
  wizardFormStateToProfilePayload,
} from "../aiAgentWizardMappers";
import {
  applySegmentRecommendations,
  buildBusinessInfoChecklist,
  previewApplySegmentRecommendations,
  suggestFaqsFromSegment,
} from "../aiAgentWizardSegmentHelpers";
import {
  getSegmentTemplate,
  normalizeAiAgentSegmentTemplate,
  segmentI18nKey,
  AI_AGENT_SEGMENT_TEMPLATE_KEYS,
} from "../../../config/aiAgentSegmentTemplates";
import { getSimulationPrompts } from "../../AiAgentSimulator/aiAgentSimulatorHelpers";
import { AI_AGENT_BUSINESS_SEGMENTS } from "../../../config/aiAgentProfileOptions";
import {
  hasWizardValidationErrors,
  isForbiddenActionLocked,
  isHandoffRuleLocked,
  validateWizardStep,
} from "../aiAgentWizardValidation";

describe("aiAgentWizard validation", () => {
  const base = createDefaultWizardFormState();

  it("não avança company sem identityName", () => {
    const errors = validateWizardStep("company", {
      ...base,
      identityName: "",
      companyName: "Empresa",
      businessSegment: "clinic",
    });
    expect(hasWizardValidationErrors(errors)).toBe(true);
    expect(errors.identityName).toBe("required");
  });

  it("não avança company sem companyName", () => {
    const errors = validateWizardStep("company", {
      ...base,
      identityName: "Agente Comercial",
      companyName: "",
      businessSegment: "clinic",
    });
    expect(hasWizardValidationErrors(errors)).toBe(true);
    expect(errors.companyName).toBe("required");
  });

  it("segmento other exige customBusinessSegment", () => {
    const errors = validateWizardStep("company", {
      ...base,
      identityName: "Agente Comercial",
      companyName: "Empresa",
      businessSegment: "other",
      customBusinessSegment: "",
    });
    expect(errors.customBusinessSegment).toBe("required");
  });

  it("não avança attendant sem nome e departamentos", () => {
    const errors = validateWizardStep("attendant", {
      ...base,
      attendantName: "",
      departments: [],
    });
    expect(errors.attendantName).toBe("required");
    expect(errors.departments).toBe("required");
  });

  it("tom custom exige customTone", () => {
    const errors = validateWizardStep("personality", {
      ...base,
      tone: "custom",
      customTone: "",
      emojiLevel: "low",
      responseLength: "short",
    });
    expect(errors.customTone).toBe("required");
  });
});

describe("aiAgentWizard mappers", () => {
  it("carrega defaults seguros", () => {
    const defaults = createDefaultWizardFormState();
    expect(defaults.tone).toBe("professional");
    expect(defaults.emojiLevel).toBe("low");
    expect(defaults.forbiddenActions).toEqual(
      expect.arrayContaining(LOCKED_FORBIDDEN_ACTIONS)
    );
  });

  it("ações proibidas obrigatórias não podem ser removidas", () => {
    const normalized = normalizeForbiddenActions([]);
    expect(normalized).toEqual(expect.arrayContaining(LOCKED_FORBIDDEN_ACTIONS));
    expect(isForbiddenActionLocked("invent_information")).toBe(true);
  });

  it("K — customer_requests_human não pode ser desativado", () => {
    expect(isHandoffRuleLocked("customer_requests_human")).toBe(true);
    expect(isHandoffRuleLocked("complaint")).toBe(false);
    expect(LOCKED_HANDOFF_RULES).toEqual(["customer_requests_human"]);
    expect(normalizeHandoffRules([])).toContain("customer_requests_human");
    expect(normalizeHandoffRules(["complaint"])).toEqual(
      expect.arrayContaining(["customer_requests_human", "complaint"])
    );
    const payload = wizardFormStateToProfilePayload({
      ...createDefaultWizardFormState(),
      companyName: "Empresa X",
      businessSegment: "clinic",
      attendantName: "Ana",
      departments: ["sales"],
      handoffRules: ["complaint"],
    });
    expect(payload.handoffRules).toContain("customer_requests_human");
    expect(payload.handoffRules).toContain("complaint");
  });

  it("M — política de não negociar não instrui handoff escondido", () => {
    expect(NEGOTIATION_POLICY_PRESETS.handoff).not.toMatch(/encaminha/i);
    expect(NEGOTIATION_POLICY_PRESETS.handoff).toMatch(/recuse|explique/i);
  });

  it("H5-C I — snapshot legado conhecido de negociação mapeia para o preset atual", () => {
    const legacy = "Não negocia valores; encaminha para atendimento humano.";
    expect(LEGACY_NEGOTIATION_POLICY_ALIASES[legacy]).toBe("handoff");
    const form = profileToWizardFormState({
      companyName: "Empresa",
      businessSegment: "clinic",
      attendantName: "Ana",
      departments: ["sales"],
      negotiationPolicy: legacy,
    });
    expect(form.negotiationPolicyPreset).toBe("handoff");
    expect(form.negotiationPolicyCustom).toBe("");
    const payload = wizardFormStateToProfilePayload({
      ...form,
      companyName: "Empresa",
      businessSegment: "clinic",
      attendantName: "Ana",
      departments: ["sales"],
    });
    expect(payload.negotiationPolicy).toBe(NEGOTIATION_POLICY_PRESETS.handoff);
    expect(payload.negotiationPolicy).not.toBe(legacy);
    expect(payload.negotiationPolicy).not.toMatch(/encaminha para atendimento humano/);
  });

  it("H5-C J — preset atual de negociação faz round-trip", () => {
    const current = NEGOTIATION_POLICY_PRESETS.handoff;
    const form = profileToWizardFormState({
      companyName: "Empresa",
      businessSegment: "clinic",
      attendantName: "Ana",
      departments: ["sales"],
      negotiationPolicy: current,
    });
    expect(form.negotiationPolicyPreset).toBe("handoff");
    expect(form.negotiationPolicyCustom).toBe("");
    const payload = wizardFormStateToProfilePayload({
      ...form,
      companyName: "Empresa",
      businessSegment: "clinic",
      attendantName: "Ana",
      departments: ["sales"],
    });
    expect(payload.negotiationPolicy).toBe(current);
  });

  it("H5-C K — texto realmente customizado permanece custom", () => {
    const custom = "Negocia até 10% somente com aprovação do gerente.";
    const form = profileToWizardFormState({
      companyName: "Empresa",
      businessSegment: "clinic",
      attendantName: "Ana",
      departments: ["sales"],
      negotiationPolicy: custom,
    });
    expect(form.negotiationPolicyPreset).toBe("custom");
    expect(form.negotiationPolicyCustom).toBe(custom);
    expect(
      detectPolicyPreset(custom, NEGOTIATION_POLICY_PRESETS, "custom", LEGACY_NEGOTIATION_POLICY_ALIASES)
    ).toBe("custom");
    expect(
      detectPolicyPreset(
        "A política menciona atendimento humano, mas é texto próprio.",
        NEGOTIATION_POLICY_PRESETS,
        "custom",
        LEGACY_NEGOTIATION_POLICY_ALIASES
      )
    ).toBe("custom");
    const payload = wizardFormStateToProfilePayload({
      ...form,
      companyName: "Empresa",
      businessSegment: "clinic",
      attendantName: "Ana",
      departments: ["sales"],
    });
    expect(payload.negotiationPolicy).toBe(custom);
  });

  it("H5-C L — customer_requests_human permanece checked/locked/mandatory", () => {
    expect(isHandoffRuleLocked("customer_requests_human")).toBe(true);
    expect(LOCKED_HANDOFF_RULES).toEqual(["customer_requests_human"]);
    const form = profileToWizardFormState({
      companyName: "Empresa",
      businessSegment: "clinic",
      attendantName: "Ana",
      departments: ["sales"],
      handoffRules: ["complaint"],
    });
    expect(form.handoffRules).toContain("customer_requests_human");
    expect(form.handoffRules).toContain("complaint");
    const payload = wizardFormStateToProfilePayload({
      ...form,
      handoffRules: ["complaint"],
    });
    expect(payload.handoffRules).toEqual(
      expect.arrayContaining(["customer_requests_human", "complaint"])
    );
  });

  it("H5-C — no_prices/no_scheduling atuais não viram alias legado", () => {
    expect(
      detectPolicyPreset(
        PRICING_POLICY_PRESETS.no_prices,
        PRICING_POLICY_PRESETS
      )
    ).toBe("no_prices");
    expect(
      detectPolicyPreset(
        SCHEDULING_POLICY_PRESETS.no_scheduling,
        SCHEDULING_POLICY_PRESETS
      )
    ).toBe("no_scheduling");
    expect(resolvePolicyText("handoff", "", NEGOTIATION_POLICY_PRESETS)).toBe(
      NEGOTIATION_POLICY_PRESETS.handoff
    );
  });

  it("mapeia payload com segmento other", () => {
    const payload = wizardFormStateToProfilePayload({
      ...createDefaultWizardFormState(),
      companyName: "Empresa X",
      businessSegment: "other",
      customBusinessSegment: "Pet shop",
      attendantName: "Ana",
      departments: ["sales"],
      tone: "friendly",
      emojiLevel: "low",
      responseLength: "short",
    });
    expect(payload.customBusinessSegment).toBe("Pet shop");
    expect(payload.companyName).toBe("Empresa X");
  });
});

describe("aiAgentWizard segment helpers", () => {
  it("selecionar segmento retorna template correto", () => {
    const template = getSegmentTemplate("car_dealership");
    expect(template.suggestedDepartments).toContain("sales");
    expect(template.suggestedAllowedActions).toContain("qualify_lead");
  });

  it("aplicar recomendações preenche apenas campos vazios", () => {
    const base = createDefaultWizardFormState();
    const withRole = {
      ...base,
      attendantRole: "Função existente",
      departments: ["reception"],
    };
    const applied = applySegmentRecommendations(withRole, "car_dealership");
    expect(applied.attendantRole).toBe("Função existente");
    expect(applied.departments).toContain("reception");
    expect(applied.departments).toContain("sales");
  });

  it("não remove escolhas existentes", () => {
    const base = createDefaultWizardFormState();
    const withActions = {
      ...base,
      allowedActions: ["schedule"],
      handoffRules: ["complaint"],
    };
    const applied = applySegmentRecommendations(withActions, "internet_provider");
    expect(applied.allowedActions).toContain("schedule");
    expect(applied.handoffRules).toContain("complaint");
  });

  it("não duplica arrays ao aplicar recomendações", () => {
    const base = createDefaultWizardFormState();
    const first = applySegmentRecommendations(base, "security_company");
    const second = applySegmentRecommendations(first, "security_company");
    expect(second.departments.length).toBe(new Set(second.departments).size);
    expect(second.allowedActions.length).toBe(new Set(second.allowedActions).size);
  });

  it("preview não conta itens já selecionados", () => {
    const base = createDefaultWizardFormState();
    const filled = applySegmentRecommendations(base, "car_dealership");
    const preview = previewApplySegmentRecommendations(filled, "car_dealership");
    expect(preview.departments).toBe(0);
    expect(preview.allowedActions).toBe(0);
    expect(preview.handoffRules).toBe(0);
  });

  it("FAQs sugeridas entram com resposta vazia", () => {
    const faqs = suggestFaqsFromSegment("car_dealership", []);
    const withQuestion = faqs.find((item) => item.question && !item.answer);
    expect(withQuestion).toBeTruthy();
  });

  it("FAQs não duplicam perguntas existentes", () => {
    const existing = [{ question: "Vocês trabalham com financiamento?", answer: "Sim" }];
    const faqs = suggestFaqsFromSegment("car_dealership", existing);
    const financingCount = faqs.filter((item) =>
      String(item.question).toLowerCase().includes("financiamento")
    ).length;
    expect(financingCount).toBe(1);
  });

  it("other usa template genérico", () => {
    const template = getSegmentTemplate("other");
    expect(template.segment).toBe("other");
    expect(template.suggestedFaqKeys).toEqual([]);
  });

  it("checklist correto por segmento", () => {
    const base = createDefaultWizardFormState();
    const checklist = buildBusinessInfoChecklist(base, "internet_provider");
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist.every((item) => item.labelKey.includes("internet_provider"))).toBe(
      true
    );
  });

  it("dados existentes preservados na edição", () => {
    const base = {
      ...createDefaultWizardFormState(),
      productsAndServices: "Planos residenciais e empresariais",
      importantInformation: "Cobertura em 3 cidades",
    };
    const checklist = buildBusinessInfoChecklist(base, "internet_provider");
    const informed = checklist.filter((item) => item.informed);
    expect(informed.length).toBeGreaterThan(0);
  });
});

describe("aiAgent segment template contract", () => {
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

  it("other retorna objeto com suggestedForbiddenActions como array", () => {
    const template = getSegmentTemplate("other");
    expect(template).toBeTruthy();
    expect(Array.isArray(template.suggestedForbiddenActions)).toBe(true);
  });

  it("todos os campos de coleção de other são arrays", () => {
    const template = getSegmentTemplate("other");
    ARRAY_FIELDS.forEach((field) => {
      expect(Array.isArray(template[field])).toBe(true);
    });
  });

  it("segmento desconhecido retorna template normalizado", () => {
    const template = getSegmentTemplate("unknown_segment_xyz");
    expect(template.segment).toBe("unknown_segment_xyz");
    ARRAY_FIELDS.forEach((field) => {
      expect(Array.isArray(template[field])).toBe(true);
    });
  });

  it("segmento undefined retorna other normalizado", () => {
    const template = getSegmentTemplate(undefined);
    expect(template.segment).toBe("other");
    expect(Array.isArray(template.suggestedForbiddenActions)).toBe(true);
  });

  it("previewApplySegmentRecommendations com other não lança erro", () => {
    const base = createDefaultWizardFormState();
    expect(() => previewApplySegmentRecommendations(base, "other")).not.toThrow();
    const preview = previewApplySegmentRecommendations(base, "other");
    expect(preview).toEqual(
      expect.objectContaining({
        departments: expect.any(Number),
        allowedActions: expect.any(Number),
        forbiddenActions: expect.any(Number),
        handoffRules: expect.any(Number),
      })
    );
  });

  it("applySegmentRecommendations com other não lança erro", () => {
    const base = createDefaultWizardFormState();
    expect(() => applySegmentRecommendations(base, "other")).not.toThrow();
  });

  it("trocar de car_dealership para other não quebra preview", () => {
    const base = createDefaultWizardFormState();
    previewApplySegmentRecommendations(base, "car_dealership");
    expect(() => previewApplySegmentRecommendations(base, "other")).not.toThrow();
  });

  it("todos os 16 segmentos possuem arrays obrigatórios via getSegmentTemplate", () => {
    AI_AGENT_BUSINESS_SEGMENTS.forEach(({ value }) => {
      const template = getSegmentTemplate(value);
      ARRAY_FIELDS.forEach((field) => {
        expect(Array.isArray(template[field])).toBe(true);
      });
    });
  });

  it("normalizeAiAgentSegmentTemplate trata objeto parcial", () => {
    const normalized = normalizeAiAgentSegmentTemplate({ segment: "other" });
    ARRAY_FIELDS.forEach((field) => {
      expect(Array.isArray(normalized[field])).toBe(true);
    });
  });

  it("FAQs sugeridas para other não quebram", () => {
    expect(() => suggestFaqsFromSegment("other", [])).not.toThrow();
    const faqs = suggestFaqsFromSegment("other", []);
    expect(Array.isArray(faqs)).toBe(true);
  });

  it("cenários do simulador para other não quebram", () => {
    expect(() => getSimulationPrompts("other")).not.toThrow();
    const prompts = getSimulationPrompts("other");
    expect(Array.isArray(prompts)).toBe(true);
  });

  it("templates definidos em AI_AGENT_SEGMENT_TEMPLATE_KEYS não deixam coleções undefined", () => {
    Object.entries(AI_AGENT_SEGMENT_TEMPLATE_KEYS).forEach(([segment, partial]) => {
      const template = normalizeAiAgentSegmentTemplate({ segment, ...partial });
      ARRAY_FIELDS.forEach((field) => {
        expect(template[field]).toBeDefined();
        expect(Array.isArray(template[field])).toBe(true);
      });
    });
  });
});
