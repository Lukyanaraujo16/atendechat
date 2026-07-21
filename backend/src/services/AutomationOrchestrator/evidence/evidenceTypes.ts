import {
  EvidenceType,
  AUTOMATION_EVIDENCE_VERSION
} from "../../../config/automationEvidenceConstants";

export type EvidenceFinding = {
  type: EvidenceType;
  toolId?: string | null;
  justification: string;
  facts: {
    extractedValues?: string[];
    matchedInReply?: string[];
    missingInReply?: string[];
    knowledgeChunkIds?: string[];
    usedChunkIds?: string[];
    unusedChunkIds?: string[];
  };
};

export type EvidenceReportPayload = {
  version: string;
  shadowEvaluationId: number;
  companyId: number;
  aiAgentId: number | null;
  whatsappId: number | null;
  provider: string | null;
  model: string | null;
  findings: EvidenceFinding[];
  primaryType: EvidenceType;
  scores: {
    verified: boolean;
    partiallyVerified: boolean;
    hallucination: boolean;
    toolUnused: boolean;
    emptyResult: boolean;
    knowledgeVerified: boolean;
    knowledgeUnused: boolean;
    multiToolConsistent: boolean;
    conflictingTools: boolean;
    noToolNeeded: boolean;
  };
  summary: {
    findingCount: number;
    types: EvidenceType[];
    toolIds: string[];
  };
};

export type ShadowEvaluationEvidenceInput = {
  id: number;
  companyId: number;
  aiAgentId?: number | null;
  whatsappId?: number | null;
  provider?: string | null;
  model?: string | null;
  shadowReply?: string | null;
  officialReply?: string | null;
  usedTools?: boolean;
  usedKnowledge?: boolean;
  toolCallCount?: number;
  loopStopReason?: string | null;
  status?: string;
  latencyMs?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  toolAnalytics?: Record<string, unknown> | null;
  knowledgeMeta?: Record<string, unknown> | null;
  trace?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type ToolResolutionFact = {
  toolId: string;
  status: string;
  durationMs?: number;
  modelResult: Record<string, unknown> | null;
  arguments?: Record<string, unknown>;
};

/** Extrai strings factuais observáveis de um ToolModelResult. */
export function extractFactualValues(
  modelResult: Record<string, unknown> | null | undefined
): string[] {
  if (!modelResult || typeof modelResult !== "object") return [];
  const values = new Set<string>();

  const push = (v: unknown) => {
    if (v == null) return;
    if (typeof v === "number" && Number.isFinite(v)) {
      values.add(String(v));
      return;
    }
    if (typeof v !== "string") return;
    const t = v.trim();
    if (t.length < 2 || t.length > 120) return;
    // Evita frases longas de summary como "fato" único se > 80
    if (t.length > 80 && /\s/.test(t)) return;
    values.add(t);
  };

  const walk = (obj: unknown, depth: number) => {
    if (depth > 4 || obj == null) return;
    if (typeof obj === "string" || typeof obj === "number") {
      push(obj);
      return;
    }
    if (Array.isArray(obj)) {
      for (const x of obj.slice(0, 20)) walk(x, depth + 1);
      return;
    }
    if (typeof obj === "object") {
      const rec = obj as Record<string, unknown>;
      const preferKeys = [
        "phone",
        "number",
        "email",
        "name",
        "title",
        "queue",
        "status",
        "document",
        "cpf",
        "cnpj",
        "id",
        "ticketId",
        "contactId"
      ];
      for (const k of preferKeys) {
        if (k in rec) push(rec[k]);
      }
      for (const [k, v] of Object.entries(rec)) {
        if (preferKeys.includes(k)) continue;
        if (["summary", "tool", "status", "warnings"].includes(k)) {
          if (k === "summary" && typeof v === "string") {
            // Extrai tokens com dígitos (telefone etc.) do summary
            const digits = v.match(/\+?\d[\d\s().-]{7,}\d/g) || [];
            for (const d of digits) push(d.replace(/\s+/g, ""));
            const emails = v.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) || [];
            for (const e of emails) push(e);
          }
          continue;
        }
        walk(v, depth + 1);
      }
    }
  };

  walk(modelResult.item, 0);
  walk(modelResult.items, 0);
  if (typeof modelResult.summary === "string") {
    walk({ summary: modelResult.summary }, 0);
  }
  if (typeof modelResult.count === "number" && modelResult.count > 0) {
    push(String(modelResult.count));
  }

  return [...values].filter(v => v.length >= 2);
}

export function normalizeForMatch(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Match factual: valor aparece na resposta (digits-only flexível para telefones). */
export function valueAppearsInReply(value: string, reply: string): boolean {
  const r = normalizeForMatch(reply);
  const v = normalizeForMatch(value);
  if (!v || !r) return false;
  if (r.includes(v)) return true;
  const vDigits = v.replace(/\D/g, "");
  if (vDigits.length >= 8) {
    const rDigits = r.replace(/\D/g, "");
    if (rDigits.includes(vDigits)) return true;
  }
  return false;
}

export function isEmptyModelResult(
  modelResult: Record<string, unknown> | null | undefined
): boolean {
  if (!modelResult) return true;
  const status = String(modelResult.status || "");
  if (status === "empty") return true;
  if (status === "denied" || status === "failure" || status === "skipped") {
    return false;
  }
  const count = modelResult.count;
  if (typeof count === "number" && count === 0) return true;
  const items = modelResult.items;
  if (Array.isArray(items) && items.length === 0 && !modelResult.item) {
    return true;
  }
  const data = (modelResult as any).data;
  if (data && data.found === false) return true;
  return false;
}

export function replyIndicatesNotFound(reply: string): boolean {
  const r = normalizeForMatch(reply);
  const patterns = [
    "nao encontrei",
    "não encontrei",
    "nao localizei",
    "não localizei",
    "nao ha",
    "não há",
    "sem resultados",
    "nao tenho essa informacao",
    "não tenho essa informação",
    "nao consegui encontrar",
    "não consegui encontrar",
    "empty",
    "not found"
  ];
  return patterns.some(p => r.includes(normalizeForMatch(p)));
}

export function collectResolutions(
  evaluation: ShadowEvaluationEvidenceInput
): ToolResolutionFact[] {
  const trace = evaluation.trace || {};
  const iterations = Array.isArray(trace.iterations) ? trace.iterations : [];
  const out: ToolResolutionFact[] = [];
  for (const it of iterations) {
    const resolutions = Array.isArray((it as any).resolutions)
      ? (it as any).resolutions
      : [];
    for (const r of resolutions) {
      out.push({
        toolId: String(r.toolId || "unknown"),
        status: String(r.status || "unknown"),
        durationMs: typeof r.durationMs === "number" ? r.durationMs : undefined,
        modelResult:
          r.modelResult && typeof r.modelResult === "object"
            ? (r.modelResult as Record<string, unknown>)
            : null,
        arguments:
          r.arguments && typeof r.arguments === "object"
            ? (r.arguments as Record<string, unknown>)
            : undefined
      });
    }
  }
  return out;
}

export { AUTOMATION_EVIDENCE_VERSION };
