import { ExecutionSession, NextStepDecision } from "./executionTypes";

/**
 * NextStepResolver — decide etapas liberadas/bloqueadas.
 * Não executa Tools.
 */
export function resolveNextSteps(session: ExecutionSession): NextStepDecision {
  const done = new Set([
    ...session.completedSteps,
    ...session.skippedSteps
  ]);
  const failed = new Set(session.failedSteps);
  const waiting = new Set(session.waitingSteps);
  const ready: string[] = [];
  const blocked: Array<{ stepId: string; reason: string }> = [];
  const waitingConfirmation: string[] = [];
  const waitingRecovery: string[] = [];

  for (const node of session.graph.nodes) {
    const id = node.stepId;
    if (done.has(id)) continue;
    if (failed.has(id)) {
      if (session.recoveryState.active) {
        waitingRecovery.push(id);
      }
      continue;
    }
    if (waiting.has(id)) {
      waitingConfirmation.push(id);
      continue;
    }

    const parentsOk = node.parents.every(p => done.has(p));
    const parentFailed = node.parents.some(p => failed.has(p));
    if (parentFailed) {
      blocked.push({ stepId: id, reason: "parent_failed" });
      continue;
    }
    if (!parentsOk) {
      blocked.push({ stepId: id, reason: "dependencies_pending" });
      continue;
    }
    if (node.requiresConfirmation && !session.executionContext[`confirmed:${id}`]) {
      waitingConfirmation.push(id);
      continue;
    }
    ready.push(id);
  }

  // Prefer order from graph
  const orderedReady = session.graph.order.filter(id => ready.includes(id));
  const nextStepId = orderedReady[0] || ready[0] || null;

  return {
    ready: orderedReady.length ? orderedReady : ready,
    blocked,
    waitingConfirmation,
    waitingRecovery,
    nextStepId
  };
}

export default { resolveNextSteps };
