/**
 * Particiona conexões Product em buckets comerciais (Fase 2.9C).
 * @param {Array} connections
 */
export function partitionAiAgentProductConnections(connections = []) {
  const linked = [];
  const available = [];
  const other = [];
  (Array.isArray(connections) ? connections : []).forEach((item) => {
    if (!item || typeof item !== "object") return;
    if (item.selected === true) {
      linked.push(item);
      return;
    }
    if (item.eligible === true) {
      available.push(item);
      return;
    }
    other.push(item);
  });
  return { linked, available, other };
}

/**
 * Mensagem de conflito sem transferência silenciosa.
 */
export function aiAgentConnectionConflictMessage(connection) {
  const name = String(connection?.assignedAgentName || "").trim();
  if (name) {
    return {
      key: "aiAgentProduct.connections.conflictWithAgent",
      params: { name },
    };
  }
  return {
    key: "aiAgentProduct.connections.conflictGeneric",
    params: {},
  };
}
