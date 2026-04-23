import * as Sentry from "@sentry/node";
import makeWASocket, {
  WASocket,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  CacheStore,
  proto
} from "@whiskeysockets/baileys";
import makeWALegacySocket from "@whiskeysockets/baileys";
import P from "pino";

import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import authState from "../helpers/authState";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getIO } from "./socket";
import { Store } from "./store";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import NodeCache from 'node-cache';
import {
  clearUnavailablePresenceHeartbeat,
  logWhatsAppPresenceSocketConfig,
  sendGlobalUnavailablePresence,
  shouldMarkOnlineOnConnect,
  shouldRunUnavailableHeartbeat,
  shouldSendUnavailableOnConnect,
  startUnavailablePresenceHeartbeat
} from "../helpers/whatsappUnavailablePresence";

const loggerBaileys = P({ level: "error" });

type Session = WASocket & {
  id?: number;
  store?: Store;
};

const sessions: Session[] = [];

const retriesQrCodeMap = new Map<number, number>();

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

export const removeWbot = async (
  whatsappId: number,
  isLogout = true
): Promise<void> => {
  try {
    clearUnavailablePresenceHeartbeat(whatsappId);
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      if (isLogout) {
        sessions[sessionIndex].logout();
        sessions[sessionIndex].ws.close();
      }

      sessions.splice(sessionIndex, 1);
    }
  } catch (err) {
    logger.error(err);
  }
};

export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => {
    try {
      (async () => {
        const io = getIO();

        const whatsappUpdate = await Whatsapp.findOne({
          where: { id: whatsapp.id, companyId: whatsapp.companyId }
        });

        if (!whatsappUpdate) return;

        const { id, name, provider } = whatsappUpdate;

        const { version, isLatest } = await fetchLatestBaileysVersion();
        const isLegacy = provider === "stable" ? true : false;

        logger.info(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
        logger.info(`isLegacy: ${isLegacy}`);
        logger.info(
          `[Connection] event=init_socket name=${name} whatsappId=${id} companyId=${whatsapp.companyId}`
        );
        let retriesQrCode = 0;

        let wsocket: Session = null;
        // const store = makeInMemoryStore({
        //   logger: loggerBaileys
        // });

        const { state, saveState } = await authState(whatsapp);

        const msgRetryCounterCache = new NodeCache();
        const userDevicesCache: CacheStore = new NodeCache();

        logWhatsAppPresenceSocketConfig({
          whatsappId: id,
          companyId: whatsapp.companyId,
          sessionName: name,
          phase: "makeWASocket"
        });

        wsocket = makeWASocket({
          logger: loggerBaileys,
          printQRInTerminal: false,
          browser: Browsers.appropriate("Desktop"),
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
          },
          version,
          markOnlineOnConnect: shouldMarkOnlineOnConnect(),
          syncFullHistory: true,
          msgRetryCounterCache,
          shouldIgnoreJid: jid => isJidBroadcast(jid),
          patchMessageBeforeSending: (msg: any) => {
            if (!msg) return msg;
            const m = { ...msg };
            if (m.deviceSentMessage?.message?.listMessage?.listType === proto?.Message?.ListMessage?.ListType?.PRODUCT_LIST) {
              m.deviceSentMessage = m.deviceSentMessage || {};
              m.deviceSentMessage.message = m.deviceSentMessage.message || {};
              m.deviceSentMessage.message.listMessage = m.deviceSentMessage.message.listMessage || {};
              m.deviceSentMessage.message.listMessage.listType = proto.Message.ListMessage.ListType.SINGLE_SELECT;
            }
            if (m.listMessage?.listType === proto?.Message?.ListMessage?.ListType?.PRODUCT_LIST) {
              m.listMessage = m.listMessage || {};
              m.listMessage.listType = proto.Message.ListMessage.ListType.SINGLE_SELECT;
            }
            const requiresPatch = !!(m.buttonsMessage || m.listMessage || m.templateMessage);
            if (requiresPatch) {
              return {
                viewOnceMessage: {
                  message: {
                    messageContextInfo: {
                      deviceListMetadataVersion: 2,
                      deviceListMetadata: {},
                    },
                    ...m,
                  },
                },
              };
            }
            return m;
          },
        });

        wsocket.ev.on(
          "connection.update",
          async ({ connection, lastDisconnect, qr }) => {
            logger.info(
              `Socket  ${name} Connection Update ${connection || ""} ${lastDisconnect || ""
              }`
            );

            if (connection === "connecting") return;

            if (connection === "close") {
              const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
              if (statusCode === 440) {
                return;
              }
              const isLoggedOutOrInvalid = statusCode === DisconnectReason.loggedOut
                || statusCode === 402
                || statusCode === 403
                || statusCode === 405;

              if (isLoggedOutOrInvalid) {
                await whatsapp.update({ status: "PENDING", session: "" });
                await DeleteBaileysService(whatsapp.id);
                io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
                removeWbot(id, false);
              } else {
                removeWbot(id, false);
              }
              setTimeout(
                () => StartWhatsAppSession(whatsapp, whatsapp.companyId),
                2000
              );
            }

            if (connection === "open") {
              logWhatsAppPresenceSocketConfig({
                whatsappId: id,
                companyId: whatsapp.companyId,
                sessionName: name,
                phase: "connection_open"
              });
              logger.info(
                `[Connection] event=connected whatsappId=${id} companyId=${whatsapp.companyId} name=${name}`
              );
              await whatsapp.update({
                status: "CONNECTED",
                qrcode: "",
                retries: 0
              });

              io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-whatsappSession`, {
                action: "update",
                session: whatsapp
              });

              const sessionIndex = sessions.findIndex(
                s => s.id === whatsapp.id
              );
              if (sessionIndex === -1) {
                wsocket.id = whatsapp.id;
                sessions.push(wsocket);
              }

              if (shouldSendUnavailableOnConnect()) {
                await sendGlobalUnavailablePresence(wsocket, {
                  whatsappId: id,
                  companyId: whatsapp.companyId,
                  sessionName: name
                }, "connect");
              }
              if (shouldRunUnavailableHeartbeat()) {
                startUnavailablePresenceHeartbeat(wsocket, {
                  whatsappId: id,
                  companyId: whatsapp.companyId,
                  sessionName: name
                });
              }

              resolve(wsocket);
            }

            if (qr !== undefined) {
              if (retriesQrCodeMap.get(id) && retriesQrCodeMap.get(id) >= 3) {
                await whatsappUpdate.update({
                  status: "DISCONNECTED",
                  qrcode: ""
                });
                await DeleteBaileysService(whatsappUpdate.id);
                io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsappUpdate
                });
                wsocket.ev.removeAllListeners("connection.update");
                wsocket.ws.close();
                wsocket = null;
                retriesQrCodeMap.delete(id);
              } else {
                logger.info(
                  `[Connection] event=qr_generated whatsappId=${id} companyId=${whatsapp.companyId} name=${name}`
                );
                retriesQrCodeMap.set(id, (retriesQrCode += 1));

                await whatsapp.update({
                  qrcode: qr,
                  status: "qrcode",
                  retries: 0
                });
                const sessionIndex = sessions.findIndex(
                  s => s.id === whatsapp.id
                );

                if (sessionIndex === -1) {
                  wsocket.id = whatsapp.id;
                  sessions.push(wsocket);
                }

                io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
              }
            }
          }
        );
        wsocket.ev.on("creds.update", saveState);

        //store.bind(wsocket.ev);
      })();
    } catch (error) {
      Sentry.captureException(error);
      console.log(error);
      reject(error);
    }
  });
};
