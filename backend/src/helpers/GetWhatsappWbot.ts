import { getWbot } from "../libs/wbot";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import {
  isEvolutionConnection,
  resolveWhatsAppConnectionProvider
} from "../modules/whatsapp/connectionProvider";
import { ERR_WHATSAPP_PROVIDER_NOT_BAILEYS } from "../modules/whatsapp/providers/evolution/evolutionErrors";

/**
 * Helper Baileys-specific: retorna WASocket da conexão.
 * Não usar para Evolution — preferir resolveWhatsAppOutbound.
 */
const GetWhatsappWbot = async (whatsapp: Whatsapp) => {
  if (isEvolutionConnection(resolveWhatsAppConnectionProvider(whatsapp))) {
    throw new AppError(
      ERR_WHATSAPP_PROVIDER_NOT_BAILEYS,
      400,
      "GetWhatsappWbot é exclusivo Baileys. Use o resolver multi-provider."
    );
  }

  const wbot = await getWbot(whatsapp.id);
  return wbot;
};

export default GetWhatsappWbot;
