/**
 * Avisos preventivos para nós de menu no editor (sem efeito no runtime).
 * @param {string} nodeId
 * @param {import('react-flow-renderer').Edge[]} edges
 * @param {object} data nó.data do menu
 * @returns {string[]} ids estáveis: missing_invalid | timeout_no_edge | timeout_edge_no_time | no_option_edges
 */
export function getMenuNodeWarningIds(nodeId, edges, data) {
  if (!nodeId || !data) return [];

  const outgoing = (edges || []).filter((e) => e.source === nodeId);
  const hasHandle = (h) =>
    outgoing.some((e) => String(e.sourceHandle || "") === String(h));

  const ids = [];

  if (!hasHandle("invalid")) {
    ids.push("missing_invalid");
  }

  const secRaw = data.menuTimeoutSeconds;
  const sec = Math.max(
    0,
    parseInt(String(secRaw == null || secRaw === "" ? 0 : secRaw), 10) || 0
  );

  if (sec > 0 && !hasHandle("timeout")) {
    ids.push("timeout_no_edge");
  }

  if (hasHandle("timeout") && sec <= 0) {
    ids.push("timeout_edge_no_time");
  }

  const options = Array.isArray(data.arrayOption) ? data.arrayOption : [];
  if (options.length > 0) {
    const anyOptionWired = options.some((o) =>
      hasHandle(`a${o.number}`)
    );
    if (!anyOptionWired) {
      ids.push("no_option_edges");
    }
  }

  return ids;
}
