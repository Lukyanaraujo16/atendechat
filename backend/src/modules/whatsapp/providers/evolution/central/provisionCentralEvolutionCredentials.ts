import WhatsappEvolutionCredential from "../../../../../models/WhatsappEvolutionCredential";
import { upsertWhatsappEvolutionCredentials } from "../../../../../services/WhatsappService/evolutionCredentialsService";
import { generateEvolutionInstanceName } from "./generateEvolutionInstanceName";
import { requireEvolutionCentralConfig } from "./evolutionCentralConfig";

export type ProvisionCentralEvolutionResult = {
  instanceName: string;
  credential: WhatsappEvolutionCredential;
};

/**
 * Provisiona credencial Evolution por conexão a partir da config central.
 * Persiste baseUrl/apiKey cifrados na row — lifecycle/messaging leem por whatsappId.
 */
export async function provisionCentralEvolutionCredentials(input: {
  companyId: number;
  whatsappId: number;
}): Promise<ProvisionCentralEvolutionResult> {
  const central = requireEvolutionCentralConfig();
  const instanceName = generateEvolutionInstanceName({
    companyId: input.companyId,
    whatsappId: input.whatsappId
  });

  const credential = await upsertWhatsappEvolutionCredentials({
    companyId: input.companyId,
    whatsappId: input.whatsappId,
    baseUrl: central.baseUrl,
    instanceName,
    instanceId: null,
    apiKey: central.apiKey
  });

  return { instanceName, credential };
}

/**
 * BYO (Bring Your Own) — caminho arquitetural preservado para clientes especiais.
 * Não exposto ao caller HTTP nesta fase; uso interno/futuro privilegiado.
 */
export async function provisionByoEvolutionCredentials(input: {
  companyId: number;
  whatsappId: number;
  baseUrl: string;
  instanceName: string;
  apiKey: string;
  instanceId?: string | null;
}): Promise<WhatsappEvolutionCredential> {
  return upsertWhatsappEvolutionCredentials(input);
}
