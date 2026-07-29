import AiAgent from "../../../models/AiAgent";
import AiAgentProfile from "../../../models/AiAgentProfile";
import AiProviderCredential from "../../../models/AiProviderCredential";
import Whatsapp from "../../../models/Whatsapp";
import GetAiAgentProductConfigurationService from "../GetAiAgentProductConfigurationService";
import GetAiAgentProductConfigurationOptionsService from "../GetAiAgentProductConfigurationOptionsService";
import PreviewAiAgentProductConfigurationService from "../PreviewAiAgentProductConfigurationService";
import {
  serializeAiAgentProductConfiguration,
  serializeAiAgentProductConfigurationPreview
} from "../serializeAiAgentProduct";
import GetAiAgentProductSummaryService, {
  resolveAiAgentProductAvailability
} from "../GetAiAgentProductSummaryService";

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../../models/AiAgentProfile", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../models/AiProviderCredential", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
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

const mockAgentFindAll = AiAgent.findAll as jest.Mock;
const mockAgentFindOne = AiAgent.findOne as jest.Mock;
const mockProfileFindOne = AiAgentProfile.findOne as jest.Mock;
const mockCredentialFindAll = AiProviderCredential.findAll as jest.Mock;
const mockCredentialFindOne = AiProviderCredential.findOne as jest.Mock;
const mockWhatsappFindAll = Whatsapp.findAll as jest.Mock;
const mockSummary = GetAiAgentProductSummaryService as jest.Mock;
const mockAvailability = resolveAiAgentProductAvailability as jest.Mock;

const profileInput = {
  companyName: "Acme",
  businessSegment: "ecommerce",
  customBusinessSegment: null,
  departments: ["sales"],
  attendantName: "Ana",
  attendantRole: "Consultora",
  tone: "friendly",
  customTone: null,
  clientAddressStyle: null,
  emojiLevel: "low",
  responseLength: "medium",
  allowedActions: [],
  forbiddenActions: [],
  handoffRules: [],
  companyDescription: "Comércio local",
  productsAndServices: "Produtos Acme",
  serviceArea: null,
  businessHours: null,
  pricingPolicy: null,
  negotiationPolicy: null,
  schedulingPolicy: null,
  frequentlyAskedQuestions: [],
  importantInformation: null,
  customInstructions: null,
  sourceWebsite: null
};

function agent(aiProviderCredentialId: number | null = 5) {
  return {
    id: 1,
    companyId: 10,
    enabled: false,
    name: "Bot",
    description: null,
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 512,
    systemPrompt: null,
    fallbackMessage: null,
    handoffMessage: null,
    aiProviderCredentialId
  } as any;
}

function summary() {
  return {
    availability: { enabledByPlan: true, accessibleByUser: true },
    status: "setup_incomplete",
    mode: "off",
    agent: { exists: true, id: 1, name: "Bot", enabled: false },
    connection: { linked: false },
    connectionScope: {
      type: "all_linked",
      count: 0,
      connectedCount: 0,
      disconnectedCount: 0,
      names: []
    },
    agentScope: { type: "single", count: 1 },
    readiness: {
      ready: false,
      status: "setup_incomplete",
      mode: "off",
      nextAction: "configure_agent",
      checks: []
    }
  };
}

