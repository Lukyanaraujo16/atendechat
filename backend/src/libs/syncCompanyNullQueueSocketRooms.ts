import User from "../models/User";
import Queue from "../models/Queue";
import {
  allowsNullQueueVisibility,
  loadCompanyUnassignedTicketsQueueId
} from "../helpers/unassignedTicketsVisibility";
import { getUserQueueIdsFromQueues } from "../helpers/ticketAccess";
import { logger } from "../utils/logger";
import { getIO } from "./socket";

type SocketUserMeta = {
  id: number;
  profile: string;
  allTicket: string;
  queueIds: number[];
};

/**
 * Atualiza rooms queue-null-* dos sockets da empresa quando o setor de
 * contingência muda — sem exigir relogin.
 */
export async function syncCompanyNullQueueSocketRooms(
  companyId: number,
  unassignedTicketsQueueId?: number | null
): Promise<void> {
  let io: ReturnType<typeof getIO>;
  try {
    io = getIO();
  } catch {
    return;
  }

  const contingencyId =
    unassignedTicketsQueueId !== undefined
      ? unassignedTicketsQueueId
      : await loadCompanyUnassignedTicketsQueueId(companyId);

  const room = `company-${companyId}-mainchannel`;
  let sockets: Array<{
    id: string;
    rooms: Set<string>;
    data: { atendeUser?: SocketUserMeta };
    join: (r: string) => void;
    leave: (r: string) => void;
  }>;

  try {
    sockets = (await io.in(room).fetchSockets()) as unknown as typeof sockets;
  } catch (err) {
    logger.debug(
      { err: err instanceof Error ? err.message : String(err), companyId },
      "[socket] syncCompanyNullQueueSocketRooms fetchSockets failed"
    );
    return;
  }

  for (const socket of sockets) {
    const meta = socket.data?.atendeUser;
    if (!meta || meta.profile === "admin") {
      continue;
    }

    let queueIds = Array.isArray(meta.queueIds) ? meta.queueIds : [];
    let allTicket = meta.allTicket === "enabled";

    try {
      const userRow = await User.findByPk(meta.id, {
        attributes: ["id", "allTicket", "profile"],
        include: [{ model: Queue, as: "queues", attributes: ["id"] }]
      });
      if (userRow) {
        queueIds = getUserQueueIdsFromQueues(userRow.queues);
        allTicket = userRow.allTicket === "enabled";
        socket.data.atendeUser = {
          id: Number(userRow.id),
          profile: String(userRow.profile || meta.profile),
          allTicket: String(userRow.allTicket || "disabled"),
          queueIds
        };
        if (userRow.profile === "admin") {
          continue;
        }
      }
    } catch {
      // usa meta em cache
    }

    const rooms = socket.rooms instanceof Set ? socket.rooms : new Set(socket.rooms as unknown as string[]);
    const roomList = Array.from(rooms);
    const subscribedPending = roomList.some(
      (r) =>
        r === "queue-null-pending" ||
        /^queue-\d+-pending$/.test(r)
    );
    const subscribedNotification = roomList.some(
      (r) =>
        r === "queue-null-notification" ||
        /^queue-\d+-notification$/.test(r)
    );

    socket.leave("queue-null-pending");
    socket.leave("queue-null-notification");

    const allow = allowsNullQueueVisibility(
      queueIds,
      allTicket,
      contingencyId
    );

    if (allow && subscribedPending) {
      socket.join("queue-null-pending");
    }
    if (allow && subscribedNotification) {
      socket.join("queue-null-notification");
    }
  }
}

export type { SocketUserMeta };
