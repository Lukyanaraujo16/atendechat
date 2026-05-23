import Ticket from "../models/Ticket";
import PinnedTicket from "../models/PinnedTicket";

export function attachTicketPinnedFlags(tickets: Ticket[]): void {
  tickets.forEach((ticket) => {
    const pins = (ticket as any).userPin as PinnedTicket[] | undefined;
    const pinned = Array.isArray(pins) && pins.length > 0;
    (ticket as any).dataValues.isPinned = pinned;
    (ticket as any).dataValues.pinnedAt = pinned ? pins[0].createdAt : null;
    delete (ticket as any).dataValues.userPin;
    delete (ticket as any).userPin;
  });
}
