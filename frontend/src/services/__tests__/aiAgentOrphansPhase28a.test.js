/**
 * Fase 2.8A — limpeza de superfícies frontend órfãs do AI Agent.
 * Garante ausência dos seis componentes removidos e preservação de
 * KB (list credentials), Console (listAiAgents / Shadow FC) e Product.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const ORPHANS = [
  "components/AiAgentModal",
  "components/AiProviderCredentialModal",
  "components/AiAgentCreateChoiceModal",
  "components/AiAgentShadowReviewModal",
  "components/AiAgentShadowDetailsModal",
  "components/AiAgentKnowledgePanel",
];

const ORPHAN_NAMES = [
  "AiAgentModal",
  "AiProviderCredentialModal",
  "AiAgentCreateChoiceModal",
  "AiAgentShadowReviewModal",
  "AiAgentShadowDetailsModal",
  "AiAgentKnowledgePanel",
];

describe("Fase 2.8A — órfãos removidos", () => {
  it("diretórios dos seis componentes não existem", () => {
    ORPHANS.forEach((rel) => {
      expect(exists(rel)).toBe(false);
    });
  });

  it("helpers exclusivos dos órfãos não existem", () => {
    expect(exists("config/aiAgentShadowObservability.js")).toBe(false);
    expect(exists("utils/aiAgentKnowledgeObservability.js")).toBe(false);
  });

  it("Product Hub/Wizard/Credential/Simulator não referenciam órfãos", () => {
    const sources = [
      read("pages/AiAgent/index.js"),
      read("components/AiAgentExperiencePage/index.js"),
      read("components/AiAgentWizard/index.js"),
      read("components/AiAgentProductCredentialModal/index.js"),
      read("pages/AiAgentSimulator/index.js"),
      read("services/aiAgentProductApi.js"),
    ];
    sources.forEach((src) => {
      ORPHAN_NAMES.forEach((name) => {
        expect(src).not.toMatch(new RegExp(`\\b${name}\\b`));
      });
    });
  });
});

describe("Fase 2.8A — APIs frontend", () => {
  const credentialApi = read("services/aiProviderCredentialApi.js");
  const agentApi = read("services/aiAgentApi.js");

  it("preserva listAiProviderCredentials para Knowledge Base", () => {
    expect(credentialApi).toMatch(/export function listAiProviderCredentials/);
    expect(credentialApi).toMatch(/\/ai-provider-credentials/);
    expect(credentialApi).not.toMatch(/createAiProviderCredential/);
    expect(credentialApi).not.toMatch(/updateAiProviderCredential/);
    expect(credentialApi).not.toMatch(/deleteAiProviderCredential/);
    expect(credentialApi).not.toMatch(/getAiProviderCredential/);
    expect(credentialApi).not.toMatch(/testAiProviderCredential/);
  });

  it("KnowledgeEmbeddingSettingsDialog continua importando list", () => {
    const kbDialog = read("components/KnowledgeEmbeddingSettingsDialog/index.js");
    expect(kbDialog).toMatch(/listAiProviderCredentials/);
    expect(kbDialog).toMatch(/from ["'].*aiProviderCredentialApi["']/);
  });

  it("aiAgentApi preserva Console/Shadow FC e remove CRUD/suggestions/knowledge órfãos", () => {
    expect(agentApi).toMatch(/export function listAiAgents/);
    expect(agentApi).toMatch(/getAiAgentShadowFcDashboard/);
    expect(agentApi).toMatch(/getAiAgentShadowEvaluation/);
    expect(agentApi).toMatch(/updateShadowFcCompanySetting/);
    expect(agentApi).not.toMatch(/export function createAiAgent\b/);
    expect(agentApi).not.toMatch(/export function updateAiAgent\b/);
    expect(agentApi).not.toMatch(/export function deleteAiAgent\b/);
    expect(agentApi).not.toMatch(/export function getAiAgent\b/);
    expect(agentApi).not.toMatch(/shadow-suggestions/);
    expect(agentApi).not.toMatch(/knowledge-bases/);
    expect(agentApi).not.toMatch(/simulator\/sessions/);
  });

  it("Console Analytics continua usando listAiAgents", () => {
    const analytics = read("pages/AiAgentAnalytics/index.js");
    expect(analytics).toMatch(/listAiAgents/);
  });

  it("Shadow FC continua importando APIs de evaluations", () => {
    const shadowFc = read("pages/AiAgentShadowFc/index.js");
    expect(shadowFc).toMatch(/getAiAgentShadowFcDashboard/);
    expect(shadowFc).toMatch(/getAiAgentShadowEvaluation/);
  });
});

describe("Fase 2.8A — rotas e superfícies vivas", () => {
  it("rotas Product e redirects permanecem registrados", () => {
    const routes = read("routes/LoggedInRoutesContent.js");
    expect(routes).toMatch(/AI_AGENT_ROUTE_PATH/);
    expect(routes).toMatch(/AI_AGENT_WIZARD_ROUTE_PATH/);
    expect(routes).toMatch(/AI_AGENT_SIMULATOR_ROUTE_PATH/);
    expect(routes).toMatch(/AI_AGENT_SIMULATOR_LEGACY_ROUTE_PATH/);
    expect(routes).toMatch(/Redirect to=\{AI_AGENT_SIMULATOR_ROUTE_PATH\}/);
  });

  it("aliases Console analytics/shadow-fc permanecem", () => {
    const consoleRoutes = read("config/agentOsConsoleRoutes.js");
    expect(consoleRoutes).toMatch(/AI_AGENT_ANALYTICS_ROUTE_PATH/);
    expect(consoleRoutes).toMatch(/AI_AGENT_SHADOW_FC_ROUTE_PATH/);
    expect(consoleRoutes).toMatch(/shadow-fc/);
    expect(consoleRoutes).toMatch(/analytics/);
  });

  it("SimulatorKnowledgePanel e Product Credential Modal existem", () => {
    expect(exists("components/AiAgentSimulator/SimulatorKnowledgePanel.js")).toBe(
      true
    );
    expect(exists("components/AiAgentProductCredentialModal/index.js")).toBe(
      true
    );
  });

  it("Knowledge Base page mantém dialog de embedding", () => {
    const kb = read("pages/KnowledgeBase/index.js");
    expect(kb).toMatch(/KnowledgeEmbeddingSettingsDialog/);
  });
});
