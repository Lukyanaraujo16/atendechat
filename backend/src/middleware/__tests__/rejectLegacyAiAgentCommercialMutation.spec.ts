import AppError from "../../errors/AppError";
import {
  ERR_AI_AGENT_LEGACY_MUTATION_DISABLED,
  ERR_AI_PROVIDER_CREDENTIAL_LEGACY_MUTATION_DISABLED,
  LEGACY_COMMERCIAL_MUTATION_HTTP_STATUS,
  rejectLegacyAiAgentCommercialMutation,
  rejectLegacyAiProviderCredentialCommercialMutation
} from "../rejectLegacyAiAgentCommercialMutation";

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { logger } from "../../utils/logger";

function run(
  middleware: (req: any, res: any, next: any) => void,
  reqOverrides: Record<string, unknown> = {}
) {
  return new Promise<{ err?: any; req: any }>(resolve => {
    const req = {
      method: "POST",
      originalUrl: "/ai-agents",
      path: "/ai-agents",
      baseUrl: "",
      headers: {},
      user: {
        id: 42,
        companyId: 10,
        profile: "admin"
      },
      ...reqOverrides
    };
    middleware(req, {}, (err?: any) => resolve({ err, req }));
  });
}

describe("Fase 2.8B.2 — rejectLegacyAiAgentCommercialMutation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("bloqueia mutação de agente com 410 e código estável", async () => {
    const { err } = await run(rejectLegacyAiAgentCommercialMutation("ai_agent"));

    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe(ERR_AI_AGENT_LEGACY_MUTATION_DISABLED);
    expect(err.statusCode).toBe(LEGACY_COMMERCIAL_MUTATION_HTTP_STATUS);
    expect(err.clientMessage).toMatch(/área AI Agent/i);
  });

  it.each([
    ["ai_agent_knowledge"],
    ["ai_agent_simulator"],
    ["ai_agent_shadow_review"]
  ] as const)("domínio %s usa o mesmo código de agente", async domain => {
    const { err } = await run(rejectLegacyAiAgentCommercialMutation(domain));
    expect(err.message).toBe(ERR_AI_AGENT_LEGACY_MUTATION_DISABLED);
    expect(err.statusCode).toBe(410);
  });

  it("bloqueia mutação de credencial com código específico", async () => {
    const { err } = await run(
      rejectLegacyAiProviderCredentialCommercialMutation(),
      { originalUrl: "/ai-provider-credentials", method: "DELETE" }
    );

    expect(err.message).toBe(
      ERR_AI_PROVIDER_CREDENTIAL_LEGACY_MUTATION_DISABLED
    );
    expect(err.statusCode).toBe(410);
  });

  it("emite log estruturado sem secrets/payload", async () => {
    await run(rejectLegacyAiAgentCommercialMutation("ai_agent"), {
      method: "PUT",
      originalUrl: "/ai-agents/99?x=1",
      headers: { "x-request-id": "corr-1" },
      body: { apiKey: "sk-secret", prompt: "não logar" },
      user: { id: 7, companyId: 3, profile: "admin" }
    });

    expect(logger.info).toHaveBeenCalledTimes(1);
    const [fields, msg] = (logger.info as jest.Mock).mock.calls[0];
    expect(msg).toBe("ai_agent.legacy_mutation_blocked");
    expect(fields).toMatchObject({
      event: "ai_agent.legacy_mutation_blocked",
      method: "PUT",
      route: "PUT /ai-agents/99",
      companyId: 3,
      userId: 7,
      role: "admin",
      legacyDomain: "ai_agent",
      errorCode: ERR_AI_AGENT_LEGACY_MUTATION_DISABLED,
      requestId: "corr-1"
    });
    expect(fields).not.toHaveProperty("apiKey");
    expect(fields).not.toHaveProperty("prompt");
    expect(fields).not.toHaveProperty("body");
    expect(fields).not.toHaveProperty("authorization");
    expect(JSON.stringify(fields)).not.toMatch(/sk-secret/);
  });

  it("mesmo bloqueio para user comum e admin (sem oráculo)", async () => {
    for (const profile of ["admin", "user", "supervisor"]) {
      const { err } = await run(
        rejectLegacyAiAgentCommercialMutation("ai_agent"),
        { user: { id: 1, companyId: 1, profile } }
      );
      expect(err.message).toBe(ERR_AI_AGENT_LEGACY_MUTATION_DISABLED);
      expect(err.statusCode).toBe(410);
    }
  });

  it("não inclui IDs de recurso na mensagem do cliente", async () => {
    const { err } = await run(
      rejectLegacyAiAgentCommercialMutation("ai_agent"),
      { originalUrl: "/ai-agents/12345" }
    );
    expect(err.clientMessage).not.toMatch(/12345/);
    expect(err.clientMessage).not.toMatch(/company/i);
  });
});
