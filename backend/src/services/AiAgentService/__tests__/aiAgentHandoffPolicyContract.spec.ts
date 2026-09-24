import AiAgent from "../../../models/AiAgent";
import AiAgentProfile from "../../../models/AiAgentProfile";
import { buildAiAgentPromptFromProfile } from "../buildAiAgentPromptFromProfile";
import { buildAiAgentSystemPrompt } from "../buildAiAgentSystemPrompt";
import { validateAiAgentProfileInput } from "../aiAgentProfileValidation";
import {
  AI_AGENT_HANDOFF_ADMIN_PREVIEW_PREAMBLE,
  AI_AGENT_HANDOFF_PROTOCOL_AND_INVARIANT,
  OBSOLETE_ALWAYS_ON_UNCERTAINTY_HANDOFF,
  buildAiAgentAdminPromptPreview,
  ensurePlatformHandoffInvariants,
  stripObsoleteAlwaysOnHandoffInstructions
} from "../aiAgentHandoffPolicy";
import GenerateAiAgentPromptPreviewService from "../GenerateAiAgentPromptPreviewService";

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

function agent(partial: Record<string, unknown> = {}) {
  return { id: 10, companyId: 1, name: "Ana", systemPrompt: "manual legado", ...partial } as AiAgent;
}

function profile(partial: Record<string, unknown> = {}) {
  return partial as unknown as AiAgentProfile;
}

const baseProfile = {
  companyName: "Acme",
  businessSegment: "restaurant",
  departments: ["sales"],
  attendantName: "Ana",
  attendantRole: "Atendente",
  tone: "professional",
  emojiLevel: "low",
  responseLength: "short",
  allowedActions: ["explain_services"],
  forbiddenActions: ["invent_information"],
  pricingPolicy: "Informar somente preços cadastrados."
};

