/**
 * Vocabulário e mensagem de transição de handoff (Fase 2.16).
 * Proíbe "humano"/"IA" em diferenciação do próximo atendente.
 */

import { stripKnownAiAgentHandoffMarkers } from "./parseAiAgentHandoffSignal";

export type AiAgentHandoffReasonKind =
  | "low_confidence"
  | "out_of_scope"
  | "client_request"
  | "technical_error"
  | "knowledge_missing"
  | "model_requested_handoff"
  | "live_ticket_limit_reached_handoff"
  | "live_consecutive_failures_handoff"
  | "generic";

const FORBIDDEN_CLIENT_PATTERNS: RegExp[] = [
  /\batendente\s+humano\b/gi,
  /\boperador\s+humano\b/gi,
  /\bpessoa\s+(?:real|de\s+verdade)\b/gi,
  /\batendimento\s+humano\b/gi,
  /\bhumano\b/gi,
  /\bsair\s+da\s+IA\b/gi,
  /\bintelig[eê]ncia\s+artificial\b/gi,
  /\bassist[eê]nte\s+de\s+IA\b/gi,
  /\brob[oô]\b/gi,
  /\bbot\b/gi
];

type ToneKey = "formal" | "professional" | "friendly" | "casual" | "custom";

const MESSAGES: Record<
  ToneKey,
  Record<
    | "default"
    | "low_confidence"
    | "out_of_scope"
    | "client_request"
    | "technical_error",
    string
  >
> = {
  formal: {
    default:
      "Para assegurar a continuidade adequada, encaminharei seu atendimento a outro atendente da nossa equipe.",
    low_confidence:
      "Para assegurar a orientação correta, encaminharei seu atendimento a outro atendente da nossa equipe.",
    out_of_scope:
      "Esse assunto precisa ser verificado por outro atendente da equipe. Encaminharei seu atendimento.",
    client_request:
      "Encaminharei seu atendimento a outro atendente da nossa equipe.",
    technical_error:
      "Encaminharei seu atendimento a outro atendente da nossa equipe, que poderá dar continuidade."
  },
  professional: {
    default:
      "Vou encaminhar sua solicitação para outro atendente da equipe, que dará continuidade ao atendimento.",
    low_confidence:
      "Para garantir que você receba a orientação correta, vou encaminhar seu atendimento para outro atendente da nossa equipe.",
    out_of_scope:
      "Esse assunto precisa ser verificado por outro atendente da equipe. Vou encaminhar seu atendimento.",
    client_request:
      "Claro. Vou encaminhar seu atendimento para outro atendente da nossa equipe.",
    technical_error:
      "Vou encaminhar seu atendimento para outro atendente da nossa equipe, que poderá dar continuidade."
  },
  friendly: {
    default:
      "Para te ajudar melhor, vou encaminhar seu atendimento para outro atendente da nossa equipe, tudo bem?",
    low_confidence:
      "Para garantir que você receba a orientação correta, vou encaminhar seu atendimento para outro atendente da nossa equipe, tudo bem?",
    out_of_scope:
      "Esse assunto precisa ser verificado por outro atendente da equipe. Vou encaminhar seu atendimento, tudo bem?",
    client_request:
      "Claro! Vou encaminhar seu atendimento para outro atendente da nossa equipe.",
    technical_error:
      "Vou encaminhar seu atendimento para outro atendente da nossa equipe, que poderá continuar com você, tudo bem?"
  },
  casual: {
    default:
      "Vou passar seu atendimento para outro atendente da equipe, que continua com você por aqui.",
    low_confidence:
      "Pra garantir a orientação certa, vou passar seu atendimento pra outro atendente da equipe.",
    out_of_scope:
      "Esse assunto precisa de outro atendente da equipe. Vou passar seu atendimento pra eles.",
    client_request:
      "Beleza! Vou passar seu atendimento pra outro atendente da equipe.",
    technical_error:
      "Vou passar seu atendimento pra outro atendente da equipe, que segue com você."
  },
  custom: {
    default:
      "Vou encaminhar seu atendimento para outro atendente da nossa equipe. Só um momento.",
    low_confidence:
      "Para garantir que você receba a orientação correta, vou encaminhar seu atendimento para outro atendente da nossa equipe.",
    out_of_scope:
      "Esse assunto precisa ser verificado por outro atendente da equipe. Vou encaminhar seu atendimento.",
    client_request:
      "Claro. Vou encaminhar seu atendimento para outro atendente da nossa equipe.",
    technical_error:
      "Vou encaminhar seu atendimento para outro atendente da nossa equipe, que poderá dar continuidade."
  }
};

