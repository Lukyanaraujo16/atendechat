import * as fs from "fs";
import * as path from "path";

/**
 * Contrato de wiring Fase 2.8B.2:
 * mutações comerciais legadas usam rejectLegacy*;
 * leituras KB/Console e mutações técnicas Console NÃO usam o guard.
 */
describe("Fase 2.8B.2 — wiring de rotas legadas bloqueadas", () => {
  const agentRoutes = fs.readFileSync(
    path.join(__dirname, "../../routes/aiAgentRoutes.ts"),
    "utf8"
  );
  const credRoutes = fs.readFileSync(
    path.join(__dirname, "../../routes/aiProviderCredentialRoutes.ts"),
    "utf8"
  );

  it("importa guards de bloqueio legado", () => {
    expect(agentRoutes).toMatch(/rejectLegacyAiAgentCommercialMutation/);
    expect(credRoutes).toMatch(
      /rejectLegacyAiProviderCredentialCommercialMutation/
    );
  });

  it("bloqueia mutações comerciais de agentes", () => {
    expect(agentRoutes).toMatch(
      /aiAgentRoutes\.post\(\s*"\/ai-agents"[\s\S]*?blockAgent/
    );
    expect(agentRoutes).toMatch(
      /aiAgentRoutes\.put\(\s*"\/ai-agents\/:id"[\s\S]*?blockAgent/
    );
    expect(agentRoutes).toMatch(
      /aiAgentRoutes\.delete\(\s*"\/ai-agents\/:id"[\s\S]*?blockAgent/
    );
    expect(agentRoutes).toMatch(
      /aiAgentRoutes\.put\(\s*"\/ai-agents\/:id\/profile"[\s\S]*?blockAgent/
    );
    expect(agentRoutes).toMatch(
      /aiAgentRoutes\.post\(\s*"\/ai-agents\/:id\/profile\/preview"[\s\S]*?blockAgent/
    );
  });

  it("bloqueia knowledge/simulator/shadow-review comerciais", () => {
    expect(agentRoutes).toMatch(
      /knowledge-bases"[\s\S]*?blockKnowledge[\s\S]*?syncKnowledgeBases/
    );
    expect(agentRoutes).toMatch(
      /knowledge-settings"[\s\S]*?blockKnowledge[\s\S]*?upsertKnowledgeSettings/
    );
    expect(agentRoutes).toMatch(
      /knowledge-retrieval\/test"[\s\S]*?blockKnowledge/
    );
    expect(agentRoutes).toMatch(
      /simulator\/sessions"[\s\S]*?blockSimulator[\s\S]*?createSimulatorSession/
    );
    expect(agentRoutes).toMatch(
      /simulator\/sessions\/:sessionId\/messages"[\s\S]*?blockSimulator/
    );
    expect(agentRoutes).toMatch(
      /simulator\/sessions\/:sessionId\/end"[\s\S]*?blockSimulator/
    );
    expect(agentRoutes).toMatch(
      /shadow-suggestions\/:id\/review"[\s\S]*?blockShadowReview/
    );
  });

  it("preserva GET list agents e leituras Console/Analytics", () => {
    expect(agentRoutes).toMatch(
      /aiAgentRoutes\.get\(\s*"\/ai-agents",\s*isAuth,\s*requireAiAgent,\s*AiAgentController\.index/
    );
    expect(agentRoutes).not.toMatch(
      /get\(\s*"\/ai-agents"[\s\S]{0,120}blockAgent/
    );
    expect(agentRoutes).toMatch(/analytics\/dashboard/);
    expect(agentRoutes).toMatch(/\.\.\.techManage/);
    expect(agentRoutes).toMatch(/shadow-fc\/company-setting/);
    expect(agentRoutes).not.toMatch(
      /shadow-fc\/company-setting"[\s\S]{0,200}block/
    );
    expect(agentRoutes).not.toMatch(
      /analytics\/knowledge-gaps\/:id"[\s\S]{0,200}block/
    );
  });

  it("preserva GETs de knowledge/simulator/shadow-suggestions", () => {
    expect(agentRoutes).toMatch(
      /get\(\s*"\/ai-agents\/:id\/knowledge-bases"/
    );
    expect(agentRoutes).toMatch(
      /get\(\s*"\/ai-agents\/:id\/simulator\/sessions"/
    );
    expect(agentRoutes).toMatch(/get\(\s*"\/ai-agents\/shadow-suggestions"/);
    expect(agentRoutes).not.toMatch(
      /get\(\s*"\/ai-agents\/shadow-suggestions"[\s\S]{0,120}block/
    );
  });

  it("bloqueia mutações de credenciais e preserva GET list", () => {
    expect(credRoutes).toMatch(
      /post\(\s*"\/ai-provider-credentials"[\s\S]*?blockCredential/
    );
    expect(credRoutes).toMatch(
      /put\(\s*"\/ai-provider-credentials\/:id"[\s\S]*?blockCredential/
    );
    expect(credRoutes).toMatch(
      /delete\(\s*"\/ai-provider-credentials\/:id"[\s\S]*?blockCredential/
    );
    expect(credRoutes).toMatch(
      /post\(\s*"\/ai-provider-credentials\/:id\/test"[\s\S]*?blockCredential/
    );
    expect(credRoutes).toMatch(
      /get\(\s*"\/ai-provider-credentials",\s*isAuth,\s*requireAiAgent,\s*AiProviderCredentialController\.index/
    );
    expect(credRoutes).not.toMatch(
      /get\(\s*"\/ai-provider-credentials"[\s\S]{0,120}blockCredential/
    );
    expect(credRoutes).not.toMatch(
      /get\(\s*"\/ai-provider-credentials\/:id"[\s\S]{0,120}blockCredential/
    );
  });

  it("não remove controllers (permanecem na cadeia para 2.8B.3)", () => {
    expect(agentRoutes).toMatch(/AiAgentController\.store/);
    expect(agentRoutes).toMatch(/AiAgentController\.update/);
    expect(agentRoutes).toMatch(/AiAgentController\.remove/);
    expect(credRoutes).toMatch(/AiProviderCredentialController\.store/);
    expect(credRoutes).toMatch(/AiProviderCredentialController\.update/);
    expect(credRoutes).toMatch(/AiProviderCredentialController\.remove/);
    expect(credRoutes).toMatch(/AiProviderCredentialController\.test/);
  });
});