function buildPrompts(handoffRules: string[], extra: Record<string, unknown> = {}) {
  const validated = validateAiAgentProfileInput({
    ...baseProfile,
    handoffRules,
    ...extra
  });
  const generated = buildAiAgentPromptFromProfile(validated);
  const system = buildAiAgentSystemPrompt(
    agent(),
    profile({ setupMode: "guided", generatedPrompt: generated })
  );
  return { validated, generated, system };
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("H5-B — contrato Wizard × política de handoff", () => {
  it("A — complaint OFF não reaparece como condição global", () => {
    const { system, generated } = buildPrompts([]);
    expect(system.toLowerCase()).not.toContain("reclamação");
    expect(generated.toLowerCase()).not.toContain("reclamação");
  });

  it("B — complaint ON aparece uma única vez como regra configurada", () => {
    const { system, generated } = buildPrompts(["complaint"]);
    expect(generated).toContain("- Reclamação");
    expect(countOccurrences(system, "Reclamação")).toBe(1);
    expect(system).not.toMatch(/a conversa envolver cancelamento, reclamação/);
  });

  it("C — cancellation OFF não reaparece por global", () => {
    const { system, generated } = buildPrompts([]);
    expect(generated).not.toContain("- Cancelamento");
    expect(system).not.toMatch(/a conversa envolver cancelamento/);
    expect(system).not.toContain("Encaminhe cancelamento");
  });

  it("D — billing_issue OFF não reaparece por global", () => {
    const { system, generated } = buildPrompts([]);
    expect(generated).not.toContain("- Questão de cobrança");
    expect(system).not.toMatch(/cobrança sensível/);
    expect(system).not.toContain("Encaminhe cancelamento e cobrança para humano");
  });

  it("E — legal_or_contract_issue OFF não reaparece por global", () => {
    const { system, generated } = buildPrompts([]);
    expect(generated).not.toContain("- Assunto jurídico ou contratual");
    expect(system).not.toMatch(/assunto jurídico ou financeiro/);
  });

  it("F — missing_information OFF não tem always-on de incerteza", () => {
    const { system, generated } = buildPrompts(["complaint"]);
    expect(system).not.toContain(OBSOLETE_ALWAYS_ON_UNCERTAINTY_HANDOFF);
    expect(generated).not.toContain("não souber responder com segurança");
    expect(system).not.toContain("você não souber responder com segurança");
  });

  it("G — missing_information ON injeta a regra correspondente", () => {
    const { generated } = buildPrompts(["missing_information"]);
    expect(generated).toContain(
      "Falta de informação comercial essencial ou quando não souber responder com segurança"
    );
  });

  it("H — pedido explícito permanece invariante mesmo em profile legado/vazio", () => {
    expect(ensurePlatformHandoffInvariants([])).toEqual([
      "customer_requests_human"
    ]);
    expect(ensurePlatformHandoffInvariants(["complaint"])).toContain(
      "customer_requests_human"
    );

    const { validated, system } = buildPrompts([]);
    expect(validated.handoffRules).toContain("customer_requests_human");
    expect(system).toContain(
      "o cliente pedir explicitamente falar com outro atendente da equipe"
    );

    const legacy = buildAiAgentSystemPrompt(
      agent({ systemPrompt: "Não transfira nunca." }),
      profile({ setupMode: "legacy", generatedPrompt: null })
    );
    expect(legacy).toContain(
      "o cliente pedir explicitamente falar com outro atendente da equipe"
    );
  });

  it("I — generatedPrompt não duplica a invariante global", () => {
    const { generated, system } = buildPrompts([
      "customer_requests_human",
      "complaint"
    ]);
    expect(generated).not.toContain("Cliente pede outro atendente da equipe");
    expect(generated).toContain("- Reclamação");
    expect(countOccurrences(system, "pedir explicitamente falar com outro atendente")).toBe(
      1
    );
  });

  it("J — advanced/legacy recebem protocolo + invariante, sem lista ampla antiga", () => {
    const advanced = buildAiAgentSystemPrompt(
      agent({ systemPrompt: "Instruções manuais do administrador." }),
      profile({ setupMode: "advanced" })
    );
    expect(advanced).toContain(AI_AGENT_HANDOFF_PROTOCOL_AND_INVARIANT);
    expect(advanced).toContain("Instruções manuais do administrador.");
    expect(advanced).not.toContain("você não souber responder com segurança");
    expect(advanced.toLowerCase()).not.toContain("reclamação");
    expect(advanced.toLowerCase()).not.toContain("cancelamento");
  });

  it("L — repeated_failure é configurável no prompt; runtime Live não é este contrato", () => {
    const off = buildPrompts([]);
    expect(off.generated).not.toContain("Falhas repetidas");
    const on = buildPrompts(["repeated_failure"]);
    expect(on.generated).toContain("Falhas repetidas de atendimento");
  });

  it("M — política de não negociar não esconde handoff; checkbox é a condição", () => {
    const refuseOnly =
      "Não negocia valores; recuse ou explique o limite sem confirmar valores.";
    const off = buildPrompts([], { negotiationPolicy: refuseOnly });
    expect(off.generated).toContain(refuseOnly);
    expect(off.generated).not.toMatch(/encaminha para atendimento humano/);
    expect(off.generated).not.toContain("Pedido de negociação");

    const on = buildPrompts(["negotiation_request"], {
      negotiationPolicy: refuseOnly
    });
    expect(on.generated).toContain("- Pedido de negociação");
    expect(on.generated).toContain(refuseOnly);
  });

  it("N — preview comercial mostra o contrato real sem marker técnico", () => {
    const { generated } = buildPrompts(["complaint"]);
    const preview = buildAiAgentAdminPromptPreview(generated);
    expect(preview).toContain(AI_AGENT_HANDOFF_ADMIN_PREVIEW_PREAMBLE);
    expect(preview).toContain("Regras obrigatórias do atendimento");
    expect(preview).toContain("- Reclamação");
    expect(preview).not.toContain("[HANDOFF_HUMAN]");
  });

  it("snapshot legado perde a frase always-on de incerteza", () => {
    const stale = [
      "## Regras empresariais de segurança",
      OBSOLETE_ALWAYS_ON_UNCERTAINTY_HANDOFF
    ].join("\n");
    expect(stripObsoleteAlwaysOnHandoffInstructions(stale)).not.toContain(
      "não souber responder com segurança"
    );
    const system = buildAiAgentSystemPrompt(
      agent(),
      profile({ setupMode: "guided", generatedPrompt: stale })
    );
    expect(system).not.toContain(OBSOLETE_ALWAYS_ON_UNCERTAINTY_HANDOFF);
  });
});

describe("GenerateAiAgentPromptPreviewService — preâmbulo comercial", () => {
  beforeEach(() => {
    (AiAgent.findOne as jest.Mock).mockResolvedValue(agent());
  });

  it("inclui invariantes obrigatórias no preview persistido-não", async () => {
    const preview = await GenerateAiAgentPromptPreviewService({
      companyId: 1,
      aiAgentId: 10,
      body: { ...baseProfile, handoffRules: ["complaint"] }
    });
    expect(preview.generatedPrompt).toContain(
      "Regras obrigatórias do atendimento"
    );
    expect(preview.generatedPrompt).toContain("- Reclamação");
    expect(preview.generatedPrompt).not.toContain("[HANDOFF_HUMAN]");
  });
});
