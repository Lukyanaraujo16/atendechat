export function getTicketChannel(ticket: {
  channel?: string | null;
}): string {
  return String(ticket?.channel || "whatsapp").toLowerCase();
}

export function isInstagramChannelTicket(ticket: {
  channel?: string | null;
}): boolean {
  return getTicketChannel(ticket) === "instagram";
}

export function isWhatsappChannelTicket(ticket: {
  channel?: string | null;
}): boolean {
  return !isInstagramChannelTicket(ticket);
}

export function normalizeOptionalForeignKeyId(
  value: unknown
): number | null {
  if (value === false || value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
