/**
 * Hardening 2.3.2 — readiness compatível com provider, credencial e modelo.
 */
import {
  computeAiAgentProductReadiness,
  AiAgentProductSnapshot
} from "../AgentReadinessService";
import {
  resolveAiAgentProductProviderCompatibility
} from "../aiAgentProductProviderCapabilities";
import ExecuteAiAgentProductCommandService from "../ExecuteAiAgentProductCommandService";
import { serializeAiAgentReadiness } from "../serializeAiAgentProduct";

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
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));

jest.mock("../../../models/AiAgentProfile", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));

jest.mock("../../../models/AiProviderCredential", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), findAll: jest.fn() }
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

jest.mock("../GetAiAgentProductSummaryService", () => {
  const actual = jest.requireActual("../GetAiAgentProductSummaryService");
  return {
    __esModule: true,
    ...actual,
    default: jest.fn(),
    buildAiAgentProductSnapshot: jest.fn(),
    resolveAiAgentProductAvailability: jest.fn()
  };
});

import AiAgent from "../../../models/AiAgent";
import Whatsapp from "../../../models/Whatsapp";
import GetAiAgentProductSummaryService, {
  buildAiAgentProductSnapshot,
  resolveAiAgentProductAvailability
} from "../GetAiAgentProductSummaryService";

const mockSummary = GetAiAgentProductSummaryService as jest.Mock;
const mockSnapshot = buildAiAgentProductSnapshot as jest.Mock;
const mockAvailability = resolveAiAgentProductAvailability as jest.Mock;
const mockAgentFindAll = AiAgent.findAll as jest.Mock;
const mockAgentFindOne = AiAgent.findOne as jest.Mock;
const mockWaFindAll = Whatsapp.findAll as jest.Mock;

function baseSnapshot(
  partial: Partial<AiAgentProductSnapshot> &
    Pick<AiAgentProductSnapshot, "agents" | "connections">
): AiAgentProductSnapshot {
  return {
    enabledByPlan: true,
    accessibleByUser: true,
    ...partial
  };
}

function agentWithCompat(input: {
  model: string;
  credential: { provider: string; enabled: boolean } | null;
  enabled?: boolean;
  hasInstructions?: boolean;
}) {
  const providerCompatibility = resolveAiAgentProductProviderCompatibility({
    model: input.model,
    linkedCredential: input.credential
  });
  return {
    id: 1,
    name: "Bot",
    enabled: input.enabled !== false,
    hasProvider: providerCompatibility.ready,
    hasInstructions: input.hasInstructions !== false,
    explicitlyPaused: false,
    providerCompatibility
  };
}

const connectedWa = {
  id: 9,
  name: "WA",
  status: "CONNECTED",
  aiAgentId: 1,
  runtimeMode: "disabled" as const
};

function check(key: string, readiness: { checks: Array<{ key: string; status: string; labelKey: string }> }) {
  return readiness.checks.find(c => c.key === key);
}

