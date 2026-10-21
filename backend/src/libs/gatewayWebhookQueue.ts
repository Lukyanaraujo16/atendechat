import BullQueue, { Queue } from "bull";
import { logger } from "../utils/logger";

/**
 * Fila Bull 4 do webhook Efí (B3.3, PT-1). Só transporta jobs: o estado durável de cada
 * evento vive em `SaaSGatewayWebhookEvents` (PostgreSQL). Jobs são removidos ao terminar;
 * a recuperação (cron) republica o que estiver pendente no banco.
 *
 * Criada sob demanda: com o pipeline inativo (default) o processo não abre conexão Redis nova.
 */
export const GATEWAY_WEBHOOK_QUEUE_NAME = "SaaSGatewayWebhookEvents";
export const GATEWAY_WEBHOOK_JOB_NAME = "ProcessGatewayWebhookEvent";
/** Teto da publicação: Redis lento ou fora não segura a recepção nem a recuperação. */
export const GATEWAY_WEBHOOK_PUBLISH_TIMEOUT_MS = 1500;

export type GatewayWebhookJobData = { eventId: number };

let queue: Queue<GatewayWebhookJobData> | null = null;

export function getGatewayWebhookQueue(): Queue<GatewayWebhookJobData> {
  if (!queue) {
    queue = new BullQueue<GatewayWebhookJobData>(
      GATEWAY_WEBHOOK_QUEUE_NAME,
      process.env.REDIS_URI || "",
      {
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: true,
          attempts: 1
        }
      }
    );
    queue.on("error", err => {
      logger.warn({ err: (err as Error)?.message }, "[gatewayWebhook] queue_error");
    });
  }
  return queue;
}

/** Só para testes: troca a fila (ex.: Redis descartável) ou a zera. */
export function setGatewayWebhookQueueForTests(q: Queue<GatewayWebhookJobData> | null): void {
  queue = q;
}

/**
 * jobId por tentativa (`gwe-<id>-<attempts>`): a retentativa agendada pelo próprio job ativo
 * não colide com ele, e a republicação da mesma tentativa é deduplicada pelo Bull (PT-8).
 */
export function gatewayWebhookJobId(eventId: number, attempts: number): string {
  return `gwe-${eventId}-${attempts}`;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("publish_timeout")), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

/**
 * Publica o job de um evento. Nunca lança: falha do Redis deixa o evento pendente no banco,
 * e a recuperação republica (RF3.5, R-24). Retorna se a publicação foi confirmada.
 */
export async function publishGatewayWebhookEvent(
  eventId: number,
  attempts: number,
  delayMs = 0
): Promise<boolean> {
  try {
    await withTimeout(
      getGatewayWebhookQueue().add(
        GATEWAY_WEBHOOK_JOB_NAME,
        { eventId },
        {
          jobId: gatewayWebhookJobId(eventId, attempts),
          delay: Math.max(0, Math.floor(delayMs)),
          timeout: 120000
        }
      ),
      GATEWAY_WEBHOOK_PUBLISH_TIMEOUT_MS
    );
    return true;
  } catch (err) {
    logger.warn(
      { eventId, err: (err as Error)?.message },
      "[gatewayWebhook] publish_failed — evento segue pendente para a recuperação"
    );
    return false;
  }
}
