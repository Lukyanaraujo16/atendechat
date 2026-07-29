import fs from "fs";
import path from "path";
import {
  aiAgentProductConfigurationToWizardFormState,
  filterAiAgentWizardModelsByProvider,
  isAiAgentWizardScopeBlocked,
  mapAiAgentWizardProductOptions,
  wizardFormStateToProductConfigurationPayload,
  wizardFormStateToProductIdentityPayload,
} from "../../components/AiAgentWizard/aiAgentWizardProductMapper";
import { createDefaultWizardFormState } from "../../components/AiAgentWizard/aiAgentWizardDefaults";
import { postAiAgentProductConfigurationPreview } from "../aiAgentProductApi";
import api from "../api";

jest.mock("../api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

function wizardSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return wizardSourceFiles(target);
    return entry.name.endsWith(".js") ? [target] : [];
  });
}

describe("Fase 2.4 — migração do Wizard para Product API", () => {
  it("não contém endpoints, helpers mortos ou campos proibidos no domínio do Wizard", () => {
    const directories = [
      path.resolve(__dirname, "../../components/AiAgentWizard"),
      path.resolve(__dirname, "../../pages/AiAgentWizard"),
    ];
    const source = directories
      .flatMap((directory) => wizardSourceFiles(directory))
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");

    expect(source).not.toMatch(
      /\/ai-agents|\/ai-provider-credentials|\/whatsapp\/|\/automation\//
    );
    expect(source).not.toMatch(/aiAgentApi|aiProviderCredentialApi/);
    expect(source).not.toMatch(/createMinimalAiAgentPayload/);
    expect(source).not.toMatch(/\bsystemPrompt\b/);
    expect(source).not.toMatch(/\bapiKeyEncrypted\b/);
    // Chave secreta em payload — não confundir com maskedKey comercial.
    expect(source).not.toMatch(/\bapiKey\s*:/);
    // Payload legado com runtime — não confundir com `disabled` HTML nem
    // com `enabled: credential?.enabled === true` das options.
    expect(source).not.toMatch(/enabled:\s*(false|true)\b/);
    expect(source).not.toMatch(/\bmode:\s*["'](live|shadow|off|disabled)["']/);
  });

  it("gera payload comercial sem contexto, runtime ou segredo", () => {
    const payload = wizardFormStateToProductConfigurationPayload({
      ...createDefaultWizardFormState(),
      attendantName: "Sofia",
      companyName: "Acme",
      identityName: "Sofia",
      identityDescription: "Atendente virtual — Acme",
      provider: "openai",
      model: "gpt-4o-mini",
      credentialRef: "cred_1",
      connectionRefs: ["wa_1"],
      companyId: 10,
      agentId: 20,
      enabled: true,
      mode: "live",
      apiKey: "secret",
    }, { includeConnections: true });

    ["companyId", "agentId", "enabled", "mode", "apiKey"].forEach((key) =>
      expect(payload).not.toHaveProperty(key)
    );
    expect(payload).toEqual(
      expect.objectContaining({
        name: "Sofia",
        provider: "openai",
        credentialRef: "cred_1",
        connectionRefs: ["wa_1"],
      })
    );
  });

  it("gera payload de identidade sem campos estruturais", () => {
    const payload = wizardFormStateToProductIdentityPayload({
      ...createDefaultWizardFormState(),
      attendantName: "Sofia",
      companyName: "Acme",
      identityName: "Sofia",
      identityDescription: "Atendente virtual — Acme",
      provider: "openai",
      model: "gpt-4o-mini",
      credentialRef: "cred_1",
      fallbackMessage: "Fallback",
      handoffMessage: "Handoff",
    });
    expect(payload).toEqual({
      name: "Sofia",
      description: "Atendente virtual — Acme",
      fallbackMessage: "Fallback",
      handoffMessage: "Handoff",
    });
  });

  it("usa providers e modelos vindos das opções", () => {
    const options = mapAiAgentWizardProductOptions({
      providers: [
        {
          value: "openai",
          label: "OpenAI",
          available: true,
          models: ["gpt-4o-mini"],
        },
        {
          value: "gemini",
          label: "Google Gemini",
          available: true,
          models: ["gemini-2.5-flash"],
        },
      ],
    });

    expect(options.providers.map((item) => item.value)).toEqual([
      "openai",
      "gemini",
    ]);
    expect(
      filterAiAgentWizardModelsByProvider(options.models, "gemini").map(
        (item) => item.value
      )
    ).toEqual(["gemini-2.5-flash"]);
  });

  it("bloqueia escopo ambíguo sem usar identificador da URL", () => {
    expect(isAiAgentWizardScopeBlocked({ type: "ambiguous", count: 2 })).toBe(
      true
    );
    expect(isAiAgentWizardScopeBlocked({ type: "none", count: 0 })).toBe(false);
  });

  it("hidrata o formulário usando profile e identity", () => {
    const state = aiAgentProductConfigurationToWizardFormState(
      {
        identity: { name: "Nome comercial" },
        profile: {
          companyName: "Acme",
          attendantName: "Lia",
          businessSegment: "other",
          forbiddenActions: [],
        },
        provider: { type: "gemini" },
        model: { name: "gemini-2.5-flash" },
        connections: [],
      },
      { providers: [], credentials: [], connections: [] }
    );

    expect(state.companyName).toBe("Acme");
    expect(state.attendantName).toBe("Lia");
    expect(state.provider).toBe("gemini");
    expect(state.model).toBe("gemini-2.5-flash");
  });

  it("não calcula status de ativação no mapper do Wizard", () => {
    const mapperSource = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../components/AiAgentWizard/aiAgentWizardProductMapper.js"
      ),
      "utf8"
    );
    expect(mapperSource).not.toMatch(/ready_to_activate|setup_incomplete/);
  });

  it("usa o endpoint Product API para preview", async () => {
    api.post.mockResolvedValue({ data: { preview: "Olá" } });
    await expect(
      postAiAgentProductConfigurationPreview({ companyName: "Acme" })
    ).resolves.toEqual({ preview: "Olá" });
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/configuration/preview",
      { companyName: "Acme" }
    );
  });
});
