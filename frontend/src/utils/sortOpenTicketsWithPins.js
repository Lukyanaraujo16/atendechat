/**
 * Mantém tickets fixados no topo (ordem de fixação ASC).
 * Demais tickets preservam a ordem relativa atual.
 */
export default function sortOpenTicketsWithPins(tickets, pinnedOrderIds) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return tickets;
  }
  const orderIds = Array.isArray(pinnedOrderIds)
    ? pinnedOrderIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : [];
  if (orderIds.length === 0) {
    return tickets;
  }

  const orderMap = new Map(orderIds.map((id, index) => [id, index]));
  const pinned = [];
  const rest = [];

  tickets.forEach((ticket) => {
    const id = Number(ticket?.id);
    if (orderMap.has(id) || ticket?.isPinned) {
      pinned.push(ticket?.isPinned ? ticket : { ...ticket, isPinned: true });
    } else {
      rest.push(ticket);
    }
  });

  pinned.sort((a, b) => {
    const ai = orderMap.get(Number(a.id));
    const bi = orderMap.get(Number(b.id));
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return 0;
  });

  return [...pinned, ...rest];
}
