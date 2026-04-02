import {
  WASocket,
  Contact as BContact
} from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";

import { Store } from "../../libs/store";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import createOrUpdateBaileysService from "../BaileysServices/CreateOrUpdateBaileysService";
import Company from "../../models/Company";

type Session = WASocket & {
  id?: number;
  store?: Store;
};

/** Mensagem padrão quando `callRejectMessage` está vazio (idioma da empresa). */
const DEFAULT_CALL_REJECT_MESSAGES: Record<string, string> = {
  pt: "*Mensagem automática*\n\nEste número não recebe chamadas. Envie uma mensagem de texto que responderemos por aqui.",
  en: "*Automatic message*\n\nThis number does not accept calls. Please send a text message and we will reply here.",
  es: "*Mensaje automático*\n\nEste número no recibe llamadas. Envíe un mensaje de texto y responderemos aquí."
};

async function resolveCallRejectText(companyId: number): Promise<string> {
  const custom = await Setting.findOne({
    where: { key: "callRejectMessage", companyId }
  });
  const trimmed = custom?.value != null ? String(custom.value).trim() : "";
  if (trimmed.length > 0) {
    return trimmed;
  }
  const company = await Company.findByPk(companyId);
  const lang = company?.language || "pt";
  const key = ["pt", "en", "es"].includes(lang) ? lang : "pt";
  return DEFAULT_CALL_REJECT_MESSAGES[key];
}

async function shouldSendCallRejectMessage(companyId: number): Promise<boolean> {
  const s = await Setting.findOne({
    where: { key: "callRejectSendMessage", companyId }
  });
  if (!s) {
    return true;
  }
  return s.value !== "disabled";
}

const wbotMonitor = async (
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  try {
    wbot.ev.on("call", async (calls: unknown) => {
      const list = calls as Array<{
        status: string;
        id: string;
        from: string;
        chatId: string;
        isGroup?: boolean;
      }>;
      const call = list?.[0];
      if (!call || call.status !== "offer") {
        return;
      }
      if (call.isGroup) {
        return;
      }

      const callSetting = await Setting.findOne({
        where: { key: "call", companyId }
      });

      if (!callSetting || callSetting.value !== "disabled") {
        return;
      }

      try {
        await wbot.rejectCall(call.id, call.from);
        logger.info(
          { companyId, sessionId: wbot.id, callId: call.id },
          "[call] chamada recebida rejeitada (configuração da empresa)"
        );
      } catch (err) {
        Sentry.captureException(err);
        logger.error(
          { err, companyId, callId: call.id },
          "[call] falha ao rejeitar chamada"
        );
      }

      if (!(await shouldSendCallRejectMessage(companyId))) {
        return;
      }

      try {
        const text = await resolveCallRejectText(companyId);
        await wbot.sendMessage(call.chatId, { text });
      } catch (err) {
        Sentry.captureException(err);
        logger.error(
          { err, companyId },
          "[call] falha ao enviar mensagem após rejeitar"
        );
      }
    });

    wbot.ev.on("contacts.upsert", async (contacts: BContact[]) => {
      await createOrUpdateBaileysService({
        whatsappId: whatsapp.id,
        contacts
      });
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
};

export default wbotMonitor;
