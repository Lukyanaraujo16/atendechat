import { RecoveryPlan } from "../types";
import { ExecutionSession, RecoveryDecision } from "./executionTypes";

/**
 * Recovery Orchestration — consome Recovery Plan e decide ação.
 * Nunca executa.
 */
export function decideRecoveryAction(input: {
  session: ExecutionSession;
  recoveryPlan?: RecoveryPlan | null;
  stepId: string;
}): RecoveryDecision {
  const { session, recoveryPlan, stepId } = input;
  const node = session.graph.nodes.find(n => n.stepId === stepId);
  const attempts = session.recoveryState.attempts;

  if (recoveryPlan?.action) {
    const map: Record<string, RecoveryDecision["action"]> = {
      RETRY: "RETRY",
      SKIP: "SKIP",
      ABORT: "ABORT",
      ASK_CONFIRMATION: "ASK_CONFIRMATION",
      REPLAN: "REPLAN"
    };
    const action = map[recoveryPlan.action] || "ABORT";
    return {
      action,
      stepId,
      reason: recoveryPlan.reason || `from_recovery_plan:${recoveryPlan.action}`,
      autoExecute: false
    };
  }

  if (node?.requiresConfirmation) {
    return {
      action: "ASK_CONFIRMATION",
      stepId,
      reason: "step_requires_confirmation",
      autoExecute: false
    };
  }
  if (node?.retryable && attempts < 2) {
    return {
      action: "RETRY",
      stepId,
      reason: "retryable_step",
      autoExecute: false
    };
  }
  if (node?.optional) {
    return {
      action: "SKIP",
      stepId,
      reason: "optional_failed",
      autoExecute: false
    };
  }
  return {
    action: "ABORT",
    stepId,
    reason: "non_recoverable",
    autoExecute: false
  };
}

export default { decideRecoveryAction };
