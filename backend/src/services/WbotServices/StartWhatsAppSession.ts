import { initWASocket } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import { logger } from "../../utils/logger";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  if (Number(whatsapp.companyId) !== Number(companyId)) {
    logger.warn(
      `[Connection] event=company_mismatch whatsappId=${whatsapp.id} wCompany=${whatsapp.companyId} reqCompany=${companyId}`
    );
    throw new AppError("ERR_FORBIDDEN", 403);
  }

  console.info(
    "[Connection]",
    JSON.stringify({
      event: "session_start",
      companyId,
      whatsappId: whatsapp.id,
      name: whatsapp.name
    })
  );

  await whatsapp.update({ status: "OPENING" });

  const io = getIO();
  io.to(`company-${whatsapp.companyId}-mainchannel`).emit(`company-${whatsapp.companyId}-whatsappSession`, {
    action: "update",
    session: whatsapp
  });

  try {
    const wbot = await initWASocket(whatsapp);
    logger.info(
      `[WhatsAppInbound] session_listener_attaching whatsappId=${whatsapp.id} companyId=${companyId} (reconexão reancora messages.upsert no novo socket)`
    );
    wbotMessageListener(wbot, companyId);
    wbotMonitor(wbot, whatsapp, companyId);
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
};