describe("AiAgent Product Wizard contract (Fase 2.4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailability.mockResolvedValue({
      enabledByPlan: true,
      accessibleByUser: true
    });
    mockSummary.mockResolvedValue(summary());
    mockWhatsappFindAll.mockResolvedValue([]);
    mockCredentialFindAll.mockResolvedValue([]);
    mockProfileFindOne.mockResolvedValue(null);
  });

  it("GET retorna somente os campos comerciais do profile", async () => {
    const currentAgent = agent();
    mockAgentFindAll.mockResolvedValue([currentAgent]);
    mockAgentFindOne.mockResolvedValue(currentAgent);
    mockCredentialFindOne.mockResolvedValue({
      id: 5,
      companyId: 10,
      name: "OpenAI",
      provider: "openai",
      apiKeyMasked: "sk-...123",
      apiKeyEncrypted: "SECRET",
      enabled: true
    });
    mockProfileFindOne.mockResolvedValue({
      ...profileInput,
      generatedPrompt: "PROMPT_INTERNO",
      setupMode: "guided",
      schemaVersion: "1",
      companyId: 10,
      aiAgentId: 1
    });

    const result = await GetAiAgentProductConfigurationService({
      companyId: 10,
      availability: { enabledByPlan: true, accessibleByUser: true }
    });

    expect(result.configuration!.profile).toMatchObject({
      companyName: "Acme",
      attendantName: "Ana"
    });
    const profile = result.configuration!.profile!;
    expect(profile).not.toHaveProperty("generatedPrompt");
    expect(profile).not.toHaveProperty("setupMode");
    expect(profile).not.toHaveProperty("schemaVersion");
    expect(profile).not.toHaveProperty("companyId");
    expect(profile).not.toHaveProperty("aiAgentId");
  });

  it("options inclui modelos OpenAI e Gemini da allowlist canônica", async () => {
    mockAgentFindAll.mockResolvedValue([]);
    const options = await GetAiAgentProductConfigurationOptionsService({
      companyId: 10,
      availability: { enabledByPlan: true, accessibleByUser: true }
    });

    expect(options.models).toEqual(
      expect.arrayContaining([
        { value: "gpt-4o-mini", label: "gpt-4o-mini", provider: "openai" },
        {
          value: "gemini-2.5-flash",
          label: "gemini-2.5-flash",
          provider: "gemini"
        }
      ])
    );
  });

  it("preview funciona sem agentId e retorna somente preview", async () => {
    const result = await PreviewAiAgentProductConfigurationService({
      companyId: 10,
      availability: { enabledByPlan: true, accessibleByUser: true },
      body: profileInput
    });

    expect(Object.keys(result)).toEqual(["preview"]);
    expect(result.preview).toContain("Acme");
    expect(result.preview).toContain("Ana");
  });

  it("GET sem credential vinculada não usa fallback da empresa", async () => {
    const currentAgent = agent(null);
    mockAgentFindAll.mockResolvedValue([currentAgent]);
    mockAgentFindOne.mockResolvedValue(currentAgent);
    mockProfileFindOne.mockResolvedValue(profileInput);

    const result = await GetAiAgentProductConfigurationService({
      companyId: 10,
      availability: { enabledByPlan: true, accessibleByUser: true }
    });

    expect(mockCredentialFindOne).not.toHaveBeenCalled();
    expect(result.configuration!.credential).toEqual({
      configured: false,
      label: null,
      maskedKey: null
    });
  });

  it("serializers removem campos não allowlisted e não expõem secrets", () => {
    const configuration = serializeAiAgentProductConfiguration({
      identity: { name: "Bot", description: null },
      messages: { fallbackMessage: null, handoffMessage: null },
      model: { name: "gpt-4o-mini", temperature: 0.3, maxTokens: 512 },
      profile: {
        companyName: "Acme",
        generatedPrompt: "PROMPT_INTERNO",
        apiKey: "SECRET"
      },
      instructions: { configured: true, preview: "Prévia" },
      provider: { configured: true, type: "openai", label: "OpenAI" },
      credential: { configured: true, label: "OpenAI", maskedKey: "sk-...123" },
      connections: []
    });
    const preview = serializeAiAgentProductConfigurationPreview({
      preview: "Prévia",
      apiKey: "SECRET"
    });

    expect(JSON.stringify(configuration)).not.toContain("PROMPT_INTERNO");
    expect(JSON.stringify(configuration)).not.toContain("SECRET");
    expect(preview).toEqual({ preview: "Prévia" });
  });
});
