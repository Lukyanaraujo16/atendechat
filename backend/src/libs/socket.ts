import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import User from "../models/User";
import Queue from "../models/Queue";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";
import { CounterManager } from "./counter";
import {
  assertUserCanAccessTicketResource,
  toTicketAccessPayload
} from "../helpers/ticketAccess";
import { isTruthySupportMode } from "../helpers/groupVisibility";

let io: SocketIO;

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: "*",
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
    },
    allowEIO3: true,
    transports: ['websocket', 'polling']
  });

  io.on("connection", async socket => {
    logger.info("Client Connected");
    const { token } = socket.handshake.query;
    let tokenData = null;
    try {
      tokenData = verify(token as string, authConfig.secret);
      logger.debug(tokenData, "io-onConnection: tokenData");
    } catch (error) {
      logger.warn(`[libs/socket.ts] Error decoding token: ${error?.message}`);
      socket.disconnect();
      return io;
    }
    const counters = new CounterManager();

    let user: User = null;
    let userId = tokenData.id;

    if (userId && userId !== "undefined" && userId !== "null") {
      user = await User.findByPk(userId, { include: [ Queue ] });
      if (user) {
        user.online = true;
        await user.save();
      } else {
        logger.info(`onConnect: User ${userId} not found`);
        socket.disconnect();
        return io;
      }
    } else {
      logger.info("onConnect: Missing userId");
      socket.disconnect();
      return io;
    }

    /** Sala alinhada ao JWT (empresa efetiva), p.ex. modo suporte; não só user.companyId da BD. */
    const jwtPayload = tokenData as {
      id?: string | number;
      profile?: string;
      companyId?: number;
      supportMode?: boolean;
    };
    const effectiveCompanyIdForSocket =
      jwtPayload.companyId !== undefined && jwtPayload.companyId !== null
        ? Number(jwtPayload.companyId)
        : user.companyId;
    const socketActor = {
      id: jwtPayload.id ?? user.id,
      profile: jwtPayload.profile ?? user.profile,
      supportMode:
        isTruthySupportMode(jwtPayload.supportMode) ||
        isTruthySupportMode((user as any).supportMode)
    };

    socket.join(`user-${user.id}`);
    if (user.super) {
      socket.join("platform-super-admins");
    }
    const effCompany = effectiveCompanyIdForSocket;
    if (
      effCompany !== undefined &&
      effCompany !== null &&
      !Number.isNaN(Number(effCompany))
    ) {
      socket.join(`company-${effCompany}-mainchannel`);
    }

    socket.on("joinChatBox", async (ticketId: string) => {
      if (!ticketId || ticketId === "undefined") {
        return;
      }
      try {
        const ticket = await Ticket.findByPk(ticketId, {
          include: [
            {
              model: Contact,
              as: "contact",
              attributes: ["id", "isGroup", "groupVisible", "companyId"]
            },
            {
              model: Whatsapp,
              as: "whatsapp",
              attributes: ["ticketVisibility"],
              required: false
            }
          ]
        });

        if (!ticket) {
          logger.info(
            `Invalid attempt to join channel of ticket ${ticketId} by user ${user.id} (not found)`
          );
          return;
        }

        const effCid = Number(effectiveCompanyIdForSocket);
        if (
          !Number.isFinite(effCid) ||
          Number(ticket.companyId) !== effCid
        ) {
          logger.info(
            `Invalid attempt to join channel of ticket ${ticketId} by user ${user.id} (company mismatch)`
          );
          return;
        }

        await assertUserCanAccessTicketResource(
          socketActor,
          toTicketAccessPayload(ticket),
          effCid,
          "socket.joinChatBox"
        );

        let c: number;
        if ((c = counters.incrementCounter(`ticket-${ticketId}`)) === 1) {
          socket.join(ticketId);
        }
        logger.debug(
          `joinChatbox[${c}]: Channel: ${ticketId} by user ${user.id}`
        );
      } catch (error) {
        logger.info(
          `Invalid attempt to join channel of ticket ${ticketId} by user ${user.id}`
        );
        logger.debug(
          { err: error instanceof Error ? error.message : String(error) },
          "[socket] joinChatBox denied"
        );
      }
    });
    
    socket.on("leaveChatBox", async (ticketId: string) => {
      if (!ticketId || ticketId === "undefined") {
        return;
      }

      let c: number;
      // o último que sair apaga a luz

      if ((c = counters.decrementCounter(`ticket-${ticketId}`)) === 0) {
        socket.leave(ticketId);
      }
      logger.debug(`leaveChatbox[${c}]: Channel: ${ticketId} by user ${user.id}`)
    });

    socket.on("joinNotification", async () => {
      let c: number;
      if ((c = counters.incrementCounter("notification")) === 1) {
        if (user.profile === "admin") {
          socket.join(`company-${effectiveCompanyIdForSocket}-notification`);
        } else {
          user.queues.forEach((queue) => {
            logger.debug(`User ${user.id} of company ${user.companyId} joined queue ${queue.id} channel.`);
            socket.join(`queue-${queue.id}-notification`);
          });
          if (user.allTicket === "enabled") {
            socket.join("queue-null-notification");
          }

        }
      }
      logger.debug(`joinNotification[${c}]: User: ${user.id}`);
    });
    
    socket.on("leaveNotification", async () => {
      let c: number;
      if ((c = counters.decrementCounter("notification")) === 0) {
        if (user.profile === "admin") {
          socket.leave(`company-${effectiveCompanyIdForSocket}-notification`);
        } else {
          user.queues.forEach((queue) => {
            logger.debug(`User ${user.id} of company ${user.companyId} leaved queue ${queue.id} channel.`);
            socket.leave(`queue-${queue.id}-notification`);
          });
          if (user.allTicket === "enabled") {
            socket.leave("queue-null-notification");
          }
        }
      }
      logger.debug(`leaveNotification[${c}]: User: ${user.id}`);
    });
 
    socket.on("joinTickets", (status: string) => {
      if (counters.incrementCounter(`status-${status}`) === 1) {
        if (user.profile === "admin") {
          logger.debug(`Admin ${user.id} of company ${effectiveCompanyIdForSocket} joined ${status} tickets channel.`);
          socket.join(`company-${effectiveCompanyIdForSocket}-${status}`);
        } else if (status === "pending") {
          user.queues.forEach((queue) => {
            logger.debug(`User ${user.id} of company ${user.companyId} joined queue ${queue.id} pending tickets channel.`);
            socket.join(`queue-${queue.id}-pending`);
          });
          if (user.allTicket === "enabled") {
            socket.join("queue-null-pending");
          }
        } else {
          logger.debug(`User ${user.id} cannot subscribe to ${status}`);
        }
      }
    });
    
    socket.on("leaveTickets", (status: string) => {
      if (counters.decrementCounter(`status-${status}`) === 0) {
        if (user.profile === "admin") {
          logger.debug(`Admin ${user.id} of company ${effectiveCompanyIdForSocket} leaved ${status} tickets channel.`);
          socket.leave(`company-${effectiveCompanyIdForSocket}-${status}`);
        } else if (status === "pending") {
          user.queues.forEach((queue) => {
            logger.debug(`User ${user.id} of company ${user.companyId} leaved queue ${queue.id} pending tickets channel.`);
            socket.leave(`queue-${queue.id}-pending`);
          });
          if (user.allTicket === "enabled") {
            socket.leave("queue-null-pending");
          }
        }
      }
    });
    
    socket.emit("ready");
  });
  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new AppError("Socket IO not initialized");
  }
  return io;
};
