import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import {
  isBaileysConnection,
  resolveWhatsAppConnectionProvider
} from "../../modules/whatsapp/connectionProvider";
import { invalidateCompanyActivationCache } from "../../helpers/companyActivation";
import { logger } from "../../utils/logger";

// Sob demanda: libs/wbot carrega o Baileys (ESM), desnecessário para quem só importa o controller.
/* eslint-disable global-require, @typescript-eslint/no-var-requires */
const loadWbot = (): typeof import("../../libs/wbot") =>
  require("../../libs/wbot");
const loadStartAll =
  (): typeof import("../WbotServices/StartAllWhatsAppsSessions") =>
    require("../WbotServices/StartAllWhatsAppsSessions");
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

/**
 * Efeitos da desativação administrativa: dados preservados; acessos e operações interrompidos.
 * - Sessões dos usuários invalidadas (tokenVersion) — o access token restante expira em 15 min.
 * - Sockets Baileys fechados sem logout; StartWhatsAppSession recusa reconexão.
 * - Evolution permanece pareada; webhooks e envios são recusados pela guarda central.
 */
export async function applyCompanyDeactivation(
  companyId: number
): Promise<void> {
  invalidateCompanyActivationCache(companyId);
  await User.increment(
    { tokenVersion: 1 },
    { where: { companyId, super: false } }
  );

  const whatsapps = await Whatsapp.findAll({ where: { companyId } });
  const closed = whatsapps
    .filter(w => isBaileysConnection(resolveWhatsAppConnectionProvider(w)))
    .filter(w => loadWbot().closeWbotWithoutLogout(w.id)).length;
  logger.info(
    { companyId, closedSessions: closed },
    "[CompanyActivation] empresa desativada"
  );
}

/** Reativação: libera acesso e reinicia as conexões já cadastradas (regras de assinatura seguem no billing). */
export async function applyCompanyReactivation(
  companyId: number
): Promise<void> {
  invalidateCompanyActivationCache(companyId);
  await loadStartAll().StartAllWhatsAppsSessions(companyId);
  logger.info({ companyId }, "[CompanyActivation] empresa reativada");
}
