/**
 * Fase 2.15 — Tom de comunicação (UI admin).
 */
import { AI_AGENT_TONES } from "../../config/aiAgentProfileOptions";
import {
  profileToWizardFormState,
  wizardFormStateToProfilePayload,
} from "../../components/AiAgentWizard/aiAgentWizardMappers";
import { createDefaultWizardFormState } from "../../components/AiAgentWizard/aiAgentWizardDefaults";

describe("aiAgent tone UI contract (2.15)", () => {
  it("AI_AGENT_TONES expõe todas as opções suportadas", () => {
    expect(AI_AGENT_TONES.map((item) => item.value)).toEqual([
      "formal",
      "professional",
      "friendly",
      "casual",
      "custom",
    ]);
    expect(AI_AGENT_TONES.every((item) => item.label)).toBe(true);
  });

  it("carrega e persiste o tom salvo no ciclo form ↔ payload", () => {
    const form = profileToWizardFormState({
      companyName: "ACME",
      businessSegment: "ecommerce",
      departments: ["general"],
      attendantName: "Ana",
      tone: "casual",
      customTone: null,
      emojiLevel: "low",
      responseLength: "short",
      allowedActions: ["answer_faq"],
      forbiddenActions: ["invent_information"],
      handoffRules: ["customer_requests_human"],
    });
    expect(form.tone).toBe("casual");

    const payload = wizardFormStateToProfilePayload({
      ...form,
      tone: "friendly",
    });
    expect(payload.tone).toBe("friendly");
    expect(payload.customTone).toBeNull();
  });

  it("tom custom exige customTone no payload", () => {
    const form = {
      ...createDefaultWizardFormState(),
      companyName: "ACME",
      businessSegment: "ecommerce",
      departments: ["general"],
      attendantName: "Ana",
      tone: "custom",
      customTone: "Fale de forma bem-humorada e breve.",
    };
    const payload = wizardFormStateToProfilePayload(form);
    expect(payload.tone).toBe("custom");
    expect(payload.customTone).toContain("bem-humorada");
  });

  it("trocar de custom para preset limpa customTone", () => {
    const payload = wizardFormStateToProfilePayload({
      ...createDefaultWizardFormState(),
      companyName: "ACME",
      businessSegment: "ecommerce",
      departments: ["general"],
      attendantName: "Ana",
      tone: "formal",
      customTone: "texto antigo",
    });
    expect(payload.tone).toBe("formal");
    expect(payload.customTone).toBeNull();
  });
});
