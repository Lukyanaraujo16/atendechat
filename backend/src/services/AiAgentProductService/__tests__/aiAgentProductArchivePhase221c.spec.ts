import AppError from "../../../errors/AppError";
import ArchiveAiAgentProductService, {
  ERR_AI_AGENT_PRODUCT_ALREADY_ARCHIVED,
  ERR_AI_AGENT_PRODUCT_ARCHIVE_REQUIRES_DEACTIVATION
} from "../ArchiveAiAgentProductService";
import {
  ERR_AI_AGENT_PRODUCT_ARCHIVED,
  resolveAiAgentProductAgentForOperation
} from "../aiAgentProductAgentRef";
import { isAiAgentArchived } from "../../../helpers/isAiAgentArchived";
import fs from "fs";
import path from "path";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(async (cb: (t: unknown) => Promise<void>) => {
      await cb({ LOCK: { UPDATE: "UPDATE" } });
    })
  }
}));

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn(), destroy: jest.fn() }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock("../GetAiAgentProductSummaryService", () => ({
  __esModule: true,
  default: jest.fn(),
  resolveAiAgentProductAvailability: jest.fn()
}));

import sequelize from "../../../database";
import AiAgent from "../../../models/AiAgent";
import Whatsapp from "../../../models/Whatsapp";
import { resolveAiAgentProductAvailability } from "../GetAiAgentProductSummaryService";

const mockAvailability = resolveAiAgentProductAvailability as jest.Mock;
const mockAgentFindAll = AiAgent.findAll as jest.Mock;
const mockAgentFindOne = AiAgent.findOne as jest.Mock;
const mockAgentDestroy = AiAgent.destroy as jest.Mock;
const mockWaFindAll = Whatsapp.findAll as jest.Mock;
const mockTx = sequelize.transaction as jest.Mock;

function makeAgent(partial: Record<string, unknown> = {}) {
  return {
    id: 7,
    companyId: 10,
    enabled: false,
    name: "Financeiro",
    archivedAt: null,
    update: jest.fn(async function update(this: any, values: any) {
      Object.assign(this, values);
      return this;
    }),
    destroy: jest.fn(),
    ...partial
  };
}

function makeWa(partial: Record<string, unknown> = {}) {
  return {
    id: 9,
    companyId: 10,
    name: "WA Financeiro",
    status: "CONNECTED",
    aiAgentId: 7,
    aiAgentMode: "live",
    aiAgentEnabled: false,
    update: jest.fn(async function update(this: any, values: any) {
      Object.assign(this, values);
      return this;
    }),
    ...partial
  };
}

function adminReq(companyId = 10) {
  return { user: { id: 1, profile: "admin", companyId } } as any;
}

function supportReq(companyId = 10) {
  return {
    user: {
      id: 99,
      profile: "admin",
      companyId,
      super: true,
      supportMode: true
    }
  } as any;
}

