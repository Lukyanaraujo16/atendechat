import { createHash } from "crypto";
import { GoalType } from "../../../config/automationCognitivePlanningConstants";

export type DetectedIntent = {
  intent: string;
  goalType: GoalType;
  confidence: number;
  signals: string[];
};

const RULES: Array<{
  goalType: GoalType;
  intent: string;
  patterns: RegExp[];
  weight: number;
}> = [
  {
    goalType: "TRANSFER_TICKET",
    intent: "transfer_to_human",
    patterns: [
      /\b(transfer|transfira|atendente|humano|falar com)\b/i,
      /\b(handoff|escalat)/i
    ],
    weight: 1
  },
  {
    goalType: "UPDATE_CONTACT",
    intent: "update_contact",
    patterns: [
      /\b(atualiz|alterar|corrigir).{0,40}(contato|nome|email|telefone|cpf)\b/i,
      /\b(meu nome é|meu email|meu telefone)\b/i
    ],
    weight: 0.95
  },
  {
    goalType: "SCHEDULE_EVENT",
    intent: "schedule",
    patterns: [
      /\b(agend|marcar|remarcar|reagendar)\b/i,
      /\b(horário|horario|reuni[aã]o|consulta)\b/i
    ],
    weight: 0.9
  },
  {
    goalType: "SEND_MESSAGE",
    intent: "send_message",
    patterns: [
      /\b(envie|enviar|mande|mandar).{0,30}(mensagem|msg|whatsapp)\b/i
    ],
    weight: 0.85
  },
  {
    goalType: "EXECUTE_AUTOMATION",
    intent: "run_automation",
    patterns: [
      /\b(automat|fluxo|flow|workflow|execut[ae].{0,20}automa)/i
    ],
    weight: 0.85
  },
  {
    goalType: "SEARCH_INFORMATION",
    intent: "search",
    patterns: [
      /\b(busc[ae]|pesquis|encontre|onde fica|qual é|consultar)\b/i,
      /\b(status|pedido|protocolo|rastreio)\b/i
    ],
    weight: 0.8
  },
  {
    goalType: "ANSWER_QUESTION",
    intent: "answer",
    patterns: [
      /\b(o que|como|por que|porque|quando|quanto|explica|me diga)\b/i,
      /\?/
    ],
    weight: 0.7
  }
];

/**
 * Intent Detection — determinístico, sem LLM / Tools.
 */
export function detectIntent(text: string): DetectedIntent {
  const raw = (text || "").trim();
  if (!raw) {
    return {
      intent: "unknown",
      goalType: "CUSTOM",
      confidence: 0,
      signals: ["empty_input"]
    };
  }

  let best: DetectedIntent | null = null;
  for (const rule of RULES) {
    const hits = rule.patterns.filter(p => p.test(raw));
    if (!hits.length) continue;
    const confidence = Math.min(
      0.99,
      rule.weight * (0.55 + hits.length * 0.2)
    );
    const candidate: DetectedIntent = {
      intent: rule.intent,
      goalType: rule.goalType,
      confidence,
      signals: hits.map(h => h.source)
    };
    if (!best || candidate.confidence > best.confidence) best = candidate;
  }

  if (!best) {
    const multi =
      /\be\s+(depois|também|tambem)\b/i.test(raw) ||
      raw.split(/[.!;]/).filter(Boolean).length >= 2;
    return {
      intent: multi ? "multi_step" : "custom",
      goalType: multi ? "MULTI_STEP_TASK" : "CUSTOM",
      confidence: 0.4,
      signals: multi ? ["multi_clause"] : ["fallback_custom"]
    };
  }

  if (
    /\be\s+(depois|também|tambem|em seguida)\b/i.test(raw) &&
    best.goalType !== "MULTI_STEP_TASK"
  ) {
    return {
      intent: "multi_step",
      goalType: "MULTI_STEP_TASK",
      confidence: Math.max(best.confidence, 0.75),
      signals: [...best.signals, "multi_step_hint"]
    };
  }

  return best;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text || "").digest("hex").slice(0, 16);
}

export default { detectIntent };
