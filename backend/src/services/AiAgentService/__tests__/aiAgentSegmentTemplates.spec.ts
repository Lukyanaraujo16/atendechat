import { AI_AGENT_GENERATED_PROMPT_VERSION } from "../../../config/aiAgentProfileConfig";
import {
  AI_AGENT_SEGMENT_TEMPLATES,
  buildSegmentSpecificPromptInstructions,
  getAiAgentSegmentTemplate,
} from "../../../config/aiAgentSegmentTemplates";
import { buildAiAgentPromptFromProfile } from "../buildAiAgentPromptFromProfile";
import { validateAiAgentProfileInput } from "../aiAgentProfileValidation";

const baseProfileInput = {
  companyName: "Empresa Teste",
  businessSegment: "car_dealership",
  departments: ["sales"],
  attendantName: "Ana",
  attendantRole: "Atendente",
  tone: "professional",
  emojiLevel: "low",
  responseLength: "short",
  allowedActions: ["explain_services"],
  forbiddenActions: ["invent_information", "grant_discount"],
  handoffRules: ["customer_requests_human"],
  productsAndServices: "Venda de veículos.",
};

describe("AiAgent segment templates 1.5.1C", () => {
  it("template car_dealership existe", () => {
    const template = getAiAgentSegmentTemplate("car_dealership");
    expect(template.segment).toBe("car_dealership");
    expect(template.suggestedDepartments).toContain("sales");
    expect(template.generatedPromptInstructions.length).toBeGreaterThan(0);
  });

  it("template internet_provider existe", () => {
    const template = getAiAgentSegmentTemplate("internet_provider");
    expect(template.segment).toBe("internet_provider");
    expect(template.generatedPromptInstructions.some((line) =>
      line.toLowerCase().includes("cobertura")
    )).toBe(true);
  });

  it("template other é genérico", () => {
    const template = getAiAgentSegmentTemplate("other");
    expect(template.segment).toBe("other");
    expect(template.generatedPromptInstructions.some((line) =>
      line.toLowerCase().includes("invente")
    )).toBe(true);
  });

  it("segmento desconhecido usa template other", () => {
    const template = getAiAgentSegmentTemplate("unknown_segment");
    expect(template.segment).toBe("other");
  });

  it("prompt de loja de veículos inclui regras específicas", () => {
    const validated = validateAiAgentProfileInput(baseProfileInput);
    const prompt = buildAiAgentPromptFromProfile(validated);
    expect(prompt).toContain("## Orientações específicas do segmento");
    expect(prompt).toContain("disponibilidade");
    expect(prompt).toContain("financiamento");
  });

  it("prompt de provedor inclui regra de cobertura", () => {
    const validated = validateAiAgentProfileInput({
      ...baseProfileInput,
      businessSegment: "internet_provider",
    });
    const prompt = buildAiAgentPromptFromProfile(validated);
    expect(prompt).toContain("cobertura");
  });

  it("prompt não inventa preços ou horários fictícios", () => {
    const validated = validateAiAgentProfileInput({
      ...baseProfileInput,
      businessHours: "",
      pricingPolicy: "",
    });
    const prompt = buildAiAgentPromptFromProfile(validated);
    expect(prompt).not.toMatch(/R\$\s*\d+/);
    expect(prompt).not.toMatch(/às\s+\d{1,2}h\d{0,2}/i);
    expect(prompt).toContain("Não invente informações");
  });

  it("mesmo perfil gera mesmo prompt", () => {
    const validated = validateAiAgentProfileInput(baseProfileInput);
    const first = buildAiAgentPromptFromProfile(validated);
    const second = buildAiAgentPromptFromProfile(validated);
    expect(first).toBe(second);
  });

  it("generatedPromptVersion atualizado para 1.1", () => {
    expect(AI_AGENT_GENERATED_PROMPT_VERSION).toBe("1.1");
  });

  it("segmento other inclui customBusinessSegment nas instruções", () => {
    const lines = buildSegmentSpecificPromptInstructions({
      businessSegment: "other",
      customBusinessSegment: "Pet shop",
    });
    expect(lines.some((line) => line.includes("Pet shop"))).toBe(true);
  });

  it("todos os segmentos iniciais possuem template", () => {
    const keys = [
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
      "other",
    ];
    keys.forEach((key) => {
      expect(AI_AGENT_SEGMENT_TEMPLATES[key]).toBeDefined();
    });
  });
});
