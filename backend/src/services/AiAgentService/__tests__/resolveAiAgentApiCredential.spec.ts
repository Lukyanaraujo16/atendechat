jest.mock("../../../models/AiProviderCredential", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../models/Prompt", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../helpers/aiProviderCredentialCrypto", () => ({
  decryptAiProviderApiKey: jest.fn((v: string) => v.replace("enc:", ""))
}));

import AiProviderCredential from "../../../models/AiProviderCredential";
import Prompt from "../../../models/Prompt";
import { resolveAiAgentApiCredential } from "../resolveAiAgentApiCredential";
import AiAgent from "../../../models/AiAgent";
import Whatsapp from "../../../models/Whatsapp";
import Ticket from "../../../models/Ticket";

function agent(partial: Record<string, unknown>) {
  return partial as unknown as AiAgent;
}

function whatsapp(partial: Record<string, unknown>) {
  return partial as unknown as Whatsapp;
}

function ticket(partial: Record<string, unknown>) {
  return partial as unknown as Ticket;
}

describe("resolveAiAgentApiCredential", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("usa credencial vinculada ao agente", async () => {
    (AiProviderCredential.findOne as jest.Mock).mockResolvedValue({
      id: 5,
      enabled: true,
      provider: "openai",
      apiKeyEncrypted: "enc:sk-agent-key-12345678"
    });

    const result = await resolveAiAgentApiCredential({
      companyId: 1,
      agent: agent({ id: 9, aiProviderCredentialId: 5 }),
      whatsapp: whatsapp({ promptId: null }),
      ticket: ticket({ promptId: null })
    });

    expect(result.source).toBe("agent_credential");
    expect(result.provider).toBe("openai");
    expect(result.apiKey).toBe("sk-agent-key-12345678");
    expect(result.credentialId).toBe(5);
    expect(AiProviderCredential.findOne).toHaveBeenCalledWith({
      where: { id: 5, companyId: 1, enabled: true }
    });
  });

  it("usa credencial default da empresa quando agente não tem vínculo", async () => {
    (AiProviderCredential.findOne as jest.Mock).mockResolvedValue({
      id: 2,
      enabled: true,
      provider: "gemini",
      apiKeyEncrypted: "enc:AIzaSyTestKey123456789012345"
    });

    const result = await resolveAiAgentApiCredential({
      companyId: 1,
      agent: agent({ id: 9, aiProviderCredentialId: null }),
      whatsapp: whatsapp({ promptId: null }),
      ticket: ticket({ promptId: null })
    });

    expect(result.source).toBe("company_default");
    expect(result.provider).toBe("gemini");
    expect(result.apiKey).toBe("AIzaSyTestKey123456789012345");
  });

  it("faz fallback para Prompt legado", async () => {
    (AiProviderCredential.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (Prompt.findOne as jest.Mock).mockResolvedValue({
      apiKey: "sk-legacy-prompt-key123456"
    });

    const result = await resolveAiAgentApiCredential({
      companyId: 1,
      agent: agent({ id: 9, aiProviderCredentialId: null }),
      whatsapp: whatsapp({ promptId: 10 }),
      ticket: ticket({ promptId: null })
    });

    expect(result.source).toBe("legacy_prompt");
    expect(result.provider).toBe("openai");
    expect(result.apiKey).toBe("sk-legacy-prompt-key123456");
  });

  it("retorna missing quando não há chave", async () => {
    (AiProviderCredential.findOne as jest.Mock).mockResolvedValue(null);
    (Prompt.findOne as jest.Mock).mockResolvedValue(null);

    const result = await resolveAiAgentApiCredential({
      companyId: 1,
      agent: agent({ id: 9, aiProviderCredentialId: null }),
      whatsapp: whatsapp({ promptId: null }),
      ticket: ticket({ promptId: null })
    });

    expect(result.source).toBe("missing");
    expect(result.apiKey).toBeNull();
  });

  it("não cruza tenant ao buscar credencial do agente", async () => {
    (AiProviderCredential.findOne as jest.Mock).mockResolvedValue(null);
    (Prompt.findOne as jest.Mock).mockResolvedValue(null);

    await resolveAiAgentApiCredential({
      companyId: 2,
      agent: agent({ id: 9, aiProviderCredentialId: 5 }),
      whatsapp: whatsapp({ promptId: null }),
      ticket: ticket({ promptId: null })
    });

    expect(AiProviderCredential.findOne).toHaveBeenCalledWith({
      where: { id: 5, companyId: 2, enabled: true }
    });
  });
});
