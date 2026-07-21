import {
  AUTOMATION_EVIDENCE_VERSION,
  EvidenceType
} from "../../../config/automationEvidenceConstants";
import {
  EvidenceFinding,
  EvidenceReportPayload,
  ShadowEvaluationEvidenceInput
} from "./evidenceTypes";
import { evaluateToolEvidence } from "./evidenceVerification";
import { evaluateKnowledgeEvidence } from "./evidenceKnowledge";

const PRIMARY_PRIORITY: EvidenceType[] = [
  "HALLUCINATION_AFTER_TOOL",
  "CONFLICTING_TOOL_RESULTS",
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "KNOWLEDGE_VERIFIED",
  "TOOL_UNUSED",
  "KNOWLEDGE_UNUSED",
  "EMPTY_RESULT",
  "INVALID_TOOL_SELECTION",
  "TOOL_NOT_SELECTED",
  "MULTIPLE_TOOL_CONSISTENCY",
  "NO_TOOL_NEEDED"
];

/**
 * AutomationEvidenceEngine — fatos observáveis a partir de ShadowEvaluation.
 */
export function buildEvidenceReport(
  evaluation: ShadowEvaluationEvidenceInput
): EvidenceReportPayload {
  const toolFindings = evaluateToolEvidence(evaluation);
  const knowledgeFindings = evaluateKnowledgeEvidence(evaluation);
  const findings: EvidenceFinding[] = [...toolFindings, ...knowledgeFindings];

  // TOOL_NOT_SELECTED: heurística fraca — se não houve tools e knowledge unused
  // (não inventamos "tool necessária"; só marca se metadata pedir)
  if (
    (evaluation.metadata as any)?.expectedToolId &&
    !(evaluation.toolCallCount > 0)
  ) {
    findings.push({
      type: "TOOL_NOT_SELECTED",
      toolId: String((evaluation.metadata as any).expectedToolId),
      justification: "Selection não expôs/chamou a Tool marcada como esperada.",
      facts: {}
    });
  }

  if (!findings.length) {
    findings.push({
      type: "NO_TOOL_NEEDED",
      justification: "Sem findings observáveis (sem tools/knowledge acionáveis).",
      facts: {}
    });
  }

  const types = [...new Set(findings.map(f => f.type))];
  const primaryType =
    PRIMARY_PRIORITY.find(t => types.includes(t)) || findings[0].type;

  const has = (t: EvidenceType) => types.includes(t);

  return {
    version: AUTOMATION_EVIDENCE_VERSION,
    shadowEvaluationId: evaluation.id,
    companyId: evaluation.companyId,
    aiAgentId: evaluation.aiAgentId ?? null,
    whatsappId: evaluation.whatsappId ?? null,
    provider: evaluation.provider ?? null,
    model: evaluation.model ?? null,
    findings,
    primaryType,
    scores: {
      verified: has("VERIFIED"),
      partiallyVerified: has("PARTIALLY_VERIFIED"),
      hallucination: has("HALLUCINATION_AFTER_TOOL"),
      toolUnused: has("TOOL_UNUSED"),
      emptyResult: has("EMPTY_RESULT"),
      knowledgeVerified: has("KNOWLEDGE_VERIFIED"),
      knowledgeUnused: has("KNOWLEDGE_UNUSED"),
      multiToolConsistent: has("MULTIPLE_TOOL_CONSISTENCY"),
      conflictingTools: has("CONFLICTING_TOOL_RESULTS"),
      noToolNeeded: has("NO_TOOL_NEEDED")
    },
    summary: {
      findingCount: findings.length,
      types,
      toolIds: [
        ...new Set(
          findings.map(f => f.toolId).filter((x): x is string => Boolean(x))
        )
      ]
    }
  };
}

export default { buildEvidenceReport };
