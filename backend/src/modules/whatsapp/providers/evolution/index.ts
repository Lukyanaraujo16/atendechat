import { logger } from "../../../../utils/logger";
import { getIO } from "../../../../libs/socket";
import Whatsapp from "../../../../models/Whatsapp";
import {
  EVOLUTION_PHASE5_CAPABILITIES,
  EvolutionProviderNotReadyError
} from "./types";

/**
 * Lifecycle Evolution — placeholder Fase 5.
 * Nunca chama initWASocket / session Baileys.
 */
export async function startEvolutionWhatsAppSessionPlaceholder(
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> {
  logger.info(
    {
      event: "evolution_session_start_deferred",
      companyId,
      whatsappId: whatsapp.id,
      connectionProvider: "evolution",
      capabilities: EVOLUTION_PHASE5_CAPABILITIES
    },
    "[Evolution] transporte ainda não implementado — sessão não iniciada"
  );

  // Estado controlado: não CONNECTED, não OPENING (evita UI Baileys/QR).
  // DISCONNECTED = configurada/conhecida sem transporte ativo.
  if (whatsapp.status === "OPENING" || whatsapp.status === "qrcode") {
    await whatsapp.update({ status: "DISCONNECTED" });
  }

  const io = getIO();
  io.to(`company-${whatsapp.companyId}-mainchannel`).emit(
    `company-${whatsapp.companyId}-whatsappSession`,
    {
      action: "update",
      session: whatsapp
    }
  );
}

export function assertEvolutionTransportNotAvailable(): never {
  throw new EvolutionProviderNotReadyError();
}

export {
  EVOLUTION_PHASE5_CAPABILITIES,
  EvolutionProviderNotReadyError
} from "./types";
export { EvolutionWhatsAppOutbound } from "./outbound/EvolutionWhatsAppOutbound";
export * from "./evolutionErrors";