describe("Fase 2.21C — ArchiveAiAgentProductService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailability.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true
    });
  });

  it("arquiva agente desativado, preenche archivedAt e não chama destroy", async () => {
    const agent = makeAgent();
    const wa = makeWa();
    mockAgentFindOne.mockResolvedValue(agent);
    mockWaFindAll.mockResolvedValue([wa]);

    const result = await ArchiveAiAgentProductService({
      companyId: 10,
      req: adminReq(),
      agentRef: "7"
    });

    expect(result.archived).toBe(true);
    expect(result.agentRef).toBe("7");
    expect(result.archivedAt).toBeTruthy();
    expect(agent.update).toHaveBeenCalledWith(
      expect.objectContaining({ archivedAt: expect.any(Date) }),
      expect.objectContaining({ transaction: expect.anything() })
    );
    expect(agent.destroy).not.toHaveBeenCalled();
    expect(mockAgentDestroy).not.toHaveBeenCalled();
    expect(wa.update).toHaveBeenCalledWith(
      {
        aiAgentId: null,
        aiAgentEnabled: false,
        aiAgentMode: "disabled"
      },
      expect.objectContaining({ transaction: expect.anything() })
    );
    expect(mockTx).toHaveBeenCalled();
  });

  it("bloqueia archive de agente ativo", async () => {
    mockAgentFindOne.mockResolvedValue(makeAgent({ enabled: true }));
    mockWaFindAll.mockResolvedValue([]);
    await expect(
      ArchiveAiAgentProductService({
        companyId: 10,
        req: adminReq(),
        agentRef: "7"
      })
    ).rejects.toMatchObject({
      message: ERR_AI_AGENT_PRODUCT_ARCHIVE_REQUIRES_DEACTIVATION,
      statusCode: 409
    });
  });

  it("archive duplicado retorna erro comercial", async () => {
    mockAgentFindOne.mockResolvedValue(
      makeAgent({ archivedAt: new Date("2026-08-01T00:00:00.000Z") })
    );
    await expect(
      ArchiveAiAgentProductService({
        companyId: 10,
        req: adminReq(),
        agentRef: "7"
      })
    ).rejects.toMatchObject({
      message: ERR_AI_AGENT_PRODUCT_ALREADY_ARCHIVED,
      statusCode: 409
    });
  });

  it("não toca conexões de outro agente (Comercial vs Financeiro)", async () => {
    const financeiro = makeAgent({ id: 7, name: "Financeiro" });
    const waFin = makeWa({ id: 9, aiAgentId: 7, name: "WA Fin" });
    mockAgentFindOne.mockResolvedValue(financeiro);
    mockWaFindAll.mockResolvedValue([waFin]);

    await ArchiveAiAgentProductService({
      companyId: 10,
      req: adminReq(),
      agentRef: "7"
    });

    expect(mockWaFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 10, aiAgentId: 7 }
      })
    );
    expect(waFin.update).toHaveBeenCalledTimes(1);
  });

  it("company isolation: outro tenant não encontra o agente", async () => {
    mockAgentFindOne.mockResolvedValue(null);
    await expect(
      ArchiveAiAgentProductService({
        companyId: 99,
        req: adminReq(99),
        agentRef: "7"
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND",
      statusCode: 404
    });
    expect(mockAgentFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7, companyId: 99 }
      })
    );
  });

  it("user/supervisor bloqueados pela availability Product", async () => {
    mockAvailability.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: false
    });
    await expect(
      ArchiveAiAgentProductService({
        companyId: 10,
        req: { user: { id: 2, profile: "user", companyId: 10 } } as any,
        agentRef: "7"
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED",
      statusCode: 403
    });
    expect(mockAgentFindOne).not.toHaveBeenCalled();
  });

  it("admin permitido", async () => {
    mockAgentFindOne.mockResolvedValue(makeAgent());
    mockWaFindAll.mockResolvedValue([]);
    const result = await ArchiveAiAgentProductService({
      companyId: 10,
      req: adminReq(),
      agentRef: "7"
    });
    expect(result.archived).toBe(true);
  });

  it("supportMode permitido", async () => {
    mockAgentFindOne.mockResolvedValue(makeAgent());
    mockWaFindAll.mockResolvedValue([]);
    const result = await ArchiveAiAgentProductService({
      companyId: 10,
      req: supportReq(),
      agentRef: "7"
    });
    expect(result.archived).toBe(true);
  });

  it("rejeita companyId arbitrário no body", async () => {
    await expect(
      ArchiveAiAgentProductService({
        companyId: 10,
        req: adminReq(),
        agentRef: "7",
        body: { companyId: 99 }
      })
    ).rejects.toMatchObject({
      message: "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID"
    });
  });
});

describe("Fase 2.21C — lookups Product e runtime", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("isAiAgentArchived", () => {
    expect(isAiAgentArchived(null)).toBe(false);
    expect(isAiAgentArchived({ archivedAt: null })).toBe(false);
    expect(isAiAgentArchived({ archivedAt: new Date() })).toBe(true);
  });

  it("resolve por agentRef arquivado → ERR_AI_AGENT_PRODUCT_ARCHIVED", async () => {
    mockAgentFindOne.mockResolvedValue(
      makeAgent({ archivedAt: new Date() })
    );
    await expect(
      resolveAiAgentProductAgentForOperation({
        companyId: 10,
        agentRef: "7"
      })
    ).rejects.toMatchObject({
      message: ERR_AI_AGENT_PRODUCT_ARCHIVED,
      statusCode: 404
    });
  });

  it("findAll operacional exclui archivedAt", async () => {
    mockAgentFindAll.mockResolvedValue([]);
    await resolveAiAgentProductAgentForOperation({ companyId: 10 });
    expect(mockAgentFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 10, archivedAt: null })
      })
    );
  });
});

