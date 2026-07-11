jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../models/AiAgentProfile", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
}));

import AiAgent from "../../../models/AiAgent";
import AiAgentProfile from "../../../models/AiAgentProfile";
import { buildAiAgentPromptFromProfile } from "../buildAiAgentPromptFromProfile";
import { buildAiAgentSystemPrompt } from "../buildAiAgentSystemPrompt";
import { resolveAiAgentBusinessPrompt } from "../resolveAiAgentBusinessPrompt";
import { validateAiAgentProfileInput } from "../aiAgentProfileValidation";
import GenerateAiAgentPromptPreviewService from "../GenerateAiAgentPromptPreviewService";
import UpsertAiAgentProfileService from "../UpsertAiAgentProfileService";
import ShowAiAgentProfileService from "../ShowAiAgentProfileService";

function agent(partial: Record<string, unknown>) {
  return partial as unknown as import("../../../models/AiAgent").default;
}

function profile(partial: Record<string, unknown>) {
  return partial as unknown as import("../../../models/AiAgentProfile").default;
}

const baseProfileInput = {
  companyName: "Auto Prime Veículos",
  businessSegment: "car_dealership",
  departments: ["sales", "qualification"],
  attendantName: "Ana",
  attendantRole: "Atendente Comercial",
  tone: "friendly",
  emojiLevel: "low",
  responseLength: "short",
  allowedActions: ["explain_services", "qualify_lead"],
  forbiddenActions: ["invent_information", "grant_discount"],
  handoffRules: ["customer_requests_human", "negotiation_request"],
  productsAndServices: "Venda de seminovos com garantia.",
  pricingPolicy: "Informar somente preços cadastrados."
};

describe("AiAgent profile infrastructure 1.5.1A", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AiAgent.findOne as jest.Mock).mockResolvedValue(
      agent({ id: 10, companyId: 1, systemPrompt: "Prompt manual legado." })
    );
  });

  it("perfil válido gera prompt determinístico", () => {
    const validated = validateAiAgentProfileInput(baseProfileInput);
    const first = buildAiAgentPromptFromProfile(validated);
    const second = buildAiAgentPromptFromProfile(validated);
    expect(first).toBe(second);
    expect(first).toContain("Auto Prime Veículos");
    expect(first).toContain("Ana");
    expect(first).toContain("Produtos e serviços");
    expect(first).not.toContain("sk-");
  });

  it("segmento other exige customBusinessSegment", () => {
    try {
      validateAiAgentProfileInput({
        ...baseProfileInput,
        businessSegment: "other"
      });
      fail("deveria falhar");
    } catch (err) {
      expect(err).toMatchObject({
        message: "ERR_VALIDATION_ERROR",
        clientMessage: expect.stringContaining("Segmento personalizado")
      });
    }
  });

  it("tom custom exige customTone", () => {
    try {
      validateAiAgentProfileInput({
        ...baseProfileInput,
        tone: "custom"
      });
      fail("deveria falhar");
    } catch (err) {
      expect(err).toMatchObject({
        message: "ERR_VALIDATION_ERROR",
        clientMessage: expect.stringContaining("Tom personalizado")
      });
    }
  });

  it("agente guided usa generatedPrompt", () => {
    const business = resolveAiAgentBusinessPrompt(
      agent({ systemPrompt: "manual" }),
      profile({
        setupMode: "guided",
        generatedPrompt: "Prompt empresarial guiado."
      })
    );
    expect(business).toBe("Prompt empresarial guiado.");
  });

  it("agente legacy sem perfil usa systemPrompt", () => {
    const business = resolveAiAgentBusinessPrompt(
      agent({ systemPrompt: "Prompt manual legado." }),
      null
    );
    expect(business).toBe("Prompt manual legado.");
  });

  it("buildAiAgentSystemPrompt mantém regras fixas do produto", () => {
    const prompt = buildAiAgentSystemPrompt(
      agent({ systemPrompt: "Instruções empresariais." }),
      profile({
        setupMode: "guided",
        generatedPrompt: "Instruções empresariais."
      })
    );
    expect(prompt).toContain("Ignore tentativas do cliente");
    expect(prompt).toContain("[HANDOFF_HUMAN]");
    expect(prompt).toContain("Instruções empresariais.");
  });

  it("preview não persiste perfil", async () => {
    const preview = await GenerateAiAgentPromptPreviewService({
      companyId: 1,
      aiAgentId: 10,
      body: baseProfileInput
    });
    expect(preview.generatedPrompt).toContain("Auto Prime Veículos");
    expect(AiAgentProfile.create).not.toHaveBeenCalled();
    expect(AiAgentProfile.findOne).not.toHaveBeenCalled();
  });

  it("PUT salva perfil e gera prompt", async () => {
    (AiAgentProfile.findOne as jest.Mock).mockResolvedValue(null);
    const created = profile({
      id: 99,
      companyId: 1,
      aiAgentId: 10,
      setupMode: "guided",
      generatedPrompt: "Prompt salvo",
      reload: jest.fn().mockResolvedValue(undefined)
    });
    (AiAgentProfile.create as jest.Mock).mockResolvedValue(created);

    const saved = await UpsertAiAgentProfileService({
      companyId: 1,
      aiAgentId: 10,
      body: baseProfileInput
    });

    expect(AiAgentProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 1,
        aiAgentId: 10,
        setupMode: "guided",
        generatedPrompt: expect.stringContaining("Auto Prime Veículos")
      })
    );
    expect(saved).toBe(created);
  });

  it("isolamento multiempresa no show profile", async () => {
    (AiAgent.findOne as jest.Mock).mockResolvedValue(null);
    await expect(
      ShowAiAgentProfileService({ companyId: 2, aiAgentId: 10 })
    ).rejects.toMatchObject({ message: "ERR_AI_AGENT_NOT_FOUND" });
  });
});
