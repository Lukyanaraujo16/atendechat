/** Headers para evitar reutilização de cache HTTP em listagens dinâmicas. */
export const TICKETS_NO_CACHE_HEADERS = {
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

/**
 * Resposta válida de GET /tickets (200 com payload JSON).
 * 304 e corpos vazios/inválidos devem preservar o estado anterior na UI.
 */
export function isValidTicketsApiResponse(response) {
  if (!response || response.status === 304) {
    return false;
  }
  const data = response.data;
  if (data == null || typeof data !== "object") {
    return false;
  }
  if ("count" in data && typeof data.count !== "number") {
    return false;
  }
  if ("tickets" in data && !Array.isArray(data.tickets)) {
    return false;
  }
  return "count" in data || "tickets" in data;
}
