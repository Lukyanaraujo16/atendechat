import { proto } from "@whiskeysockets/baileys";
import { NormalizedWhatsAppMessage } from "../../../inbound/NormalizedWhatsAppMessage";

/**
 * Isola o acesso residual a proto.IWebMessageInfo.
 * Não usar como caminho principal — o domínio deve ler o DTO.
 */
export function requireBaileysRawMessage(
  inbound: NormalizedWhatsAppMessage
): proto.IWebMessageInfo {
  if (inbound.rawProviderMessage == null) {
    throw new Error(
      "NormalizedWhatsAppMessage.rawProviderMessage ausente (compatibilidade transitória Fase 3)"
    );
  }
  return inbound.rawProviderMessage as proto.IWebMessageInfo;
}
