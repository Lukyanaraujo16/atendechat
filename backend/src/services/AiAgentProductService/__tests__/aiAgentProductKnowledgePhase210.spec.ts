import ListAiAgentProductKnowledgeService from "../ListAiAgentProductKnowledgeService";
import SyncAiAgentProductKnowledgeService from "../SyncAiAgentProductKnowledgeService";

jest.mock("../../AiAgentService/knowledge/ListAiAgentKnowledgeBasesService", () => ({
  __esModule: true,
  default: jest.fn(async () => ({
    links: [
      {
        knowledgeBaseId: 3,
        knowledgeBaseName: "FAQ Comercial",
        enabled: true,
        priority: 100,
        indexedDocuments: 2,
        outdatedDocuments: 0,
        knowledgeBaseEnabled: true
      }
    ],
    availableBases: [{ id: 3, name: "FAQ Comercial", enabled: true, description: null }]
  }))
}));

jest.mock("../../AiAgentService/knowledge/SyncAiAgentKnowledgeBasesService", () => ({
  __esModule: true,
  default: jest.fn(async () => ({ links: [] }))
}));

jest.mock("../aiAgentProductAgentRef", () => ({
  encodeAgentRef: (id: number) => String(id),
  resolveAiAgentProductAgentForOperation: jest.fn()
}));

jest.mock("../aiAgentProductConfigurationHelpers", () => ({
  assertAiAgentProductConfigurationAccess: jest.fn(async () => ({
    enabledByPlan: true,
    accessibleByUser: true
  })),
  isAiAgentProductActive: jest.fn(() => false)
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findAll: jest.fn(async () => []) }
}));

import { resolveAiAgentProductAgentForOperation } from "../aiAgentProductAgentRef";
import SyncAiAgentKnowledgeBasesService from "../../AiAgentService/knowledge/SyncAiAgentKnowledgeBasesService";

const mockResolve = resolveAiAgentProductAgentForOperation as jest.Mock;

describe("Fase 2.10 — Product Knowledge agent-scoped", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve.mockResolvedValue({
      kind: "resolved",
      agentId: 1,
      agentRef: "1",
      agent: { id: 1, enabled: false, companyId: 10 }
    });
  });

  it("lista bases do agente A com agentRef", async () => {
    const out = await ListAiAgentProductKnowledgeService({
      companyId: 10,
      agentRef: "1"
    });
    expect(out.agentRef).toBe("1");
    expect(out.links[0].ref).toBe("3");
    expect(out.links[0].name).toBe("FAQ Comercial");
    expect(JSON.stringify(out)).not.toMatch(/apiKey/i);
  });

  it("sync usa SyncAiAgentKnowledgeBasesService do agente correto", async () => {
    const out = await SyncAiAgentProductKnowledgeService({
      companyId: 10,
      agentRef: "1",
      body: { knowledgeBaseRefs: ["3"] },
      req: { user: { id: 5 } } as any
    });
    expect(SyncAiAgentKnowledgeBasesService).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 10,
        aiAgentId: 1,
        links: [expect.objectContaining({ knowledgeBaseId: 3 })]
      })
    );
    expect(out.changed).toBe(true);
    expect(out.agentRef).toBe("1");
  });
});
