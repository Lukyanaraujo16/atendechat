import React from "react";
import fs from "fs";
import path from "path";
import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import AiAgentWizard from "../../components/AiAgentWizard";
import ActiveAgentIdentityStep from "../../components/AiAgentWizard/steps/ActiveAgentIdentityStep";
import {
  aiAgentProductConfigurationToWizardFormState,
  aiAgentWizardIdentitySnapshot,
  isAiAgentWizardActiveIdentityMode,
  wizardFormStateToProductIdentityPayload,
} from "../../components/AiAgentWizard/aiAgentWizardProductMapper";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useAiAgentProductConfiguration } from "../../hooks/useAiAgentProductConfiguration";

jest.mock("../../hooks/useAiAgentProductConfiguration", () => ({
  useAiAgentProductConfiguration: jest.fn(),
}));

jest.mock("../../errors/toastError", () => jest.fn());

jest.mock("react-toastify", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const ACTIVE_CONFIGURATION = {
  identity: {
    name: "Sofia Nova",
    description: "Identidade comercial nova",
  },
  messages: {
    fallbackMessage: "Não consegui responder.",
    handoffMessage: "Vou transferir para a equipe.",
  },
  profile: {
    companyName: "Empresa Antiga",
    attendantName: "Sofia Antiga",
    businessSegment: "ecommerce",
    departments: ["sales"],
    tone: "professional",
    emojiLevel: "low",
    responseLength: "short",
    forbiddenActions: [],
  },
  provider: { type: "openai" },
  model: { name: "gpt-4o-mini" },
  credential: {
    configured: true,
    label: "OpenAI Prod",
    maskedKey: "sk-...123",
  },
  connections: [
    { ref: "wa_1", name: "WhatsApp", selected: true },
  ],
};

const OPTIONS = {
  providers: [{ value: "openai", label: "OpenAI", available: true }],
  models: [
    { value: "gpt-4o-mini", label: "gpt-4o-mini", provider: "openai" },
  ],
  credentials: [
    {
      ref: "cred_openai",
      name: "OpenAI Prod",
      provider: "openai",
      maskedKey: "sk-...123",
      enabled: true,
    },
  ],
  connections: [
    {
      ref: "wa_1",
      name: "WhatsApp",
      selected: true,
      eligible: true,
    },
  ],
};

function activeHook(overrides = {}) {
  return {
    loading: false,
    loadAll: jest.fn().mockResolvedValue({
      configuration: {
        agentScope: { type: "single", count: 1 },
        configuration: ACTIVE_CONFIGURATION,
        editableWhileActive: false,
        summary: {
          status: "active",
          mode: "live",
          agentScope: { type: "single", count: 1 },
          agent: { exists: true, id: 7, name: "Sofia Nova", enabled: true },
        },
      },
      options: OPTIONS,
    }),
    create: jest.fn(),
    update: jest.fn().mockResolvedValue({
      changed: true,
      configuration: ACTIVE_CONFIGURATION,
      summary: {
        status: "active",
        mode: "live",
        agentScope: { type: "single", count: 1 },
        agent: { exists: true, id: 7, name: "Sofia Editada", enabled: true },
      },
    }),
    updateConnections: jest.fn(),
    preview: jest.fn(),
    ...overrides,
  };
}

function renderWizard(hookValue) {
  useAiAgentProductConfiguration.mockReturnValue(hookValue);
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: { companyId: 10 } }}>
        <AiAgentWizard />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

