import {
  ExecutionSessionStatus,
  VALID_SESSION_TRANSITIONS
} from "../../../../config/automationExecutionOrchestratorConstants";

export type TransitionResult = {
  allowed: boolean;
  from: ExecutionSessionStatus;
  to: ExecutionSessionStatus;
  reason: string;
};

/**
 * State Validator — impede transições inválidas.
 * Nunca altera estado automaticamente.
 */
export function validateTransition(
  from: ExecutionSessionStatus,
  to: ExecutionSessionStatus
): TransitionResult {
  if (from === to) {
    return {
      allowed: false,
      from,
      to,
      reason: "same_state_noop"
    };
  }
  const allowed = VALID_SESSION_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return {
      allowed: false,
      from,
      to,
      reason: `invalid_transition:${from}->${to}`
    };
  }
  return {
    allowed: true,
    from,
    to,
    reason: "ok"
  };
}

export function listAllowedTransitions(
  from: ExecutionSessionStatus
): ExecutionSessionStatus[] {
  return [...(VALID_SESSION_TRANSITIONS[from] || [])];
}

export default { validateTransition, listAllowedTransitions };
