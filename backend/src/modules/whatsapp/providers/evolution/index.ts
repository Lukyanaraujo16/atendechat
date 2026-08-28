import { logger } from "../../../../utils/logger";
import Whatsapp from "../../../../models/Whatsapp";
import {
  EVOLUTION_PHASE5_CAPABILITIES,
  EvolutionProviderNotReadyError
} from "./types";
import { startEvolutionWhatsAppSession } from "./lifecycle/startEvolutionWhatsAppSession";

/**
 * Entry point lifecycle Evolution (Fase 10).
 * Nunca chama initWASocket / session Baileys.
 */
export async function startEvolutionWhatsAppSessionEntry(
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> {
  logger.info(
    {
      event: "evolution_session_start",
      companyId,
      whatsappId: whatsapp.id,
      connectionProvider: "evolution",
      capabilities: EVOLUTION_PHASE5_CAPABILITIES
    },
    "[Evolution] starting lifecycle session"
  );
  await startEvolutionWhatsAppSession(whatsapp, companyId);
}

/** @deprecated alias Fase 5 — mantido para imports de teste legados. */
export const startEvolutionWhatsAppSessionPlaceholder =
  startEvolutionWhatsAppSessionEntry;

export function assertEvolutionTransportNotAvailable(): never {
  throw new EvolutionProviderNotReadyError();
}

export {
  EVOLUTION_PHASE5_CAPABILITIES,
  EvolutionProviderNotReadyError
} from "./types";
export { EvolutionWhatsAppOutbound } from "./outbound/EvolutionWhatsAppOutbound";
export { startEvolutionWhatsAppSession } from "./lifecycle/startEvolutionWhatsAppSession";
export { logoutEvolutionWhatsAppSession } from "./lifecycle/logoutEvolutionSession";
export { ensureEvolutionInstance } from "./lifecycle/ensureEvolutionInstance";
export * from "./evolutionErrors";
