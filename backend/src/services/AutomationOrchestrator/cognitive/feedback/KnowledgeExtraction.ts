import { FeedbackStepStatus } from "../../../../config/automationExecutionFeedbackConstants";
import { FeedbackKnowledge } from "./feedbackTypes";

/**
 * Knowledge Extraction — estruturado, determinístico.
 * Não usa IA / Provider.
 */
export function extractFeedbackKnowledge(input: {
  runtimeResult?: Record<string, unknown> | null;
  actionResult?: Record<string, unknown> | null;
  entities?: Array<{ key: string; value: string }>;
  constraints?: string[];
}): FeedbackKnowledge {
  const runtime = input.runtimeResult || {};
  const action = input.actionResult || {};
  const modelResult = ((runtime.modelResult as Record<string, unknown>) ||
    ((action.output as Record<string, unknown>) || {}).modelResult ||
    {}) as Record<string, unknown>;

  const entitiesFound: Array<{ key: string; value: string }> = [
    ...(input.entities || [])
  ];

  const data = ((modelResult.data as Record<string, unknown>) ||
    (runtime.internalData as Record<string, unknown>) ||
    (action.output as Record<string, unknown>) ||
    {}) as Record<string, unknown>;

  for (const [key, value] of Object.entries(data)) {
    if (
      value == null ||
      typeof value === "object" ||
      key === "status" ||
      key === "summary"
    ) {
      continue;
    }
    if (!entitiesFound.some(e => e.key === key)) {
      entitiesFound.push({ key, value: String(value).slice(0, 200) });
    }
  }

  const entitiesMissing: string[] = [];
  for (const c of input.constraints || []) {
    if (c.startsWith("require:")) {
      const key = c.slice("require:".length);
      if (!entitiesFound.some(e => e.key === key)) {
        entitiesMissing.push(key);
      }
    }
  }

  const changesMade: string[] = [];
  if (Array.isArray((data as any).changedFields)) {
    for (const f of (data as any).changedFields) {
      changesMade.push(String(f));
    }
  }
  if (runtime.toolId) {
    changesMade.push(`tool:${String(runtime.toolId)}`);
  }

  const warnings = [
    ...((runtime.warnings as string[]) || []),
    ...((action.warnings as string[]) || [])
  ].map(String);

  const errors = [
    ...((runtime.errors as string[]) || []),
    ...((action.errors as string[]) || [])
  ].map(String);

  return {
    entitiesFound,
    entitiesMissing,
    changesMade,
    constraintsFound: [...(input.constraints || [])],
    warnings,
    errors
  };
}

export function mapRuntimeStatusToStepStatus(input: {
  runtimeStatus?: string;
  actionStatus?: string;
  validation?: string;
}): FeedbackStepStatus {
  const status = String(
    input.runtimeStatus || input.actionStatus || ""
  ).toLowerCase();
  const validation = String(input.validation || "").toUpperCase();

  if (status === "waiting" || validation === "WAITING") return "WAITING";
  if (status === "success" || status === "SUCCESS") {
    if (validation === "PARTIAL") return "PARTIAL";
    return "SUCCESS";
  }
  if (status === "denied") return "PARTIAL";
  if (status === "timeout") return "FAILED";
  if (status === "aborted" || status === "ABORTED") return "ABORTED";
  if (status === "skipped" || status === "SKIPPED") return "SKIPPED";
  if (status === "failure" || status === "failed" || status === "FAILED") {
    return "FAILED";
  }
  if (validation === "PARTIAL") return "PARTIAL";
  if (validation === "FAILED") return "FAILED";
  return "FAILED";
}

export default { extractFeedbackKnowledge, mapRuntimeStatusToStepStatus };
