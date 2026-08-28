import { assertSafeEvolutionInstanceName } from "../lifecycle/ensureEvolutionInstance";

/**
 * Gera instanceName técnico e único por conexão StreamHub.
 * Formato: streamhub-c{companyId}-w{whatsappId}
 * Sem PII, sem secrets — apenas IDs internos.
 */
export function generateEvolutionInstanceName(input: {
  companyId: number;
  whatsappId: number;
}): string {
  const companyId = Number(input.companyId);
  const whatsappId = Number(input.whatsappId);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    throw new Error("invalid_company_id_for_instance_name");
  }
  if (!Number.isFinite(whatsappId) || whatsappId <= 0) {
    throw new Error("invalid_whatsapp_id_for_instance_name");
  }
  const raw = `streamhub-c${companyId}-w${whatsappId}`;
  return assertSafeEvolutionInstanceName(raw);
}
