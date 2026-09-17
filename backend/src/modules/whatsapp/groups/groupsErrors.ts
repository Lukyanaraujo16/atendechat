import AppError from "../../../errors/AppError";

export const ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY =
  "ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY";

export function throwWhatsAppGroupsProviderNotReady(detail?: string): never {
  throw new AppError(
    ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY,
    503,
    detail || "Gestão de grupos deste provider ainda não está disponível."
  );
}