async function flushAsyncUpdates() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Hardening 2.4.2 — modo dedicado de identidade ativa", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("detecta activeIdentityMode somente para edição ativa", () => {
    expect(
      isAiAgentWizardActiveIdentityMode({
        isEditMode: true,
        editableWhileActive: false,
      })
    ).toBe(true);
    expect(
      isAiAgentWizardActiveIdentityMode({
        isEditMode: true,
        editableWhileActive: true,
      })
    ).toBe(false);
    expect(
      isAiAgentWizardActiveIdentityMode({
        isEditMode: false,
        editableWhileActive: false,
      })
    ).toBe(false);
  });

  it("hidrata identidade e profile separadamente, mesmo divergentes", () => {
    const state = aiAgentProductConfigurationToWizardFormState(
      ACTIVE_CONFIGURATION,
      OPTIONS
    );

    expect(state.identityName).toBe("Sofia Nova");
    expect(state.identityDescription).toBe("Identidade comercial nova");
    expect(state.attendantName).toBe("Sofia Antiga");
    expect(state.companyName).toBe("Empresa Antiga");
  });

  it("reload preserva identity.name novo sem sobrescrever pelo profile antigo", () => {
    const reloaded = aiAgentProductConfigurationToWizardFormState(
      {
        ...ACTIVE_CONFIGURATION,
        identity: {
          name: "Sofia Após Reload",
          description: "Descrição após reload",
        },
      },
      OPTIONS
    );

    expect(reloaded.identityName).toBe("Sofia Após Reload");
    expect(reloaded.identityDescription).toBe("Descrição após reload");
    expect(reloaded.attendantName).toBe("Sofia Antiga");
    expect(reloaded.companyName).toBe("Empresa Antiga");
  });

  it("dirty snapshot observa somente identidade e ignora mudanças de profile", () => {
    const state = aiAgentProductConfigurationToWizardFormState(
      ACTIVE_CONFIGURATION,
      OPTIONS
    );
    const initial = aiAgentWizardIdentitySnapshot(state);

    expect(
      aiAgentWizardIdentitySnapshot({
        ...state,
        tone: "friendly",
        businessSegment: "services",
        departments: ["support"],
      })
    ).toBe(initial);
    expect(
      aiAgentWizardIdentitySnapshot({
        ...state,
        identityName: "Sofia Editada",
      })
    ).not.toBe(initial);
  });

  it("tela dedicada expõe somente os quatro campos de identidade", () => {
    const onChange = jest.fn();
    render(
      <ActiveAgentIdentityStep
        formState={aiAgentProductConfigurationToWizardFormState(
          ACTIVE_CONFIGURATION,
          OPTIONS
        )}
        onChange={onChange}
      />
    );

    expect(screen.getByTestId("active-identity-name")).toBeTruthy();
    expect(screen.getByTestId("active-identity-description")).toBeTruthy();
    expect(screen.getByTestId("active-identity-fallback")).toBeTruthy();
    expect(screen.getByTestId("active-identity-handoff")).toBeTruthy();

    expect(screen.queryByText("Empresa e segmento")).toBeNull();
    expect(screen.queryByText("Personalidade e linguagem")).toBeNull();
    expect(screen.queryByText("Provedor")).toBeNull();
    expect(screen.queryByText("Modelo")).toBeNull();
    expect(screen.queryByText("Credencial")).toBeNull();
    expect(screen.queryByText("Conexões")).toBeNull();
    expect(screen.queryByText("Ver configuração gerada")).toBeNull();
  });

  it("agente ativo entra obrigatoriamente na tela dedicada sem fluxo estrutural", async () => {
    renderWizard(activeHook());
    await flushAsyncUpdates();

    expect(screen.getByTestId("active-agent-identity-step")).toBeTruthy();
    expect(screen.queryByText("Começar configuração")).toBeNull();
    expect(screen.queryByText("Empresa e segmento")).toBeNull();
    expect(screen.queryByText("Atendente e função")).toBeNull();
    expect(screen.queryByText("Personalidade e linguagem")).toBeNull();
    expect(screen.queryByText(/Etapa \d+ de \d+/)).toBeNull();
    expect(screen.queryByText("Voltar")).toBeNull();
  });

  it("anti-descarte: não há caminho visual para tone, segmento ou departamentos", async () => {
    renderWizard(activeHook());
    await flushAsyncUpdates();

    expect(screen.getByTestId("active-agent-identity-step")).toBeTruthy();
    expect(screen.queryByLabelText("Segmento")).toBeNull();
    expect(screen.queryByLabelText("Tom")).toBeNull();
    expect(screen.queryByText("Departamentos")).toBeNull();
    expect(screen.queryByText("Editar")).toBeNull();
  });

  it("submit ativo envia somente identidade, não chama connections nem preview e usa summary", async () => {
    const hook = activeHook();
    renderWizard(hook);
    await flushAsyncUpdates();

    const nameInput = screen
      .getByTestId("active-identity-name")
      .querySelector("input");
    fireEvent.change(nameInput, { target: { value: "Sofia Editada" } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Salvar identidade" })
      );
      await Promise.resolve();
    });

    expect(hook.update).toHaveBeenCalledTimes(1);
    expect(hook.update).toHaveBeenCalledWith({
      name: "Sofia Editada",
      description: "Identidade comercial nova",
      fallbackMessage: "Não consegui responder.",
      handoffMessage: "Vou transferir para a equipe.",
    });
    expect(hook.create).not.toHaveBeenCalled();
    expect(hook.updateConnections).not.toHaveBeenCalled();
    expect(hook.preview).not.toHaveBeenCalled();

    expect(screen.getByTestId("active-agent-identity-success")).toBeTruthy();
    expect(screen.getByText("Identidade atualizada")).toBeTruthy();
    expect(screen.getByText("O agente continua ativo.")).toBeTruthy();
    expect(screen.queryByText(/inativo/i)).toBeNull();
  });

  it("payload ativo ignora completamente profile e configuração estrutural", () => {
    const state = aiAgentProductConfigurationToWizardFormState(
      ACTIVE_CONFIGURATION,
      OPTIONS
    );
    const payload = wizardFormStateToProductIdentityPayload(state);

    expect(payload).toEqual({
      name: "Sofia Nova",
      description: "Identidade comercial nova",
      fallbackMessage: "Não consegui responder.",
      handoffMessage: "Vou transferir para a equipe.",
    });
    [
      "provider",
      "model",
      "temperature",
      "maxTokens",
      "credentialRef",
      "profile",
      "connectionRefs",
      "agentId",
      "companyId",
      "enabled",
      "mode",
      "systemPrompt",
      "attendantName",
      "companyName",
    ].forEach((key) => expect(payload).not.toHaveProperty(key));
  });

  it("feedback PT/EN/ES possui chaves dedicadas e não afirma inatividade", () => {
    ["pt.js", "en.js", "es.js"].forEach((file) => {
      const source = fs.readFileSync(
        path.resolve(__dirname, `../../translate/languages/${file}`),
        "utf8"
      );
      expect(source).toMatch(/identityUpdated/);
      expect(source).toMatch(/activeIdentity/);
      expect(source).toMatch(/successTitle/);
      expect(source).toMatch(/successDescription/);
      expect(source).toMatch(/stillActive/);
    });

    const pt = fs.readFileSync(
      path.resolve(__dirname, "../../translate/languages/pt.js"),
      "utf8"
    );
    const activeBlock = pt.slice(
      pt.indexOf("activeIdentity:"),
      pt.indexOf("hints:", pt.indexOf("activeIdentity:"))
    );
    expect(activeBlock).toContain("O agente continua ativo.");
    expect(activeBlock).not.toMatch(/inativo/i);
  });
});
