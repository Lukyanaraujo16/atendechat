import Whatsapp from "../../../models/Whatsapp";
import {
  isBaileysConnection,
  isEvolutionConnection,
  resolveWhatsAppConnectionProvider
} from "../connectionProvider";
import { throwWhatsAppGroupsProviderNotReady } from "./groupsErrors";
import { WhatsAppGroupsProvider } from "./WhatsAppGroupsProvider";
import { BaileysGroupsProvider } from "../providers/baileys/groups/BaileysGroupsProvider";
import { EvolutionGroupsProvider } from "../providers/evolution/groups/EvolutionGroupsProvider";

/**
 * Resolução da gestão de grupos por conexão.
 * Baileys → socket. Evolution → HTTP 2.3.7. Nunca getWbot em Evolution.
 */
export async function getWhatsAppGroupsProviderForWhatsapp(
  whatsapp: Whatsapp
): Promise<WhatsAppGroupsProvider> {
  const provider = resolveWhatsAppConnectionProvider(whatsapp);

  if (isEvolutionConnection(provider)) {
    return EvolutionGroupsProvider.fromWhatsapp(whatsapp);
  }

  if (!isBaileysConnection(provider)) {
    throwWhatsAppGroupsProviderNotReady(
      `Gestão de grupos não suportada para o provider: ${provider}`
    );
  }

  return BaileysGroupsProvider.fromWhatsappId(whatsapp.id);
}
