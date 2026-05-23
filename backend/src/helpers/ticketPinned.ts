import { literal } from "sequelize";
import Ticket from "../models/Ticket";
import sequelize from "../database";
import ListPinnedTicketsService, {
  PinnedTicketListItem
} from "../services/PinnedTicketServices/ListPinnedTicketsService";

/** Ordenação SQL: fixados primeiro (MySQL), sem JOIN que quebra count/ambiguous columns. */
export function buildPinnedTicketOrderClause(
  userId: number,
  companyId: number
): Array<[ReturnType<typeof literal>, string]> {
  const uid = sequelize.escape(userId);
  const cid = sequelize.escape(companyId);
  return [
    [
      literal(
        `(SELECT COUNT(*) FROM PinnedTickets AS pt WHERE pt.ticketId = Ticket.id AND pt.userId = ${uid} AND pt.companyId = ${cid})`
      ),
      "DESC"
    ],
    [
      literal(
        `(SELECT MIN(pt.createdAt) FROM PinnedTickets AS pt WHERE pt.ticketId = Ticket.id AND pt.userId = ${uid} AND pt.companyId = ${cid})`
      ),
      "ASC"
    ]
  ];
}

export function attachTicketPinnedFlagsFromList(
  tickets: Ticket[],
  pinned: PinnedTicketListItem[]
): void {
  const pinMap = new Map(
    pinned.map((row) => [Number(row.ticketId), row.createdAt])
  );
  tickets.forEach((ticket) => {
    const pinnedAt = pinMap.get(Number(ticket.id));
    const isPinned = pinnedAt != null;
    (ticket as any).dataValues.isPinned = isPinned;
    (ticket as any).dataValues.pinnedAt = isPinned ? pinnedAt : null;
  });
}

export function isPinnedTicketsTableMissingError(err: unknown): boolean {
  const anyErr = err as {
    parent?: { code?: string; sqlMessage?: string };
    original?: { code?: string; sqlMessage?: string };
    message?: string;
  };
  const code = anyErr?.parent?.code || anyErr?.original?.code;
  if (code === "ER_NO_SUCH_TABLE") {
    const sqlMsg = String(
      anyErr?.parent?.sqlMessage || anyErr?.original?.sqlMessage || ""
    ).toLowerCase();
    return sqlMsg.includes("pinnedtickets");
  }
  const msg = String(anyErr?.message || "").toLowerCase();
  return msg.includes("pinnedtickets") && msg.includes("doesn't exist");
}

export async function loadPinnedTicketsForUser(
  userId: number,
  companyId: number
): Promise<PinnedTicketListItem[]> {
  try {
    return await ListPinnedTicketsService({ userId, companyId });
  } catch (err) {
    if (isPinnedTicketsTableMissingError(err)) {
      return [];
    }
    throw err;
  }
}
