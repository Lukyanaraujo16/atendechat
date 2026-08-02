import { AI_AGENT_TONES } from "../../../config/aiAgentProfileConfig";
import { buildToneCommunicationInstructions } from "../buildToneCommunicationInstructions";
import { buildAiAgentPromptFromProfile } from "../buildAiAgentPromptFromProfile";
import { validateAiAgentProfileInput } from "../aiAgentProfileValidation";

const baseProfileInput = {
  companyName: "Empresa Demo",
  businessSegment: "ecommerce",
  departments: ["general"],
  attendantName: "Ana",
  attendantRole: "Atendente",
  tone: "professional",
  emojiLevel: "none",
  responseLength: "medium",
  allowedActions: ["explain_services", "answer_faq"],
  forbiddenActions: ["invent_information"],
  handoffRules: ["customer_requests_human"],
  productsAndServices: "Consultoria."
};

describe("AiAgent tone communication hardening (2.15)", () => {
  it("cada tom estruturado gera bloco distinto e perceptível", () => {
    const structuredTones = AI_AGENT_TONES.filter(t => t !== "custom");
    const prompts = structuredTones.reduce<Record<string, string>>(
      (acc, tone) => {
        const validated = validateAiAgentProfileInput({
          ...baseProfileInput,
          tone
        });
        const prompt = buildAiAgentPromptFromProfile(validated);
        expect(prompt).toContain("## Tom e estilo de comunicação");
        expect(prompt).toContain("Tom selecionado:");
        expect(prompt).toMatch(/Formalidade:/);
        expect(prompt).toMatch(/Vocabulário:/);
        expect(prompt).toMatch(/Cumprimentos:/);
        expect(prompt).toMatch(/Oferta de ajuda:/);
        expect(prompt).toContain(
          "Preserve fatos, políticas, FAQ e limites de ação"
        );
        acc[tone] = prompt;
        return acc;
      },
      {}
    );

    expect(prompts.formal).toContain("não use emojis");
    expect(prompts.formal).not.toContain("descontraído");
    expect(prompts.friendly).toContain("amigável");
    expect(prompts.casual).toContain("descontraído");
    expect(prompts.professional).toContain("profissional");

    // Diferença real entre tons (não apenas o rótulo).
    expect(prompts.formal).not.toEqual(prompts.friendly);
    expect(prompts.friendly).not.toEqual(prompts.casual);
    expect(prompts.casual).not.toEqual(prompts.professional);
  });

  it("tom custom usa descrição personalizada", () => {
    const validated = validateAiAgentProfileInput({
      ...baseProfileInput,
      tone: "custom",
      customTone: "Fale como um concierge sofisticado, breve e elegante."
    });
    const prompt = buildAiAgentPromptFromProfile(validated);
    expect(prompt).toContain("tom de comunicação personalizado");
    expect(prompt).toContain("concierge sofisticado");
    expect(prompt).not.toContain("Tom selecionado: Formal");
  });

  it("buildToneCommunicationInstructions cobre todos os tons do enum", () => {
    AI_AGENT_TONES.forEach(tone => {
      const lines = buildToneCommunicationInstructions({
        tone,
        customTone: tone === "custom" ? "Estilo X" : null
      });
      expect(lines.length).toBeGreaterThan(2);
      expect(lines.join("\n")).not.toMatch(/sk-/);
    });
  });

  it("não remove seções de negócio ao enriquecer o tom", () => {
    const validated = validateAiAgentProfileInput({
      ...baseProfileInput,
      tone: "casual",
      frequentlyAskedQuestions: [
        { question: "Qual o horário?", answer: "Das 9 às 18." }
      ],
      pricingPolicy: "Informar somente preços cadastrados."
    });
    const prompt = buildAiAgentPromptFromProfile(validated);
    expect(prompt).toContain("Empresa Demo");
    expect(prompt).toContain("Perguntas frequentes");
    expect(prompt).toContain("Preços:");
    expect(prompt).toContain("Ações permitidas");
  });
});
