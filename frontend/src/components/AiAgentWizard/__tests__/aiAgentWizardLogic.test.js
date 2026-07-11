import {
  createDefaultWizardFormState,
  LOCKED_FORBIDDEN_ACTIONS,
} from "../aiAgentWizardDefaults";
import {
  normalizeForbiddenActions,
  wizardFormStateToProfilePayload,
} from "../aiAgentWizardMappers";
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
