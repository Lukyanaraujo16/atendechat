/** Alinhado a `groupTicketRules.isTruthyGroupFlag` no backend. */
export function isTruthyGroupFlag(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function isGroupTicket(ticket) {
  if (!ticket) return false;
  return (
    isTruthyGroupFlag(ticket.isGroup) ||
    isTruthyGroupFlag(ticket.contact?.isGroup)
  );
}
