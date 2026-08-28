import AppError from "../../errors/AppError";
import { canProvisionEvolutionConnection } from "../../helpers/canProvisionEvolutionConnection";
import {
  ERR_EVOLUTION_PROVISION_FORBIDDEN,
  ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED
} from "../../modules/whatsapp/providers/evolution/evolutionErrors";

export type EvolutionConfigInput = {
  baseUrl?: string;
  instanceName?: string;
  instanceId?: string | null;
  apiKey?: string;
};

export function hasEvolutionTechnicalPayloadFields(
  evolution?: EvolutionConfigInput | null
): boolean {
  if (!evolution || typeof evolution !== "object") {
    return false;
  }
  const fields = [
    evolution.baseUrl,
    evolution.instanceName,
    evolution.apiKey,
    evolution.instanceId
  ];
  return fields.some(v => v != null && String(v).trim() !== "");
}

/**
 * Valida gate Evolution central (Fase 10.5).
 * Tenant não pode solicitar Evolution; payload técnico é rejeitado.
 */
export async function assertEvolutionCentralProvisionAllowed(input: {
  createdByUserId: number | null | undefined;
  evolution?: EvolutionConfigInput | null;
}): Promise<void> {
  if (hasEvolutionTechnicalPayloadFields(input.evolution)) {
    throw new AppError(
      ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED,
      400,
      "Credenciais Evolution não podem ser enviadas pelo cliente. Use provisionamento central."
    );
  }

  const allowed = await canProvisionEvolutionConnection(input.createdByUserId);
  if (!allowed) {
    throw new AppError(
      ERR_EVOLUTION_PROVISION_FORBIDDEN,
      403,
      "Provisionamento Evolution restrito à plataforma StreamHub."
    );
  }
}
