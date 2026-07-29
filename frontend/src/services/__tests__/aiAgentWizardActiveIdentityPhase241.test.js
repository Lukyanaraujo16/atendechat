import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  filterAiAgentWizardCredentialsByProvider,
  filterAiAgentWizardModelsByProvider,
  mapAiAgentWizardProductOptions,
  validateAiAgentWizardCommercialSetup,
  wizardFormStateToProductConfigurationPayload,
  wizardFormStateToProductIdentityPayload,
} from "../../components/AiAgentWizard/aiAgentWizardProductMapper";
import { createDefaultWizardFormState } from "../../components/AiAgentWizard/aiAgentWizardDefaults";
import ReviewStep from "../../components/AiAgentWizard/steps/ReviewStep";
import AiAgentWizardNavigation from "../../components/AiAgentWizard/AiAgentWizardNavigation";
import {
  putAiAgentProductConfiguration,
  putAiAgentProductConnections,
  postAiAgentProductConfiguration,
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

jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: (key) => key,
  },
}));

const OPTIONS = mapAiAgentWizardProductOptions({
  providers: [
    { value: "openai", label: "OpenAI", available: true },
    { value: "gemini", label: "Google Gemini", available: true },
  ],
  models: [
    { value: "gpt-4o-mini", label: "gpt-4o-mini", provider: "openai" },
    { value: "gemini-2.5-flash", label: "gemini-2.5-flash", provider: "gemini" },
  ],
  credentials: [
    {
      ref: "cred_openai",
      name: "OpenAI Prod",
      provider: "openai",
      maskedKey: "sk-...123",
      enabled: true,
      isDefault: true,
    },
    {
      ref: "cred_gemini",
      name: "Gemini Prod",
      provider: "gemini",
      maskedKey: "AIza...xyz",
      enabled: true,
      isDefault: false,
    },
  ],
  connections: [
    {
      ref: "wa_1",
      name: "WhatsApp",
      status: "CONNECTED",
      selected: false,
      eligible: true,
      ineligibleReason: null,
    },
  ],
});

function completeForm(overrides = {}) {
  return {
    ...createDefaultWizardFormState(),
    attendantName: "Sofia",
    companyName: "Acme",
    identityName: "Sofia",
    identityDescription: "Atendente virtual — Acme",
    businessSegment: "ecommerce",
    departments: ["sales"],
    provider: "openai",
    model: "gpt-4o-mini",
    credentialRef: "cred_openai",
    connectionRefs: ["wa_1"],
    fallbackMessage: "Desculpe, não consegui responder.",
    handoffMessage: "Vou transferir para um humano.",
    ...overrides,
  };
}

