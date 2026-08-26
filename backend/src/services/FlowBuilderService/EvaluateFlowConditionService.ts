import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { parseTicketDataWebhook } from "../../helpers/GetTicketRemoteJid";
import { isFlowBuilderDebugEnabled } from "../../utils/flowBuilderDebug";
import { logger } from "../../utils/logger";

const LOG_PREFIX = "[FlowBuilder][condition]";

export type ConditionMode = "all" | "any";

export interface ConditionRule {
  source: "variable" | "ticket" | "contact" | "context";
  field: string;
  operator: string;
  value?: string;
}

export interface ConditionNodeData {
  mode?: ConditionMode;
  rules?: ConditionRule[];
  /** legado */
  key?: string;
  condition?: number;
  value?: string;
}

function normalizeNodeData(data: ConditionNodeData | null | undefined): {
  mode: ConditionMode;
  rules: ConditionRule[];
} {
  if (data?.rules && Array.isArray(data.rules) && data.rules.length > 0) {
    return {
      mode: data.mode === "any" ? "any" : "all",
      rules: data.rules.filter(
        r =>
          r &&
          r.source &&
          r.field &&
          r.operator
      ) as ConditionRule[]
    };
  }
  if (data?.key != null && String(data.key).trim() !== "") {
    const mapOp: Record<number, string> = {
      1: "equals",
      2: "greaterThanOrEqual",
      3: "lessThanOrEqual",
      4: "lessThan",
      5: "greaterThan"
    };
    const op =
      typeof data.condition === "number"
        ? mapOp[data.condition] || "equals"
        : "equals";
    return {
      mode: "all",
      rules: [
        {
          source: "variable",
          field: String(data.key).trim(),
          operator: op,
          value: data.value != null ? String(data.value) : ""
        }
      ]
    };
  }
  return { mode: "all", rules: [] };
}

function trimStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

function existsValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return !Number.isNaN(v);
  return true;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "sim") return true;
    if (s === "false" || s === "0" || s === "nao" || s === "não") return false;
  }
  if (typeof v === "number") return v !== 0;
  return null;
}

async function resolveFieldValue(
  source: ConditionRule["source"],
  field: string,
  ticket: Ticket,
  contact: Contact | null | undefined,
  ctx: {
    body: string;
    isFirstInteraction: boolean;
    hasQueue: boolean;
    hasUser: boolean;
  }
): Promise<unknown> {
  const f = String(field || "").trim();
  switch (source) {
    case "variable": {
      const dw = parseTicketDataWebhook(ticket.dataWebhook);
      const vars = dw.variables as Record<string, unknown> | undefined;
      if (vars && typeof vars === "object" && !Array.isArray(vars)) {
        return vars[f];
      }
      return undefined;
    }
    case "ticket": {
      const t = ticket as unknown as Record<string, unknown>;
      switch (f) {
        case "status":
          return t.status;
        case "queueId":
          return t.queueId;
        case "userId":
          return t.userId;
        case "chatbot":
          return t.chatbot;
        case "protocol":
          return t.id != null ? String(t.id) : "";
        case "contactId":
          return t.contactId;
        case "whatsappId":
          return t.whatsappId;
        default:
          return undefined;
      }
    }
    case "contact": {
      const c = contact || ticket.contact;
      if (!c) return undefined;
      const cr = c as unknown as Record<string, unknown>;
      switch (f) {
        case "name":
          return cr.name;
        case "number":
          return cr.number;
        case "email":
          return cr.email;
        default:
          return undefined;
      }
    }
    case "context": {
      switch (f) {
        case "body":
          return ctx.body;
        case "isFirstInteraction":
          return ctx.isFirstInteraction;
        case "hasQueue":
          return ctx.hasQueue;
        case "hasUser":
          return ctx.hasUser;
        default:
          return undefined;
      }
    }
    default:
      return undefined;
  }
}

