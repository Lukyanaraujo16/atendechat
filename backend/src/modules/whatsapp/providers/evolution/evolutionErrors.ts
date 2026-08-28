import AppError from "../../../../errors/AppError";
import { EvolutionProviderNotReadyError } from "./types";

export const ERR_WHATSAPP_PROVIDER_NOT_READY =
  "ERR_WHATSAPP_PROVIDER_NOT_READY";

export const ERR_WHATSAPP_CONNECTION_PROVIDER_IMMUTABLE =
  "ERR_WHATSAPP_CONNECTION_PROVIDER_IMMUTABLE";

export const ERR_WHATSAPP_CONNECTION_PROVIDER_INVALID =
  "ERR_WHATSAPP_CONNECTION_PROVIDER_INVALID";

/** Fase 10.5 — provisionamento central Evolution */
export const ERR_EVOLUTION_PROVISION_FORBIDDEN =
  "ERR_EVOLUTION_PROVISION_FORBIDDEN";
export const ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED =
  "ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED";
export const ERR_EVOLUTION_CENTRAL_CONFIG_MISSING =
  "ERR_EVOLUTION_CENTRAL_CONFIG_MISSING";
export const ERR_EVOLUTION_CENTRAL_CONFIG_INVALID =
  "ERR_EVOLUTION_CENTRAL_CONFIG_INVALID";

export const ERR_WHATSAPP_PROVIDER_NOT_BAILEYS =
  "ERR_WHATSAPP_PROVIDER_NOT_BAILEYS";

export function throwEvolutionProviderNotReady(detail?: string): never {
  throw new AppError(
    ERR_WHATSAPP_PROVIDER_NOT_READY,
    503,
    detail ||
      "Provider Evolution ainda não está disponível para transporte. Use Baileys ou aguarde a próxima fase."
  );
}

export function toAppErrorFromEvolution(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof EvolutionProviderNotReadyError) {
    return new AppError(ERR_WHATSAPP_PROVIDER_NOT_READY, 503, err.message);
  }
  throw err;
}
