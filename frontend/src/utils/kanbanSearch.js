/**
 * Busca client-side no Kanban (tickets já carregados).
 */

export function normalizeKanbanSearchText(value) {
  if (value == null) return "";
  return String(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function collectTicketSearchHaystack(ticket) {
  const parts = [];
  const contact = ticket?.contact || {};

  if (contact.name) parts.push(contact.name);
  if (contact.number) parts.push(contact.number);
  if (ticket.lastMessage) parts.push(ticket.lastMessage);
  if (ticket.user?.name) parts.push(ticket.user.name);
  if (ticket.queue?.name) parts.push(ticket.queue.name);
  if (ticket.id != null) parts.push(String(ticket.id));
  if (ticket.uuid) parts.push(String(ticket.uuid));
  if (ticket.code != null && ticket.code !== "") parts.push(String(ticket.code));

  const tags = ticket.tags;
  if (Array.isArray(tags)) {
    tags.forEach((tag) => {
      if (tag?.name) parts.push(tag.name);
    });
  }

  return normalizeKanbanSearchText(parts.join(" "));
}

/**
 * @param {object} ticket
 * @param {string} normalizedQuery resultado de normalizeKanbanSearchText(query)
 */
export function ticketMatchesKanbanSearch(ticket, normalizedQuery) {
  if (!normalizedQuery) return true;
  if (!ticket) return false;
  const haystack = collectTicketSearchHaystack(ticket);
  return haystack.includes(normalizedQuery);
}

export function filterTicketsByKanbanSearch(tickets, rawQuery) {
  const list = Array.isArray(tickets) ? tickets : [];
  const normalized = normalizeKanbanSearchText(rawQuery);
  if (!normalized) return list;
  return list.filter((ticket) => ticketMatchesKanbanSearch(ticket, normalized));
}
