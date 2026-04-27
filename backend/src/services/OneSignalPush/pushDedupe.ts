import { setNx } from "../../libs/cache";
import { logger } from "../../utils/logger";

const KEY_PREFIX = "os_push_dedupe:";

/**
 * Evita envio duplicado: devolve true se este envio deve prosseguir (lock criado).
 */
export async function acquireTicketPushDedupe(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  try {
    return await setNx(`${KEY_PREFIX}${key}`, "1", ttlSeconds);
  } catch (err) {
    logger.warn(
      { err },
      "[OneSignalPush] dedupe Redis indisponível — envio não bloqueado por dedupe"
    );
    return true;
  }
}