function evaluateOperator(
  leftRaw: unknown,
  operator: string,
  rightRaw: string | undefined
): boolean {
  const op = String(operator || "").trim();
  const leftStr = trimStr(leftRaw);
  const rightStr = trimStr(rightRaw);

  switch (op) {
    case "equals":
      return leftStr === rightStr;
    case "notEquals":
      return leftStr !== rightStr;
    case "contains":
      return leftStr.includes(rightStr);
    case "notContains":
      return !leftStr.includes(rightStr);
    case "startsWith":
      return leftStr.startsWith(rightStr);
    case "endsWith":
      return leftStr.endsWith(rightStr);
    case "exists":
      return existsValue(leftRaw);
    case "notExists":
      return !existsValue(leftRaw);
    case "isEmpty":
      return isEmptyValue(leftRaw);
    case "isNotEmpty":
      return !isEmptyValue(leftRaw);
    case "isTrue": {
      const b = toBool(leftRaw);
      return b === true;
    }
    case "isFalse": {
      const b = toBool(leftRaw);
      return b === false;
    }
    case "greaterThan": {
      const a = toNumber(leftRaw);
      const b = toNumber(rightRaw);
      return a != null && b != null && a > b;
    }
    case "greaterThanOrEqual": {
      const a = toNumber(leftRaw);
      const b = toNumber(rightRaw);
      return a != null && b != null && a >= b;
    }
    case "lessThan": {
      const a = toNumber(leftRaw);
      const b = toNumber(rightRaw);
      return a != null && b != null && a < b;
    }
    case "lessThanOrEqual": {
      const a = toNumber(leftRaw);
      const b = toNumber(rightRaw);
      return a != null && b != null && a <= b;
    }
    case "in": {
      const parts = rightStr.split(",").map(s => s.trim()).filter(Boolean);
      return parts.includes(leftStr);
    }
    case "notIn": {
      const parts = rightStr.split(",").map(s => s.trim()).filter(Boolean);
      return !parts.includes(leftStr);
    }
    case "matchesRegex": {
      try {
        const re = new RegExp(rightStr);
        return re.test(leftStr);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

export interface EvaluateFlowConditionResult {
  passed: boolean;
  mode: ConditionMode;
  ruleResults: Array<{
    rule: ConditionRule;
    resolved: unknown;
    ok: boolean;
  }>;
}

export async function evaluateFlowCondition(
  ticket: Ticket | null | undefined,
  contact: Contact | null | undefined,
  nodeData: ConditionNodeData | null | undefined,
  bodyInput: string | null | undefined,
  companyId: number
): Promise<EvaluateFlowConditionResult> {
  const { mode, rules } = normalizeNodeData(nodeData || undefined);

  if (!ticket) {
    logger.warn(
      { flowCondition: true, companyId },
      `${LOG_PREFIX} sem ticket — resultado false`
    );
    return { passed: false, mode, ruleResults: [] };
  }

  const body = bodyInput != null ? String(bodyInput) : "";
  const inboundCount = await Message.count({
    where: {
      ticketId: ticket.id,
      companyId,
      fromMe: false
    }
  });
  const isFirstInteraction = inboundCount <= 1;
  const hasQueue = !!ticket.queueId;
  const hasUser = !!ticket.userId;

  const ctx = { body, isFirstInteraction, hasQueue, hasUser };

  if (rules.length === 0) {
    logger.warn(
      { ticketId: ticket.id, flowCondition: true },
      `${LOG_PREFIX} sem regras — resultado false`
    );
    return { passed: false, mode, ruleResults: [] };
  }

  const ruleResults: EvaluateFlowConditionResult["ruleResults"] = [];

  for (const rule of rules) {
    const resolved = await resolveFieldValue(
      rule.source,
      rule.field,
      ticket,
      contact,
      ctx
    );
    const needsValue = ![
      "exists",
      "notExists",
      "isEmpty",
      "isNotEmpty",
      "isTrue",
      "isFalse"
    ].includes(rule.operator);
    const ok = evaluateOperator(
      resolved,
      rule.operator,
      needsValue ? rule.value : undefined
    );
    ruleResults.push({ rule, resolved, ok });
  }

  const passed =
    mode === "any"
      ? ruleResults.some(r => r.ok)
      : ruleResults.every(r => r.ok);

  if (isFlowBuilderDebugEnabled()) {
    logger.info(
      {
        ticketId: ticket.id,
        mode,
        passed,
        ruleResults: ruleResults.map(r => ({
          source: r.rule.source,
          field: r.rule.field,
          operator: r.rule.operator,
          value: r.rule.value,
          resolved:
            typeof r.resolved === "object"
              ? JSON.stringify(r.resolved)
              : r.resolved,
          ok: r.ok
        }))
      },
      `${LOG_PREFIX} avaliação concluída`
    );
  }

  return { passed, mode, ruleResults };
}

export function pickConditionEdgeTarget(
  connects: Array<{ source?: string; sourceHandle?: string | null; target?: string }>,
  nodeId: string,
  passed: boolean
): string | undefined {
  const handle = passed ? "true" : "false";
  const fromNode = connects.filter(c => c.source === nodeId);
  let edge = fromNode.find(c => c.sourceHandle === handle);
  if (!edge) {
    edge = fromNode.find(c =>
      passed ? c.sourceHandle === "a" : c.sourceHandle === "b"
    );
  }
  return edge?.target;
}