describe("Fase 2.21C — contrato de preservação e 410", () => {
  const archiveSrc = fs.readFileSync(
    path.join(__dirname, "../ArchiveAiAgentProductService.ts"),
    "utf8"
  );
  const routesSrc = fs.readFileSync(
    path.join(__dirname, "../../../routes/aiAgentProductRoutes.ts"),
    "utf8"
  );
  const legacySrc = fs.readFileSync(
    path.join(__dirname, "../../../routes/aiAgentRoutes.ts"),
    "utf8"
  );
  const liveSrc = fs.readFileSync(
    path.join(__dirname, "../../AiAgentService/AiAgentLiveService.ts"),
    "utf8"
  );
  const shadowSrc = fs.readFileSync(
    path.join(__dirname, "../../AiAgentService/AiAgentShadowService.ts"),
    "utf8"
  );
  const runtimeSrc = fs.readFileSync(
    path.join(__dirname, "../../AiAgentService/buildAiAgentRuntimeContext.ts"),
    "utf8"
  );
  const migrationSrc = fs.readFileSync(
    path.join(
      __dirname,
      "../../../database/migrations/20260824180000-add-ai-agent-archived-at.ts"
    ),
    "utf8"
  );
  const listSrc = fs.readFileSync(
    path.join(__dirname, "../ListAiAgentProductAgentsService.ts"),
    "utf8"
  );

  it("não usa destroy nem CASCADE de analytics/simulator", () => {
    expect(archiveSrc).not.toMatch(/\.destroy\(/);
    expect(archiveSrc).not.toMatch(/AiAgent\.destroy/);
    expect(archiveSrc).not.toMatch(/AnalyticsDaily/);
    expect(archiveSrc).not.toMatch(/SimulationSession/);
    expect(archiveSrc).not.toMatch(/AiKnowledgeBase\.destroy/);
    expect(archiveSrc).not.toMatch(/AiProviderCredential\.destroy/);
  });

  it("não reabre DELETE legado", () => {
    expect(routesSrc).toMatch(/agents\/:agentRef\/archive/);
    expect(routesSrc).not.toMatch(/method:\s*"delete"/i);
    expect(legacySrc).toMatch(/rejectLegacyAiAgentCommercialMutation/);
  });

  it("runtime ignora archived", () => {
    expect(liveSrc).toMatch(/isAiAgentArchived\(agent\)/);
    expect(shadowSrc).toMatch(/isAiAgentArchived\(agent\)/);
    expect(runtimeSrc).toMatch(/isAiAgentArchived\(aiAgent\)/);
  });

  it("Hub exclui archived", () => {
    expect(listSrc).toMatch(/archivedAt: null/);
  });

  it("support write de archive", () => {
    expect(routesSrc).toMatch(/ai_agent\.product\.archive/);
  });

  it("migration up/down de archivedAt", () => {
    expect(migrationSrc).toMatch(/addColumn\("AiAgents", "archivedAt"/);
    expect(migrationSrc).toMatch(/removeColumn\("AiAgents", "archivedAt"\)/);
    expect(migrationSrc).not.toMatch(/paranoid:\s*true/);
  });

  it("preserva knowledge join e credencial (não apaga)", () => {
    expect(archiveSrc).not.toMatch(/AiAgentKnowledgeBase/);
    expect(archiveSrc).not.toMatch(/aiProviderCredentialId/);
  });
});

describe("Fase 2.21C — AppError de archive ativo", () => {
  it("mensagem comercial pede desativação", () => {
    const err = new AppError(
      ERR_AI_AGENT_PRODUCT_ARCHIVE_REQUIRES_DEACTIVATION,
      409,
      "Desative o agente antes de arquivá-lo."
    );
    expect(err.clientMessage).toMatch(/Desative o agente/);
  });
});
