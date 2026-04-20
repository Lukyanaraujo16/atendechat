import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { SendMessage } from "../../helpers/SendMessage";
import { logger } from "../../utils/logger";

export type BillingWhatsAppSendResult = {
  sent: boolean;
  destinationDigits?: string;
  error?: string;
  skippedReason?: "no_phone" | "send_failed";
};

/**
 * Envia texto simples via sessão WhatsApp padrão de `senderCompanyId` (empresa operadora / matriz).
 * Não valida existência do número no WhatsApp (evita chamada extra); falhas ficam no resultado.
 */
export async function trySendBillingWhatsAppWarning(params: {
  senderCompanyId: number;
  destinationPhone: string | null | undefined;
  body: string;
}): Promise<BillingWhatsAppSendResult> {
  const digits = String(params.destinationPhone || "").replace(/\D/g, "");
  if (digits.length < 10) {
    return {
      sent: false,
      skippedReason: "no_phone",
      error: "sem_telefone_empresa"
    };
  }

  try {
    const whatsapp = await GetDefaultWhatsApp(params.senderCompanyId);
    await SendMessage(whatsapp, { number: digits, body: params.body });
    return { sent: true, destinationDigits: digits };
  } catch (err: any) {
    const msg =
      err?.message != null
        ? String(err.message).slice(0, 280)
        : "whatsapp_send_failed";
    logger.warn(
      { err, senderCompanyId: params.senderCompanyId },
      "trySendBillingWhatsAppWarning failed"
    );
    return {
      sent: false,
      destinationDigits: digits,
      skippedReason: "send_failed",
      error: msg
    };
  }
}