describe("Hardening 2.4.1 — identidade ativa e setup obrigatório", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("agente ativo — UI estrutural bloqueada", () => {
    it("desabilita provider, model, credential e connections e mantém salvar identidade habilitado", () => {
      const { container } = render(
        <ReviewStep
          formState={completeForm()}
          onChange={jest.fn()}
          onEditStep={jest.fn()}
          onPreviewPrompt={jest.fn()}
          options={OPTIONS}
          editableWhileActive={false}
          previewAvailable
          commercialError=""
        />
      );

      const disabledInputs = container.querySelectorAll(
        ".MuiSelect-root.Mui-disabled, .MuiInputBase-root.Mui-disabled"
      );
      expect(disabledInputs.length).toBeGreaterThanOrEqual(4);

      render(
        <AiAgentWizardNavigation
          continueLabel="aiAgent.wizard.buttons.saveIdentity"
          onContinue={jest.fn()}
          continueDisabled={false}
        />
      );
      expect(
        screen.getByRole("button", {
          name: "aiAgent.wizard.buttons.saveIdentity",
        })
      ).toHaveProperty("disabled", false);
    });
  });

  describe("payload identity-only", () => {
    it("envia somente allowlist de identidade", () => {
      const payload = wizardFormStateToProductIdentityPayload(completeForm());
      expect(Object.keys(payload).sort()).toEqual(
        ["description", "fallbackMessage", "handoffMessage", "name"].sort()
      );
      expect(payload).toEqual({
        name: "Sofia",
        description: "Atendente virtual — Acme",
        fallbackMessage: "Desculpe, não consegui responder.",
        handoffMessage: "Vou transferir para um humano.",
      });
      expect(payload).not.toHaveProperty("provider");
      expect(payload).not.toHaveProperty("model");
      expect(payload).not.toHaveProperty("credentialRef");
      expect(payload).not.toHaveProperty("companyName");
      expect(payload).not.toHaveProperty("tone");
      expect(payload).not.toHaveProperty("connectionRefs");
    });

    it("PUT configuration com identity e não chama PUT connections", async () => {
      api.put.mockResolvedValue({
        data: {
          changed: true,
          configuration: { identity: { name: "Sofia" } },
          summary: { status: "active", mode: "live" },
        },
      });

      const identity = wizardFormStateToProductIdentityPayload(completeForm());
      const result = await putAiAgentProductConfiguration(identity);

      expect(api.put).toHaveBeenCalledWith(
        "/product/ai-agent/configuration",
        identity
      );
      expect(api.put).not.toHaveBeenCalledWith(
        "/product/ai-agent/configuration/connections",
        expect.anything()
      );
      expect(result.summary.status).toBe("active");
    });

    it("trata changed:false como sucesso idempotente do payload", async () => {
      api.put.mockResolvedValue({
        data: {
          changed: false,
          configuration: { identity: { name: "Sofia" } },
          summary: { status: "active" },
        },
      });
      const result = await putAiAgentProductConfiguration(
        wizardFormStateToProductIdentityPayload(completeForm())
      );
      expect(result.changed).toBe(false);
      expect(result.summary.status).toBe("active");
    });

    it("propaga erro de corrida UPDATE_NOT_ALLOWED do backend", async () => {
      api.put.mockRejectedValue({
        response: {
          data: { error: "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE" },
        },
      });
      await expect(
        putAiAgentProductConfiguration(
          wizardFormStateToProductIdentityPayload(completeForm())
        )
      ).rejects.toMatchObject({
        response: {
          data: {
            error: "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE",
          },
        },
      });
    });
  });

  describe("criação — campos essenciais", () => {
    it("sem provider → não chama POST", async () => {
      const error = validateAiAgentWizardCommercialSetup(
        completeForm({ provider: "", model: "", credentialRef: "" }),
        OPTIONS
      );
      expect(error).toEqual({
        errorKey: "providerRequired",
        field: "provider",
      });
      expect(api.post).not.toHaveBeenCalled();
    });

    it("sem model → não chama POST", () => {
      const error = validateAiAgentWizardCommercialSetup(
        completeForm({ model: "" }),
        OPTIONS
      );
      expect(error).toEqual({ errorKey: "modelRequired", field: "model" });
    });

    it("sem credentialRef → não chama POST", () => {
      const error = validateAiAgentWizardCommercialSetup(
        completeForm({ credentialRef: "" }),
        OPTIONS
      );
      expect(error).toEqual({
        errorKey: "credentialRequired",
        field: "credential",
      });
    });

    it("OpenAI completo → chama POST", async () => {
      api.post.mockResolvedValue({
        data: {
          created: true,
          summary: { status: "setup_incomplete" },
        },
      });
      const payload = wizardFormStateToProductConfigurationPayload(
        completeForm({ provider: "openai", model: "gpt-4o-mini", credentialRef: "cred_openai" }),
        { forCreate: true, includeConnections: true }
      );
      expect(validateAiAgentWizardCommercialSetup(completeForm(), OPTIONS)).toBeNull();
      await postAiAgentProductConfiguration(payload);
      expect(api.post).toHaveBeenCalledWith(
        "/product/ai-agent/configuration",
        expect.objectContaining({
          provider: "openai",
          model: "gpt-4o-mini",
          credentialRef: "cred_openai",
        })
      );
    });

    it("Gemini completo → chama POST", async () => {
      api.post.mockResolvedValue({
        data: { created: true, summary: { status: "setup_incomplete" } },
      });
      const form = completeForm({
        provider: "gemini",
        model: "gemini-2.5-flash",
        credentialRef: "cred_gemini",
      });
      expect(validateAiAgentWizardCommercialSetup(form, OPTIONS)).toBeNull();
      await postAiAgentProductConfiguration(
        wizardFormStateToProductConfigurationPayload(form, {
          forCreate: true,
          includeConnections: true,
        })
      );
      expect(api.post).toHaveBeenCalledWith(
        "/product/ai-agent/configuration",
        expect.objectContaining({
          provider: "gemini",
          model: "gemini-2.5-flash",
          credentialRef: "cred_gemini",
        })
      );
    });

    it("modelo incompatível → bloqueado", () => {
      expect(
        validateAiAgentWizardCommercialSetup(
          completeForm({ provider: "openai", model: "gemini-2.5-flash" }),
          OPTIONS
        )
      ).toEqual({ errorKey: "modelIncompatible", field: "model" });
    });

    it("credencial incompatível → bloqueada", () => {
      expect(
        validateAiAgentWizardCommercialSetup(
          completeForm({
            provider: "openai",
            model: "gpt-4o-mini",
            credentialRef: "cred_gemini",
          }),
          OPTIONS
        )
      ).toEqual({ errorKey: "credentialRequired", field: "credential" });
    });

    it("troca de provider limpa model e credential", () => {
      const onChange = jest.fn();
      const { getByTestId } = render(
        <ReviewStep
          formState={completeForm()}
          onChange={onChange}
          onEditStep={jest.fn()}
          onPreviewPrompt={jest.fn()}
          options={OPTIONS}
          editableWhileActive
          previewAvailable
          commercialError=""
        />
      );

      const providerInput = getByTestId("wizard-provider-select").querySelector(
        "[role='button']"
      ) || getByTestId("wizard-provider-select");
      fireEvent.mouseDown(providerInput);
      fireEvent.click(screen.getByText("Google Gemini"));
      expect(onChange).toHaveBeenCalledWith({
        provider: "gemini",
        model: "",
        credentialRef: "",
      });
    });

    it("nenhuma credencial é escolhida automaticamente na hidratação parcial", () => {
      const form = createDefaultWizardFormState();
      expect(form.credentialRef).toBe("");
      expect(form.provider).toBe("");
      expect(form.model).toBe("");
      const openaiCreds = filterAiAgentWizardCredentialsByProvider(
        OPTIONS.credentials,
        "openai"
      );
      expect(openaiCreds.some((item) => item.isDefault)).toBe(true);
      expect(form.credentialRef).not.toBe(openaiCreds[0].ref);
    });
  });

  describe("edição Off — consistência estrutural", () => {
    it("troca de provider exige novo model e credential", () => {
      const afterProviderChange = completeForm({
        provider: "gemini",
        model: "",
        credentialRef: "",
      });
      expect(
        validateAiAgentWizardCommercialSetup(afterProviderChange, OPTIONS)
      ).toEqual({ errorKey: "modelRequired", field: "model" });

      const withModelOnly = {
        ...afterProviderChange,
        model: "gemini-2.5-flash",
      };
      expect(
        validateAiAgentWizardCommercialSetup(withModelOnly, OPTIONS)
      ).toEqual({ errorKey: "credentialRequired", field: "credential" });
    });

    it("configuração válida permite PUT", async () => {
      api.put.mockResolvedValue({
        data: {
          changed: true,
          summary: { status: "ready_to_activate" },
        },
      });
      const form = completeForm({
        provider: "gemini",
        model: "gemini-2.5-flash",
        credentialRef: "cred_gemini",
      });
      expect(validateAiAgentWizardCommercialSetup(form, OPTIONS)).toBeNull();
      await putAiAgentProductConfiguration(
        wizardFormStateToProductConfigurationPayload(form)
      );
      expect(api.put).toHaveBeenCalledWith(
        "/product/ai-agent/configuration",
        expect.objectContaining({
          provider: "gemini",
          model: "gemini-2.5-flash",
          credentialRef: "cred_gemini",
        })
      );
    });

    it("backend continua autoridade final via PUT connections separado", async () => {
      api.put.mockResolvedValue({
        data: { changed: true, summary: { status: "setup_incomplete" } },
      });
      await putAiAgentProductConnections({ connectionRefs: ["wa_1"] });
      expect(api.put).toHaveBeenCalledWith(
        "/product/ai-agent/configuration/connections",
        { connectionRefs: ["wa_1"] }
      );
    });
  });

  describe("filtros comerciais", () => {
    it("filtra modelos por provider sem allowlist local inventada", () => {
      expect(
        filterAiAgentWizardModelsByProvider(OPTIONS.models, "openai").map(
          (item) => item.value
        )
      ).toEqual(["gpt-4o-mini"]);
      expect(
        filterAiAgentWizardModelsByProvider(OPTIONS.models, "gemini").map(
          (item) => item.value
        )
      ).toEqual(["gemini-2.5-flash"]);
    });
  });
});
