import AiAgent from "../../../models/AiAgent";
import AiAgentProfile from "../../../models/AiAgentProfile";
import { buildAiAgentPromptFromProfile } from "../buildAiAgentPromptFromProfile";
import { buildAiAgentSystemPrompt } from "../buildAiAgentSystemPrompt";
import { validateAiAgentProfileInput } from "../aiAgentProfileValidation";
import {
  AI_AGENT_ASK_WHEN_MISSING_WITH_HANDOFF_PRECEDENCE,
  AI_AGENT_CONFIGURED_HANDOFF_DUTY,
  AI_AGENT_HANDOFF_ADMIN_PREVIEW_PREAMBLE,
  AI_AGENT_HANDOFF_PROTOCOL_AND_INVARIANT,
  AI_AGENT_MISSING_INFORMATION_HANDOFF_LINE,
  AI_AGENT_PROFILE_HANDOFF_PRECEDENCE_HEADER,
  OBSOLETE_ALWAYS_ON_UNCERTAINTY_HANDOFF,
  buildAiAgentAdminPromptPreview,
  ensurePlatformHandoffInvariants,
  stripObsoleteAlwaysOnHandoffInstructions
} from "../aiAgentHandoffPolicy";
import {
  AI_AGENT_HANDOFF_MARKER,
  AI_AGENT_HANDOFF_MARKER_IDS,
  parseAiAgentHandoffSignal,
  stripKnownAiAgentHandoffMarkers,
  containsKnownAiAgentHandoffMarker
} from "../parseAiAgentHandoffSignal";
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
    expect(generated).toContain(AI_AGENT_MISSING_INFORMATION_HANDOFF_LINE);
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
    expect(preview).toContain("pedir explicitamente");
    expect(preview).toContain("situação que você marcou");
    expect(preview).toContain("somente as que você marcar");
    expect(preview).toContain("- Reclamação");
    expect(preview).not.toContain("[HANDOFF_HUMAN]");
    expect(preview).not.toContain("[FIM_HUMANO]");
    expect(preview).not.toContain("[FIM_HUMAN]");
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

