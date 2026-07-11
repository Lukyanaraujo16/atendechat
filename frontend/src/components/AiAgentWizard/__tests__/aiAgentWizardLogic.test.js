import {
  createDefaultWizardFormState,
  LOCKED_FORBIDDEN_ACTIONS,
} from "../aiAgentWizardDefaults";
import {
  normalizeForbiddenActions,
  wizardFormStateToProfilePayload,
} from "../aiAgentWizardMappers";
import {
  applySegmentRecommendations,
  buildBusinessInfoChecklist,
  previewApplySegmentRecommendations,
  suggestFaqsFromSegment,
} from "../aiAgentWizardSegmentHelpers";
import { getSegmentTemplate } from "../../../config/aiAgentSegmentTemplates";
import {
  hasWizardValidationErrors,
  isForbiddenActionLocked,
  validateWizardStep,
} from "../aiAgentWizardValidation";

describe("aiAgentWizard validation", () => {
  const base = createDefaultWizardFormState();

  it("não avança company sem companyName", () => {
    const errors = validateWizardStep("company", {
      ...base,
      companyName: "",
      businessSegment: "clinic",
    });
    expect(hasWizardValidationErrors(errors)).toBe(true);
    expect(errors.companyName).toBe("required");
  });

  it("segmento other exige customBusinessSegment", () => {
    const errors = validateWizardStep("company", {
      ...base,
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
