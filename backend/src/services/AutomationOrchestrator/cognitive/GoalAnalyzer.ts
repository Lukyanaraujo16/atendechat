import { createHash } from "crypto";
import {
  GoalRiskLevel,
  GoalType
} from "../../../config/automationCognitivePlanningConstants";
import { detectIntent, hashText } from "./IntentDetection";
import { Goal, GoalEntity } from "./types";

function extractEntities(text: string): GoalEntity[] {
  const entities: GoalEntity[] = [];
  const email = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  if (email) {
    entities.push({ key: "email", value: email[0], confidence: 0.95 });
  }
  const phone = text.match(
    /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/
  );
  if (phone) {
    entities.push({
      key: "phone",
      value: phone[0].trim(),
      confidence: 0.7
    });
  }
  const protocol = text.match(
    /\b(?:protocolo|pedido|ticket)[\s#:]*([A-Za-z0-9-]{4,})\b/i
  );
  if (protocol) {
    entities.push({
      key: "protocol",
      value: protocol[1],
      confidence: 0.8
    });
  }
  const name = text.match(
    /\b(?:meu nome é|me chamo|chamo-me)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)/i
  );
  if (name) {
    entities.push({ key: "name", value: name[1], confidence: 0.75 });
  }
  return entities;
}

function riskForType(type: GoalType, text: string): GoalRiskLevel {
  if (type === "TRANSFER_TICKET" || type === "EXECUTE_AUTOMATION") {
    return "high";
  }
  if (type === "UPDATE_CONTACT" || type === "SEND_MESSAGE") {
    return "medium";
  }
  if (type === "SCHEDULE_EVENT") return "medium";
  if (/senha|cart[aã]o|cpf|pix|pagar/i.test(text)) return "critical";
  return "low";
}

function constraintsFor(type: GoalType): string[] {
  const base = ["no_tool_execution_in_planner", "read_only_planning"];
  switch (type) {
    case "TRANSFER_TICKET":
      return [...base, "requires_queue_or_user", "handoff_safe"];
    case "UPDATE_CONTACT":
      return [...base, "pii_careful", "confirm_before_write"];
    case "SEND_MESSAGE":
      return [...base, "no_spam", "confirm_outbound"];
    case "EXECUTE_AUTOMATION":
      return [...base, "automation_must_be_allowed"];
    default:
      return base;
  }
}

function outcomeFor(type: GoalType, text: string): string {
  switch (type) {
    case "ANSWER_QUESTION":
      return "Resposta clara à pergunta do usuário";
    case "SEARCH_INFORMATION":
      return "Informação encontrada e apresentada";
    case "UPDATE_CONTACT":
      return "Dados do contato atualizados (após confirmação)";
    case "TRANSFER_TICKET":
      return "Ticket transferido para atendimento humano";
    case "SEND_MESSAGE":
      return "Mensagem preparada para envio (após confirmação)";
    case "EXECUTE_AUTOMATION":
      return "Automação identificada e pronta para execução externa";
    case "SCHEDULE_EVENT":
      return "Evento/agendamento definido";
    case "MULTI_STEP_TASK":
      return "Tarefa multi-etapas planejada de ponta a ponta";
    default:
      return `Objetivo custom: ${text.slice(0, 120)}`;
  }
}

/**
 * GoalAnalyzer — NL → Goal estruturado.
 * Não chama Tools, providers ou runtime.
 */
export function analyzeGoal(input: {
  text: string;
  companyId?: number;
  ticketId?: number;
  contactId?: number;
  metadata?: Record<string, unknown>;
}): Goal {
  const text = (input.text || "").trim();
  const detected = detectIntent(text);
  const entities = extractEntities(text);
  const riskLevel = riskForType(detected.goalType, text);
  const requiresConfirmation =
    riskLevel === "high" ||
    riskLevel === "critical" ||
    detected.goalType === "UPDATE_CONTACT" ||
    detected.goalType === "SEND_MESSAGE" ||
    detected.goalType === "TRANSFER_TICKET" ||
    detected.goalType === "EXECUTE_AUTOMATION";

  const id = createHash("sha256")
    .update(
      `${input.companyId || 0}:${hashText(text)}:${detected.goalType}:${Date.now()}`
    )
    .digest("hex")
    .slice(0, 20);

  return {
    id: `goal_${id}`,
    type: detected.goalType,
    objective: text || "Objetivo vazio",
    entities,
    constraints: constraintsFor(detected.goalType),
    requestedOutcome: outcomeFor(detected.goalType, text),
    riskLevel,
    requiresConfirmation,
    metadata: {
      ...(input.metadata || {}),
      companyId: input.companyId ?? null,
      ticketId: input.ticketId ?? null,
      contactId: input.contactId ?? null,
      analyzer: "rule_based_v2",
      executesTools: false
    },
    sourceText: text,
    detectedIntent: detected.intent,
    confidence: detected.confidence,
    createdAt: new Date().toISOString()
  };
}

export default { analyzeGoal };
