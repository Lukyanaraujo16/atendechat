import { literal } from "sequelize";
import Ticket from "../models/Ticket";
import sequelize from "../database";
import ListPinnedTicketsService, {
  PinnedTicketListItem
} from "../services/PinnedTicketServices/ListPinnedTicketsService";
import { logger } from "../utils/logger";

const PINNED_TABLE = "PinnedTickets";

function isPostgresDialect(): boolean {
  return sequelize.getDialect() === "postgres";
}

/**
 * Ordenação SQL: fixados primeiro.
 * PostgreSQL: identificadores entre aspas duplas ("PinnedTickets", pt."ticketId").
 * MySQL: backticks.
 */
export function buildPinnedTicketOrderClause(
  userId: number,
  companyId: number
): Array<[ReturnType<typeof literal>, string]> {
  const uid = sequelize.escape(userId);
  const cid = sequelize.escape(companyId);

  if (isPostgresDialect()) {
    return [
      [
        literal(
          `(SELECT COUNT(*) FROM "${PINNED_TABLE}" AS pt WHERE pt."ticketId" = "Ticket"."id" AND pt."userId" = ${uid} AND pt."companyId" = ${cid})`
        ),
        "DESC"
      ],
      [
        literal(
          `(SELECT MIN(pt."createdAt") FROM "${PINNED_TABLE}" AS pt WHERE pt."ticketId" = "Ticket"."id" AND pt."userId" = ${uid} AND pt."companyId" = ${cid})`
        ),
        "ASC"
      ]
    ];
  }

  return [
    [
      literal(
        `(SELECT COUNT(*) FROM \`${PINNED_TABLE}\` AS pt WHERE pt.\`ticketId\` = \`Ticket\`.\`id\` AND pt.\`userId\` = ${uid} AND pt.\`companyId\` = ${cid})`
      ),
      "DESC"
    ],
    [
      literal(
        `(SELECT MIN(pt.\`createdAt\`) FROM \`${PINNED_TABLE}\` AS pt WHERE pt.\`ticketId\` = \`Ticket\`.\`id\` AND pt.\`userId\` = ${uid} AND pt.\`companyId\` = ${cid})`
      ),
      "ASC"
    ]
  ];
}

/** Ordenação por IDs já carregados (alternativa sem subquery correlacionada). */
export function buildPinnedTicketOrderFromPinIds(
  pinIds: number[]
): Array<[ReturnType<typeof literal>, string]> {
  if (!pinIds.length) {
    return [];
  }

  const escapedIds = pinIds.map((id) => sequelize.escape(id));
  const inList = escapedIds.join(", ");

  if (isPostgresDialect()) {
    return [
      [
        literal(
          `(CASE WHEN "Ticket"."id" IN (${inList}) THEN 0 ELSE 1 END)`
        ),
        "ASC"
      ],
      [
        literal(
          `(array_position(ARRAY[${inList}]::integer[], "Ticket"."id"))`
        ),
        "ASC NULLS LAST"
      ]
    ];
  }

  const fieldArgs = escapedIds.join(", ");
  return [
    [
      literal(
        `(CASE WHEN \`Ticket\`.\`id\` IN (${inList}) THEN 0 ELSE 1 END)`
      ),
      "ASC"
    ],
    [literal(`FIELD(\`Ticket\`.\`id\`, ${fieldArgs})`), "ASC"]
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
    parent?: { code?: string; sqlMessage?: string; message?: string };
    original?: { code?: string; sqlMessage?: string; message?: string };
    message?: string;
  };
  const code = anyErr?.parent?.code || anyErr?.original?.code;
  const sqlMsg = String(
    anyErr?.parent?.sqlMessage ||
      anyErr?.original?.sqlMessage ||
      anyErr?.parent?.message ||
      anyErr?.original?.message ||
      anyErr?.message ||
      ""
  ).toLowerCase();

  const mentionsPinnedTable =
    sqlMsg.includes("pinnedtickets") || sqlMsg.includes('"pinnedtickets"');

  if (!mentionsPinnedTable) {
    return false;
  }

  if (code === "ER_NO_SUCH_TABLE" || code === "42P01") {
    return true;
  }

  return (
    sqlMsg.includes("does not exist") || sqlMsg.includes("doesn't exist")
  );
}

export function logListTicketsQueryError(
  error: unknown,
  context: {
    status?: string;
    userId: string | number;
    companyId: number;
    pinnedOrderActive: boolean;
    order?: unknown;
  }
): void {
  const err = error as {
    message?: string;
    name?: string;
    parent?: {
      code?: string;
      errno?: number;
      sqlMessage?: string;
      sql?: string;
    };
    original?: {
      code?: string;
      errno?: number;
      sqlMessage?: string;
      sql?: string;
    };
  };
  const parent = err?.parent || err?.original;

  logger.error(
    {
      tag: "[ListTicketsService]",
      message: err?.message,
      name: err?.name,
      parent: parent
        ? {
            code: parent.code,
            errno: parent.errno,
            sqlMessage: parent.sqlMessage,
            sql: parent.sql
          }
        : undefined,
      status: context.status,
      userId: context.userId,
      companyId: context.companyId,
      pinnedOrderActive: context.pinnedOrderActive,
      order: context.order
    },
    "Failed to list tickets"
  );
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
