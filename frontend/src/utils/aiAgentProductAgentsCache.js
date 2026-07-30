/**
 * Invalidação leve da listagem do Hub (sem React Query).
 * Commands/connections notificam; o hook de agents recarrega.
 */
const listeners = new Set();

export function notifyAiAgentProductAgentsChanged() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (_err) {
      // isolado
    }
  });
}

export function subscribeAiAgentProductAgentsChanged(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
