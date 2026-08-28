import AppError from "../../../../../errors/AppError";
import Whatsapp from "../../../../../models/Whatsapp";
import { logger } from "../../../../../utils/logger";
import {
  EvolutionHttpError,
  evolutionLogoutInstance
} from "../inbound/evolutionHttpClient";
import { applyEvolutionSessionStatus } from "./applyEvolutionSessionStatus";

/**
 * Logout Evolution — desconecta número da instância.
 * NÃO apaga instância nem credencial StreamHub.
 * DELETE /instance/logout/{instance}
 */
export async function logoutEvolutionWhatsAppSession(
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> {
  if (Number(whatsapp.companyId) !== Number(companyId)) {
    throw new AppError("ERR_FORBIDDEN", 403);
  }

  try {
    await evolutionLogoutInstance({ whatsappId: whatsapp.id });
  } catch (err) {
    const msg =
      err instanceof EvolutionHttpError ? err.message.toLowerCase() : "";
    // Já desconectado / close — tratar como sucesso benigno.
    const benign =
      msg.includes("not connected") ||
      msg.includes("close") ||
      msg.includes("already");
    if (!benign) {
      logger.warn(
        {
          whatsappId: whatsapp.id,
          companyId,
          operation: "logout",
          code: err instanceof EvolutionHttpError ? err.code : "unknown"
        },
        "[EvolutionLifecycle] logout API failed"
      );
      if (err instanceof EvolutionHttpError) {
        throw new AppError(
          err.code,
          err.code === "ERR_EVOLUTION_TIMEOUT" ? 504 : 502,
          "Falha ao desconectar sessão Evolution"
        );
      }
      throw new AppError("ERR_EVOLUTION_LOGOUT_FAILED", 502);
    }
  }

  await applyEvolutionSessionStatus({
    whatsapp,
    status: "DISCONNECTED",
    qrcode: "",
    force: true
  });
}
