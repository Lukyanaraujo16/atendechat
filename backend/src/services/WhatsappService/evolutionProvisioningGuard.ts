import AppError from "../../errors/AppError";
import { ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED } from "../../modules/whatsapp/providers/evolution/evolutionErrors";

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
 * Guard de CREATE Evolution: rejeita payload técnico do cliente.
 * Autorização de quem pode criar conexão é a rota settings.connections.
 * createdByUserId permanece no input por compatibilidade; identidade não é gate.
 */
export async function assertEvolutionCentralProvisionAllowed(input: {
  createdByUserId?: number | null;
  evolution?: EvolutionConfigInput | null;
}): Promise<void> {
  if (hasEvolutionTechnicalPayloadFields(input.evolution)) {
    throw new AppError(
      ERR_EVOLUTION_TECHNICAL_FIELDS_NOT_ALLOWED,
      400,
      "Credenciais Evolution não podem ser enviadas pelo cliente. Use provisionamento central."
    );
  }
}
