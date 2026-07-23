import {
  assertCompanyIdFromAuth,
  assertResourceBelongsToCompany,
  assertSafeId,
  assertConfirmation,
  stripSecretsDeep,
  assertPayloadBounds
} from "../AgentOsResourceAuth";
import { toSafeAgentOsError } from "../AgentOsSafeError";
import {
  revalidateToolBoundary,
  revalidateMemoryBoundary,
  revalidateDelegationBoundary
} from "../AgentOsBoundaryGuard";
import {
  getAgentOsSecurityConfig,
  resetAgentOsSecurityConfig
} from "../AgentOsSecurityConfig";
import {
  AGENTOS_FEATURE_KEYS,
  AGENTOS_OFFICIAL_FEATURE_CATALOG,
  AGENTOS_RATE_LIMITS,
  AGENTOS_PAYLOAD_LIMITS
} from "../../../../config/automationAgentOsSecurityConstants";
import {
  classifyAgentOsRateScope,
  resetAgentOsRateLimitBuckets,
  agentOsRateLimit
} from "../../../../middleware/agentOsRateLimit";
import AppError from "../../../../errors/AppError";

describe("AgentOS Security Wave 2", () => {
  beforeEach(() => {
    resetAgentOsSecurityConfig();
    resetAgentOsRateLimitBuckets();
  });

  it("registers official feature flags", () => {
    expect(AGENTOS_OFFICIAL_FEATURE_CATALOG).toContain(AGENTOS_FEATURE_KEYS.mcp);
    expect(AGENTOS_OFFICIAL_FEATURE_CATALOG).toContain(AGENTOS_FEATURE_KEYS.learning);
    expect(AGENTOS_OFFICIAL_FEATURE_CATALOG).toContain(AGENTOS_FEATURE_KEYS.multiAgent);
    expect(AGENTOS_OFFICIAL_FEATURE_CATALOG).toContain(AGENTOS_FEATURE_KEYS.memory);
    expect(AGENTOS_OFFICIAL_FEATURE_CATALOG).toContain(AGENTOS_FEATURE_KEYS.replay);
    expect(AGENTOS_OFFICIAL_FEATURE_CATALOG).toContain(AGENTOS_FEATURE_KEYS.tester);
  });

  it("enforces tenant from auth and rejects mismatch", () => {
    expect(assertCompanyIdFromAuth(10)).toBe(10);
    expect(() => assertCompanyIdFromAuth(10, 99)).toThrow(/ERR_TENANT_MISMATCH/);
    expect(() => assertCompanyIdFromAuth(null)).toThrow(/ERR_NO_PERMISSION/);
  });

  it("enforces resource belongs to company", () => {
    expect(() =>
      assertResourceBelongsToCompany(1, 2, "memory")
    ).toThrow(/ERR_TENANT_MISMATCH/);
    assertResourceBelongsToCompany(5, 5, "agent");
  });

  it("validates ids and payload bounds", () => {
    expect(assertSafeId("abc-123")).toBe("abc-123");
    expect(() => assertSafeId("bad id!")).toThrow(/ERR_VALIDATION/);
    expect(() =>
      assertPayloadBounds({ x: "a".repeat(AGENTOS_PAYLOAD_LIMITS.maxJsonBytes + 10) })
    ).toThrow(/ERR_PAYLOAD_TOO_LARGE/);
  });

  it("requires confirmation for sensitive ops", () => {
    expect(() => assertConfirmation({}, true)).toThrow(/ERR_CONFIRMATION_REQUIRED/);
    assertConfirmation({ confirm: true }, true);
  });

  it("strips secrets from objects", () => {
    const cleaned = stripSecretsDeep({
      apiKey: "secret",
      token: "t",
      nested: { password: "p", ok: 1 }
    });
    expect(cleaned.apiKey).toBe("[REDACTED]");
    expect(cleaned.token).toBe("[REDACTED]");
    expect((cleaned.nested as any).password).toBe("[REDACTED]");
    expect((cleaned.nested as any).ok).toBe(1);
  });

  it("sanitizes internal errors", () => {
    const err = toSafeAgentOsError(new Error("SequelizeDatabaseError: SQL ..."));
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe("ERR_INTERNAL");
    expect(err.clientMessage).not.toMatch(/SQL/i);
  });

  it("revalidates boundaries fail-closed", () => {
    expect(() => revalidateToolBoundary({ allowed: false })).toThrow(/ERR_BOUNDARY_TOOL/);
    revalidateToolBoundary({ allowed: true });
    expect(() => revalidateMemoryBoundary({ allowed: false })).toThrow(/ERR_BOUNDARY_MEMORY/);
    expect(() =>
      revalidateDelegationBoundary({ allowed: false })
    ).toThrow(/ERR_BOUNDARY_DELEGATION/);
  });

  it("keeps live integrations disabled by default", () => {
    const cfg = getAgentOsSecurityConfig();
    expect(cfg.liveIntegrationAllowed).toBe(false);
    expect(cfg.multiAgentLiveAllowed).toBe(false);
    expect(cfg.learningAutoPromotionAllowed).toBe(false);
  });

  it("classifies rate limit scopes", () => {
    expect(classifyAgentOsRateScope("/automation/learning/analyze")).toBe("learning");
    expect(classifyAgentOsRateScope("/automation/agents/replay/1")).toBe("replay");
    expect(classifyAgentOsRateScope("/automation/agents/delegations/simulate")).toBe(
      "delegation"
    );
    expect(classifyAgentOsRateScope("/automation/mcp/servers")).toBe("mcp");
    expect(AGENTOS_RATE_LIMITS.tester.max).toBeGreaterThan(0);
  });

  it("rate limits after max requests", async () => {
    const { useInMemoryAgentOsProviders } = require("../../scalability/providers");
    useInMemoryAgentOsProviders();
    const lim = AGENTOS_RATE_LIMITS.adminApi;
    const mw = agentOsRateLimit("adminApi");
    const req: any = { user: { companyId: 1, id: 9 }, path: "/automation/x" };
    let blocked = false;
    for (let i = 0; i < lim.max + 2; i += 1) {
      await mw(req, {} as any, (err?: any) => {
        if (err) blocked = true;
      });
    }
    expect(blocked).toBe(true);
  });
});
