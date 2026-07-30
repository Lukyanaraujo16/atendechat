/**
 * Fase 2.7 — credenciais comerciais do Agente de IA.
 */
import fs from "fs";
import path from "path";
import {
  createAiAgentProductCredential,
  disableAiAgentProductCredential,
  enableAiAgentProductCredential,
  getAiAgentProductCredential,
  listAiAgentProductCredentials,
  testAiAgentProductCredential,
  updateAiAgentProductCredential,
} from "../aiAgentProductApi";
import api from "../api";

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const source = (relativePath) =>
  fs.readFileSync(path.join(__dirname, relativePath), "utf8");

const apiSource = source("../aiAgentProductApi.js");
const modalSource = source(
  "../../components/AiAgentProductCredentialModal/index.js"
);
const hubSource = source("../../components/AiAgentExperiencePage/index.js");
const wizardSource = source("../../components/AiAgentWizard/index.js");

describe("Fase 2.7 — Product Credentials API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });
  });

  it("usa somente os endpoints Product de credenciais", async () => {
    await listAiAgentProductCredentials();
    await getAiAgentProductCredential("cred ref");
    await createAiAgentProductCredential({
      name: "Produção",
      provider: "openai",
      apiKey: "secret",
    });
    await updateAiAgentProductCredential("cred ref", { name: "Principal" });
    await testAiAgentProductCredential("cred ref");
    await enableAiAgentProductCredential("cred ref");
    await disableAiAgentProductCredential("cred ref");

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/product/ai-agent/credentials"
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/product/ai-agent/credentials/cred%20ref"
    );
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/credentials",
      {
        name: "Produção",
        provider: "openai",
        apiKey: "secret",
      }
    );
    expect(api.put).toHaveBeenCalledWith(
      "/product/ai-agent/credentials/cred%20ref",
      { name: "Principal" }
    );
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/credentials/cred%20ref/test"
    );
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/credentials/cred%20ref/enable"
    );
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/credentials/cred%20ref/disable"
    );
  });

  it("create envia somente dados comerciais, sem ids técnicos", async () => {
    const payload = {
      name: "Gemini",
      provider: "gemini",
      apiKey: "key",
    };
    await createAiAgentProductCredential(payload);

    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/credentials",
      payload
    );
    expect(api.post.mock.calls[0][1]).not.toHaveProperty("agentId");
    expect(api.post.mock.calls[0][1]).not.toHaveProperty("credentialId");
    expect(api.post.mock.calls[0][1]).not.toHaveProperty("companyId");
  });

  it("não referencia o endpoint legado no client Product", () => {
    expect(apiSource).not.toMatch(/ai-provider-credentials/);
  });
});

describe("Fase 2.7 — contrato estático da experiência", () => {
  it("Hub e Wizard não importam infraestrutura legada", () => {
    [hubSource, wizardSource].forEach((fileSource) => {
      expect(fileSource).not.toMatch(/aiProviderCredentialApi/);
      expect(fileSource).not.toMatch(/AiProviderCredentialModal/);
      expect(fileSource).not.toMatch(/ai-provider-credentials/);
    });
  });

  it("Hub oferece gestão de credenciais e refetch do summary", () => {
    expect(hubSource).toMatch(/manageCredentials/);
    expect(hubSource).toMatch(/handleCredentialSuccess/);
    expect(hubSource).toMatch(/await onRetry\(\)/);
  });

  it("modal não expõe remoção e limpa a chave após salvar", () => {
    expect(modalSource).not.toMatch(/method=["']delete["']/i);
    expect(modalSource).not.toMatch(/deleteAiAgentProductCredential/);
    expect(modalSource).toMatch(
      /setForm\(\(current\) => \(\{ \.\.\.current, apiKey: "" \}\)\)/
    );
    expect(modalSource).not.toMatch(/aiProviderCredentialApi/);
    expect(modalSource).not.toMatch(/AiProviderCredentialModal/);
  });

  it("modal declara todos os testids comerciais", () => {
    [
      "ai-agent-product-credential-modal",
      "ai-agent-product-credential-add",
      "ai-agent-product-credential-save",
      "ai-agent-product-credential-test",
      "ai-agent-product-credential-disable",
      "ai-agent-product-credential-enable",
    ].forEach((testId) => expect(modalSource).toContain(testId));
  });

  it("Wizard recarrega opções e preserva navegação local", () => {
    expect(wizardSource).toMatch(/getAiAgentProductConfigurationOptions/);
    expect(wizardSource).toMatch(/setProductOptions\(nextOptions\)/);
    expect(wizardSource).toMatch(/patchFormState\(\{ credentialRef:/);
  });
});