function resolveTone(tone: string | null | undefined): ToneKey {
  const t = String(tone || "professional").toLowerCase();
  if (t === "formal" || t === "friendly" || t === "casual" || t === "custom") {
    return t;
  }
  return "professional";
}

function resolveMessageKey(
  kind: AiAgentHandoffReasonKind
):
  | "default"
  | "low_confidence"
  | "out_of_scope"
  | "client_request"
  | "technical_error" {
  if (kind === "low_confidence") return "low_confidence";
  if (kind === "out_of_scope") return "out_of_scope";
  if (kind === "client_request") return "client_request";
  if (
    kind === "technical_error" ||
    kind === "live_ticket_limit_reached_handoff" ||
    kind === "live_consecutive_failures_handoff"
  ) {
    return "technical_error";
  }
  return "default";
}

export function mapHandoffReasonToKind(
  reason: string | null | undefined
): AiAgentHandoffReasonKind {
  const r = String(reason || "").toLowerCase();
  if (!r) return "generic";
  if (r.includes("knowledge")) return "knowledge_missing";
  if (r.includes("client") || r.includes("explicit") || r.includes("request")) {
    return "client_request";
  }
  if (
    r.includes("low_confidence") ||
    r.includes("confidence") ||
    r.includes("uncertain")
  ) {
    return "low_confidence";
  }
  if (r.includes("scope") || r.includes("out_of")) return "out_of_scope";
  if (r.includes("live_ticket_limit"))
    return "live_ticket_limit_reached_handoff";
  if (r.includes("live_consecutive"))
    return "live_consecutive_failures_handoff";
  if (
    r.includes("fail") ||
    r.includes("error") ||
    r.includes("technical") ||
    r.includes("limit")
  ) {
    return "technical_error";
  }
  if (r.includes("model_requested")) return "model_requested_handoff";
  return "generic";
}

export function sanitizeAiAgentClientFacingText(
  text: string | null | undefined
): string {
  let out = stripKnownAiAgentHandoffMarkers(text);
  out = out.replace(/\batendente\s+humano\b/gi, "outro atendente");
  out = out.replace(/\boperador\s+humano\b/gi, "atendente da equipe");
  out = out.replace(
    /\bpessoa\s+(?:real|de\s+verdade)\b/gi,
    "atendente da equipe"
  );
  out = out.replace(/\batendimento\s+humano\b/gi, "outro atendente da equipe");
  out = out.replace(/\bhumano\b/gi, "atendente");
  out = out.replace(/\bsair\s+da\s+IA\b/gi, "continuar com a equipe");
  out = out.replace(/\bintelig[eê]ncia\s+artificial\b/gi, "assistente virtual");
  out = out.replace(/\bassist[eê]nte\s+de\s+IA\b/gi, "assistente virtual");
  out = out.replace(/\brob[oô]\b/gi, "assistente");
  out = out.replace(/\bbot\b/gi, "assistente");
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function containsForbiddenHandoffVocabulary(
  text: string | null | undefined
): boolean {
  const raw = String(text ?? "");
  return FORBIDDEN_CLIENT_PATTERNS.some(re => {
    re.lastIndex = 0;
    return re.test(raw);
  });
}

export type BuildAiAgentHandoffTransitionInput = {
  reason?: string | null;
  configuredHandoffMessage?: string | null;
  tone?: string | null;
  modelCleanText?: string | null;
};

export function buildAiAgentHandoffTransitionMessage(
  input: BuildAiAgentHandoffTransitionInput
): string {
  const configured = sanitizeAiAgentClientFacingText(
    input.configuredHandoffMessage
  );
  if (configured) {
    return configured;
  }

  const modelText = sanitizeAiAgentClientFacingText(input.modelCleanText);
  if (
    modelText &&
    modelText.length >= 12 &&
    !containsForbiddenHandoffVocabulary(modelText)
  ) {
    return modelText;
  }

  const kind = mapHandoffReasonToKind(input.reason);
  const tone = resolveTone(input.tone);
  const key = resolveMessageKey(kind);
  return sanitizeAiAgentClientFacingText(MESSAGES[tone][key]);
}