describe("aiAgentProductReadinessCompatibility (2.3.2)", () => {
  describe("resolveAiAgentProductProviderCompatibility", () => {
    it("OpenAI válido", () => {
      const r = resolveAiAgentProductProviderCompatibility({
        model: "gpt-4o-mini",
        linkedCredential: { provider: "openai", enabled: true }
      });
      expect(r.ready).toBe(true);
      expect(r.hasConflict).toBe(false);
      expect(r.providerStatus).toBe("complete");
      expect(r.credentialStatus).toBe("complete");
      expect(r.modelStatus).toBe("complete");
    });

    it("Gemini válido", () => {
      const r = resolveAiAgentProductProviderCompatibility({
        model: "gemini-2.5-flash",
        linkedCredential: { provider: "gemini", enabled: true }
      });
      expect(r.ready).toBe(true);
      expect(r.providerStatus).toBe("complete");
    });

    it("provider desconhecido → conflict", () => {
      const r = resolveAiAgentProductProviderCompatibility({
        model: "gpt-4o-mini",
        linkedCredential: { provider: "claude", enabled: true }
      });
      expect(r.ready).toBe(false);
      expect(r.hasConflict).toBe(true);
      expect(r.providerStatus).toBe("blocked");
      expect(r.providerLabelKey).toContain("providerUnsupported");
    });

    it("credencial ausente → pending sem conflict", () => {
      const r = resolveAiAgentProductProviderCompatibility({
        model: "gpt-4o-mini",
        linkedCredential: null
      });
      expect(r.ready).toBe(false);
      expect(r.hasConflict).toBe(false);
      expect(r.credentialStatus).toBe("pending");
      expect(r.providerStatus).toBe("pending");
    });

    it("OpenAI + modelo Gemini → conflict", () => {
      const r = resolveAiAgentProductProviderCompatibility({
        model: "gemini-2.5-flash",
        linkedCredential: { provider: "openai", enabled: true }
      });
      expect(r.ready).toBe(false);
      expect(r.hasConflict).toBe(true);
      expect(r.modelStatus).toBe("blocked");
    });

    it("Gemini + modelo OpenAI → conflict", () => {
      const r = resolveAiAgentProductProviderCompatibility({
        model: "gpt-4o",
        linkedCredential: { provider: "gemini", enabled: true }
      });
      expect(r.modelStatus).toBe("blocked");
      expect(r.hasConflict).toBe(true);
    });

    it("credencial desabilitada → conflict (não usa outra da empresa)", () => {
      const r = resolveAiAgentProductProviderCompatibility({
        model: "gpt-4o-mini",
        linkedCredential: { provider: "openai", enabled: false }
      });
      expect(r.ready).toBe(false);
      expect(r.hasConflict).toBe(true);
      expect(r.credentialStatus).toBe("blocked");
      expect(r.credentialLabelKey).toContain("credentialDisabled");
    });

    it("modelo ausente com credencial válida → pending", () => {
      const r = resolveAiAgentProductProviderCompatibility({
        model: "",
        linkedCredential: { provider: "openai", enabled: true }
      });
      expect(r.ready).toBe(false);
      expect(r.hasConflict).toBe(false);
      expect(r.modelStatus).toBe("pending");
    });
  });

  describe("computeAiAgentProductReadiness", () => {
    it("OpenAI completo → ready_to_activate", () => {
      const { readiness } = computeAiAgentProductReadiness(
        baseSnapshot({
          agents: [
            agentWithCompat({
              model: "gpt-4o-mini",
              credential: { provider: "openai", enabled: true }
            })
          ],
          connections: [connectedWa]
        })
      );
      expect(readiness.status).toBe("ready_to_activate");
      expect(readiness.ready).toBe(true);
      expect(check("provider", readiness)?.status).toBe("complete");
      expect(check("credential", readiness)?.status).toBe("complete");
      expect(check("model", readiness)?.status).toBe("complete");
    });

    it("Gemini completo → ready_to_activate", () => {
      const { readiness } = computeAiAgentProductReadiness(
        baseSnapshot({
          agents: [
            agentWithCompat({
              model: "gemini-2.5-flash",
              credential: { provider: "gemini", enabled: true }
            })
          ],
          connections: [connectedWa]
        })
      );
      expect(readiness.status).toBe("ready_to_activate");
      expect(readiness.ready).toBe(true);
    });

    it("provider desconhecido → attention_required (não ready)", () => {
      const { readiness } = computeAiAgentProductReadiness(
        baseSnapshot({
          agents: [
            agentWithCompat({
              model: "gpt-4o-mini",
              credential: { provider: "claude", enabled: true }
            })
          ],
          connections: [connectedWa]
        })
      );
      expect(readiness.status).toBe("attention_required");
      expect(readiness.ready).toBe(false);
      expect(readiness.nextAction).toBe("resolve_conflict");
      expect(check("provider", readiness)?.status).toBe("blocked");
    });

    it("modelo incompatível → attention_required mesmo com WA CONNECTED", () => {
      const { readiness } = computeAiAgentProductReadiness(
        baseSnapshot({
          agents: [
            agentWithCompat({
              model: "gemini-1.5-pro",
              credential: { provider: "openai", enabled: true }
            })
          ],
          connections: [connectedWa]
        })
      );
      expect(readiness.status).toBe("attention_required");
      expect(readiness.ready).toBe(false);
      expect(check("model", readiness)?.status).toBe("blocked");
    });

    it("credencial ausente → setup_incomplete", () => {
      const { readiness } = computeAiAgentProductReadiness(
        baseSnapshot({
          agents: [
            agentWithCompat({
              model: "gpt-4o-mini",
              credential: null
            })
          ],
          connections: [connectedWa]
        })
      );
      expect(readiness.status).toBe("setup_incomplete");
      expect(readiness.ready).toBe(false);
      expect(check("credential", readiness)?.status).toBe("pending");
    });

    it("credencial disabled → attention_required", () => {
      const { readiness } = computeAiAgentProductReadiness(
        baseSnapshot({
          agents: [
            agentWithCompat({
              model: "gpt-4o-mini",
              credential: { provider: "openai", enabled: false }
            })
          ],
          connections: [connectedWa]
        })
      );
      expect(readiness.status).toBe("attention_required");
      expect(check("credential", readiness)?.status).toBe("blocked");
    });

    it("serializer não vaza credential id / secret / companyId", () => {
      const { readiness } = computeAiAgentProductReadiness(
        baseSnapshot({
          agents: [
            agentWithCompat({
              model: "gpt-4o-mini",
              credential: { provider: "openai", enabled: true }
            })
          ],
          connections: [connectedWa]
        })
      );
      const out = serializeAiAgentReadiness(readiness);
      const json = JSON.stringify(out);
      expect(json).not.toContain("companyId");
      expect(json).not.toContain("apiKey");
      expect(json).not.toContain("credentialId");
      expect(out.checks.every(c => ["key", "status", "labelKey"].every(k => k in c))).toBe(
        true
      );
    });
  });

  describe("commands", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockAvailability.mockResolvedValue({
        enabledByPlan: true,
        accessibleByUser: true
      });
      mockSummary.mockResolvedValue({
        availability: { enabledByPlan: true, accessibleByUser: true },
        status: "attention_required",
        mode: "off",
        agent: { exists: true, id: 1, name: "Bot", enabled: false },
        connection: { linked: true, name: "WA", connected: true },
        connectionScope: {
          type: "all_linked",
          count: 1,
          connectedCount: 1,
          disconnectedCount: 0,
          names: ["WA"]
        },
        agentScope: { type: "single", count: 1 },
        readiness: {
          ready: false,
          status: "attention_required",
          mode: "off",
          nextAction: "resolve_conflict",
          checks: []
        }
      });
    });

    it("activate_shadow bloqueado com provider desconhecido — sem mutação", async () => {
      const agent = {
        id: 1,
        name: "Bot",
        enabled: false,
        hasProvider: false,
        hasInstructions: true,
        explicitlyPaused: false,
        providerCompatibility: resolveAiAgentProductProviderCompatibility({
          model: "gpt-4o-mini",
          linkedCredential: { provider: "claude", enabled: true }
        }),
        update: jest.fn()
      };
      mockSnapshot.mockResolvedValue({
        enabledByPlan: true,
        accessibleByUser: true,
        agents: [agent],
        connections: [connectedWa]
      });
      mockAgentFindAll.mockResolvedValue([agent]);
      mockWaFindAll.mockResolvedValue([]);

      await expect(
        ExecuteAiAgentProductCommandService({
          companyId: 10,
          req: { user: { id: 1, profile: "admin", companyId: 10 } } as never,
          body: { command: "activate_shadow" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_NOT_READY"
      });
      expect(agent.update).not.toHaveBeenCalled();
    });

    it("activate_live bloqueado com modelo incompatível", async () => {
      const agent = {
        id: 1,
        name: "Bot",
        enabled: false,
        hasProvider: false,
        hasInstructions: true,
        explicitlyPaused: false,
        providerCompatibility: resolveAiAgentProductProviderCompatibility({
          model: "gemini-2.5-flash",
          linkedCredential: { provider: "openai", enabled: true }
        }),
        update: jest.fn()
      };
      mockSnapshot.mockResolvedValue({
        enabledByPlan: true,
        accessibleByUser: true,
        agents: [agent],
        connections: [connectedWa]
      });

      await expect(
        ExecuteAiAgentProductCommandService({
          companyId: 10,
          req: { user: { id: 1, profile: "admin", companyId: 10 } } as never,
          body: { command: "activate_live" }
        })
      ).rejects.toMatchObject({
        message: "ERR_AI_AGENT_PRODUCT_NOT_READY"
      });
      expect(agent.update).not.toHaveBeenCalled();
    });

    it("deactivate continua permitido com configuração inválida", async () => {
      const agent = {
        id: 1,
        name: "Bot",
        enabled: true,
        update: jest.fn(async function upd(
          this: { enabled: boolean },
          patch: { enabled: boolean }
        ) {
          Object.assign(this, patch);
        })
      };
      const wa = {
        id: 9,
        name: "WA",
        status: "CONNECTED",
        aiAgentId: 1,
        aiAgentMode: "shadow",
        aiAgentEnabled: true,
        update: jest.fn(async function upd(
          this: Record<string, unknown>,
          patch: Record<string, unknown>
        ) {
          Object.assign(this, patch);
        })
      };
      mockAgentFindAll.mockResolvedValue([agent]);
      mockAgentFindOne.mockResolvedValue(agent);
      mockWaFindAll.mockResolvedValue([wa]);
      mockSummary.mockResolvedValue({
        availability: { enabledByPlan: true, accessibleByUser: true },
        status: "setup_incomplete",
        mode: "off",
        agent: { exists: true, id: 1, name: "Bot", enabled: false },
        connection: { linked: true, name: "WA", connected: true },
        connectionScope: {
          type: "all_linked",
          count: 1,
          connectedCount: 1,
          disconnectedCount: 0,
          names: ["WA"]
        },
        agentScope: { type: "single", count: 1 },
        readiness: {
          ready: false,
          status: "setup_incomplete",
          mode: "off",
          nextAction: "configure_provider",
          checks: []
        }
      });

      const result = await ExecuteAiAgentProductCommandService({
        companyId: 10,
        req: { user: { id: 1, profile: "admin", companyId: 10 } } as never,
        body: { command: "deactivate" }
      });

      expect(result.command).toBe("deactivate");
      expect(agent.update).toHaveBeenCalled();
    });
  });
});
