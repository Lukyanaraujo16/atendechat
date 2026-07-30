/**
 * Fase 2.9D — Runtime resolve agente por whatsapp.aiAgentId (sem escolha arbitrária).
 */
import { buildAiAgentRuntimeContext } from "../buildAiAgentRuntimeContext";

jest.mock("../../../middleware/loadCompanyEffectiveFeatures", () => ({
  loadCompanyPlanContextByCompanyId: jest.fn(async () => ({
    featureMap: { "automation.ai_agent": true }
  }))
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findOne: jest.fn(async () => ({ id: 100, companyId: 10 })) }
}));

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

import AiAgent from "../../../models/AiAgent";
import { AI_AGENT_PLAN_FEATURE_KEY } from "../resolveAiAgentWhatsappFields";

const mockAgentFindOne = AiAgent.findOne as jest.Mock;

describe("Fase 2.9D — Runtime multiagente por conexão", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("WhatsApp Comercial resolve Agente Comercial", async () => {
    mockAgentFindOne.mockResolvedValue({
      id: 1,
      companyId: 10,
      name: "Comercial"
    });

    const ctx = await buildAiAgentRuntimeContext({
      companyId: 10,
      ticket: { id: 100 } as any,
      contact: { id: 1 } as any,
      whatsapp: { id: 9, aiAgentId: 1 } as any,
      message: { body: "olá" }
    });

    expect(mockAgentFindOne).toHaveBeenCalledWith({
      where: { id: 1, companyId: 10 }
    });
    expect(ctx.aiAgent?.id).toBe(1);
    expect(ctx.planHasAiAgent).toBe(true);
  });

  it("WhatsApp Financeiro resolve Agente Financeiro", async () => {
    mockAgentFindOne.mockResolvedValue({
      id: 2,
      companyId: 10,
      name: "Financeiro"
    });

    const ctx = await buildAiAgentRuntimeContext({
      companyId: 10,
      ticket: { id: 100 } as any,
      contact: { id: 1 } as any,
      whatsapp: { id: 10, aiAgentId: 2 } as any,
      message: { body: "boleto" }
    });

    expect(mockAgentFindOne).toHaveBeenCalledWith({
      where: { id: 2, companyId: 10 }
    });
    expect(ctx.aiAgent?.id).toBe(2);
  });

  it("conexão sem aiAgentId não escolhe agente arbitrário", async () => {
    const ctx = await buildAiAgentRuntimeContext({
      companyId: 10,
      ticket: { id: 100 } as any,
      contact: { id: 1 } as any,
      whatsapp: { id: 11, aiAgentId: null } as any,
      message: { body: "oi" }
    });

    expect(mockAgentFindOne).not.toHaveBeenCalled();
    expect(ctx.aiAgent).toBeNull();
  });
});

// Garante que a chave de feature usada no runtime permanece estável.
describe("Fase 2.9D — feature key", () => {
  it("AI_AGENT_PLAN_FEATURE_KEY está definida", () => {
    expect(typeof AI_AGENT_PLAN_FEATURE_KEY).toBe("string");
    expect(AI_AGENT_PLAN_FEATURE_KEY.length).toBeGreaterThan(0);
  });
});
