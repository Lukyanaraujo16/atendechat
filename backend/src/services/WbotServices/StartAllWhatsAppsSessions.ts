import * as Sentry from "@sentry/node";
import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";
import { logger } from "../../utils/logger";

/**
 * Boot de sessões por empresa.
 * Cada conexão é despachada por connectionProvider em StartWhatsAppSession.
 * Falha em uma conexão (ex.: Evolution placeholder) não impede as demais.
 */
export const StartAllWhatsAppsSessions = async (
  companyId: number
): Promise<void> => {
  try {
    const whatsapps = await ListWhatsAppsService({ companyId });
    if (whatsapps.length > 0) {
      whatsapps.forEach(whatsapp => {
        StartWhatsAppSession(whatsapp, companyId).catch(err => {
          Sentry.captureException(err);
          logger.error(
            {
              err,
              companyId,
              whatsappId: whatsapp.id,
              connectionProvider: whatsapp.connectionProvider
            },
            "[Connection] falha ao iniciar sessão — demais conexões seguem"
          );
        });
      });
    }
  } catch (e) {
    Sentry.captureException(e);
  }
};