describe("H5-C — execução mandatória das regras configuradas", () => {
  it("A — complaint ON: identificou → handoff nesta resposta, sem investigar", () => {
    const { generated, system } = buildPrompts(["complaint"]);
    expect(generated).toContain(AI_AGENT_CONFIGURED_HANDOFF_DUTY);
    expect(generated).toContain("- Reclamação");
    expect(generated).not.toContain(
      "Solicite handoff para outro atendente da equipe quando ocorrer"
    );
    expect(system).toContain(AI_AGENT_CONFIGURED_HANDOFF_DUTY);
    expect(system).toContain("NESTA mesma resposta");
    expect(system).toContain("Não investigue, não peça mais detalhes");
    expect(system).toContain(AI_AGENT_ASK_WHEN_MISSING_WITH_HANDOFF_PRECEDENCE);
    expect(system).toContain(AI_AGENT_PROFILE_HANDOFF_PRECEDENCE_HEADER);
    const dutyIndex = system.indexOf(AI_AGENT_CONFIGURED_HANDOFF_DUTY);
    const complaintIndex = system.indexOf("- Reclamação");
    expect(dutyIndex).toBeGreaterThan(-1);
    expect(complaintIndex).toBeGreaterThan(dutyIndex);
  });

  it("B — complaint OFF: não é condição ativa nem obrigação isolada", () => {
    const { generated, system } = buildPrompts([]);
    expect(generated).not.toContain("- Reclamação");
    expect(generated).not.toContain(AI_AGENT_CONFIGURED_HANDOFF_DUTY);
    expect(system.toLowerCase()).not.toContain("reclamação");
    expect(system).toContain(
      "Outras situações de encaminhamento seguem somente a configuração do agente"
    );
    expect(system).toContain(
      "o cliente pedir explicitamente falar com outro atendente da equipe"
    );
  });

  it("C — ask-for-more-information não anula condição configurada já identificada", () => {
    const { system, generated } = buildPrompts(["complaint"]);
    expect(system).toContain(AI_AGENT_ASK_WHEN_MISSING_WITH_HANDOFF_PRECEDENCE);
    expect(system).toContain("prevalecem sobre pedir mais informações");
    expect(system).toContain(
      "NÃO atrasam o encaminhamento depois que uma condição marcada já foi identificada"
    );
    expect(generated).toContain(AI_AGENT_ASK_WHEN_MISSING_WITH_HANDOFF_PRECEDENCE);
    expect(system).not.toMatch(
      /Quando faltar informação, faça uma pergunta objetiva\.(?!\s—)/
    );
    const askIndex = system.indexOf(AI_AGENT_ASK_WHEN_MISSING_WITH_HANDOFF_PRECEDENCE);
    const dutyIndex = system.indexOf(AI_AGENT_CONFIGURED_HANDOFF_DUTY);
    expect(askIndex).toBeGreaterThan(-1);
    expect(dutyIndex).toBeGreaterThan(askIndex);
  });

  it("D — pedido explícito do cliente continua invariante e same-turn", () => {
    const empty = buildPrompts([]);
    const withComplaint = buildPrompts(["complaint"]);
    [empty.system, withComplaint.system].forEach(system => {
      expect(system).toContain(
        "o cliente pedir explicitamente falar com outro atendente da equipe"
      );
      expect(system).toContain("Solicite handoff obrigatoriamente nesta mesma resposta quando");
      expect(system).toContain(AI_AGENT_HANDOFF_PROTOCOL_AND_INVARIANT);
    });
    expect(empty.validated.handoffRules).toContain("customer_requests_human");
    expect(withComplaint.validated.handoffRules).toContain("customer_requests_human");
    expect(empty.generated).not.toContain("Cliente pede outro atendente da equipe");
  });

  it("E — missing_information ON/OFF sem enfraquecer outra condição identificada", () => {
    const off = buildPrompts(["complaint"]);
    expect(off.generated).not.toContain(AI_AGENT_MISSING_INFORMATION_HANDOFF_LINE);
    expect(off.generated).toContain("- Reclamação");
    expect(off.generated).toContain(AI_AGENT_CONFIGURED_HANDOFF_DUTY);

    const on = buildPrompts(["missing_information"]);
    expect(on.generated).toContain(AI_AGENT_MISSING_INFORMATION_HANDOFF_LINE);
    expect(on.generated).toContain(
      "somente se nenhuma outra condição marcada já tiver sido identificada"
    );
    expect(on.generated).not.toContain("- Reclamação");

    const both = buildPrompts(["complaint", "missing_information"]);
    expect(both.generated).toContain("- Reclamação");
    expect(both.generated).toContain(AI_AGENT_MISSING_INFORMATION_HANDOFF_LINE);
    expect(both.generated).toContain(AI_AGENT_CONFIGURED_HANDOFF_DUTY);
    expect(both.system).toContain(
      "NÃO atrasam o encaminhamento depois que uma condição marcada já foi identificada"
    );
    const complaintIdx = both.generated.indexOf("- Reclamação");
    const missingIdx = both.generated.indexOf(AI_AGENT_MISSING_INFORMATION_HANDOFF_LINE);
    expect(complaintIdx).toBeGreaterThan(-1);
    expect(missingIdx).toBeGreaterThan(complaintIdx);
  });

  it("F — advanced/legacy não recebem lista ampla always-on", () => {
    const advanced = buildAiAgentSystemPrompt(
      agent({ systemPrompt: "Instruções manuais do administrador." }),
      profile({ setupMode: "advanced" })
    );
    const legacy = buildAiAgentSystemPrompt(
      agent({ systemPrompt: "Prompt legado do administrador." }),
      profile({ setupMode: "legacy", generatedPrompt: null })
    );
    [advanced, legacy].forEach(system => {
      expect(system).toContain(AI_AGENT_HANDOFF_PROTOCOL_AND_INVARIANT);
      expect(system).toContain(AI_AGENT_ASK_WHEN_MISSING_WITH_HANDOFF_PRECEDENCE);
      expect(system).not.toContain(AI_AGENT_CONFIGURED_HANDOFF_DUTY);
      expect(system.toLowerCase()).not.toContain("reclamação");
      expect(system.toLowerCase()).not.toContain("cancelamento");
      expect(system).not.toContain("você não souber responder com segurança");
      expect(system).not.toMatch(/a conversa envolver cancelamento, reclamação/);
    });
  });

  it("G — H3: parser/strip/contains e aliases intactos", () => {
    expect(AI_AGENT_HANDOFF_MARKER).toBe("[HANDOFF_HUMAN]");
    expect(AI_AGENT_HANDOFF_MARKER_IDS).toEqual([
      "HANDOFF_HUMAN",
      "FIM_HUMANO",
      "FIM_HUMAN"
    ]);
    expect(AI_AGENT_HANDOFF_PROTOCOL_AND_INVARIANT).toContain("[HANDOFF_HUMAN]");
    expect(AI_AGENT_HANDOFF_PROTOCOL_AND_INVARIANT).not.toContain("[FIM_HUMAN]");

    const canonical = parseAiAgentHandoffSignal(
      "Vou encaminhar.\n[HANDOFF_HUMAN]"
    );
    expect(canonical.handoffRequested).toBe(true);
    expect(canonical.cleanText).toBe("Vou encaminhar.");
    expect(canonical.cleanText).not.toContain("[HANDOFF_HUMAN]");

    const aliasHumano = parseAiAgentHandoffSignal("Ok.\n[FIM_HUMANO]");
    expect(aliasHumano.handoffRequested).toBe(true);
    expect(aliasHumano.cleanText).toBe("Ok.");

    const aliasHuman = parseAiAgentHandoffSignal("Ok.\n[FIM_HUMAN]");
    expect(aliasHuman.handoffRequested).toBe(true);
    expect(aliasHuman.cleanText).toBe("Ok.");

    expect(stripKnownAiAgentHandoffMarkers("Olá [FIM_HUMAN]")).toBe("Olá");
    expect(containsKnownAiAgentHandoffMarker("[HANDOFF_HUMAN]")).toBe(true);
    expect(containsKnownAiAgentHandoffMarker("atendente humano")).toBe(false);
  });

  it("H — preview comercial comunica obrigatória vs configurável, sem marker", () => {
    const { generated } = buildPrompts(["complaint"]);
    const preview = buildAiAgentAdminPromptPreview(generated);
    expect(preview).toContain(
      "Se o cliente pedir explicitamente falar com outro atendente da equipe, o atendimento é encaminhado nesta resposta."
    );
    expect(preview).toContain(
      "Se uma situação que você marcou for identificada, o atendimento também é encaminhado nesta resposta, sem investigar antes."
    );
    expect(preview).toContain("As demais situações de encaminhamento são somente as que você marcar.");
    expect(preview).toContain("- Reclamação");
    expect(preview).toContain(AI_AGENT_CONFIGURED_HANDOFF_DUTY);
    expect(preview).not.toContain("[HANDOFF_HUMAN]");
    expect(preview).not.toContain("[FIM_HUMANO]");
    expect(preview).not.toContain("[FIM_HUMAN]");
  });
});
