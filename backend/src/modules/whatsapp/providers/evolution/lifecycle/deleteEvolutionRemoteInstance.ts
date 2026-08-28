import { logger } from "../../../../../utils/logger";
import {
  EvolutionHttpError,
  evolutionDeleteInstance
} from "../inbound/evolutionHttpClient";

/**
 * Política Fase 10 — delete conexão StreamHub:
 * best-effort DELETE /instance/delete/{instance} ANTES do destroy local.
 * Falha remota NÃO impede remoção local (documentado).
 * Nunca silencioso sem log.
 */
export async function deleteEvolutionRemoteInstanceBestEffort(
  whatsappId: number
): Promise<{ attempted: boolean; ok: boolean; reason?: string }> {
  try {
    await evolutionDeleteInstance({ whatsappId });
    logger.info(
      { whatsappId, operation: "delete_instance", ok: true },
      "[EvolutionLifecycle] remote instance deleted"
    );
    return { attempted: true, ok: true };
  } catch (err) {
    const code =
      err instanceof EvolutionHttpError ? err.code : "ERR_EVOLUTION_DELETE";
    const msg = err instanceof Error ? err.message.slice(0, 200) : "unknown";
    logger.warn(
      { whatsappId, operation: "delete_instance", code, msg },
      "[EvolutionLifecycle] remote delete failed (local delete proceeds)"
    );
    return { attempted: true, ok: false, reason: code };
  }
}
