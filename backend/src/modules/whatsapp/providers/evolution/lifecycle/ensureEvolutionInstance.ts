import WhatsappEvolutionCredential from "../../../../../models/WhatsappEvolutionCredential";
import { logger } from "../../../../../utils/logger";
import {
  EvolutionHttpError,
  evolutionCreateInstance,
  evolutionFetchInstances,
  evolutionSetWebhook,
  loadEvolutionCredential
} from "../inbound/evolutionHttpClient";
import { buildEvolutionWebhookUrl } from "./evolutionWebhookPublicUrl";

export type EnsureEvolutionInstanceResult = {
  created: boolean;
  reused: boolean;
  instanceName: string;
  instanceId: string | null;
};

/** Locks in-memory por whatsappId — evita create duplicado concorrente. */
const ensureLocks = new Map<number, Promise<EnsureEvolutionInstanceResult>>();

const INSTANCE_NAME_SAFE = /^[a-zA-Z0-9._-]{1,100}$/;

export function assertSafeEvolutionInstanceName(name: string): string {
  const trimmed = String(name || "").trim();
  if (!trimmed || !INSTANCE_NAME_SAFE.test(trimmed)) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_INVALID_INSTANCE_NAME",
      "instanceName Evolution inválido"
    );
  }
  if (
    trimmed.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\")
  ) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_INVALID_INSTANCE_NAME",
      "instanceName Evolution inválido"
    );
  }
  return trimmed;
}

function listFromFetch(data: unknown): Array<Record<string, unknown>> {
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.filter(
      (x): x is Record<string, unknown> =>
        Boolean(x) && typeof x === "object" && !Array.isArray(x)
    );
  }
  if (typeof data === "object") {
    const root = data as Record<string, unknown>;
    if (Array.isArray(root.instance)) {
      return listFromFetch(root.instance);
    }
    // single object response
    if (root.instanceName || root.name || root.instance) {
      return [root];
    }
  }
  return [];
}

function matchInstanceName(
  rows: Array<Record<string, unknown>>,
  instanceName: string
): Record<string, unknown> | null {
  const target = instanceName.toLowerCase();
  const found = rows.find(row => {
    const name = String(
      row.instanceName ||
        row.name ||
        (row.instance &&
          typeof row.instance === "object" &&
          (row.instance as { instanceName?: string }).instanceName) ||
        ""
    )
      .trim()
      .toLowerCase();
    return name === target;
  });
  return found || null;
}

function extractInstanceId(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  if (typeof row.instanceId === "string" && row.instanceId.trim()) {
    return row.instanceId.trim();
  }
  const inst = row.instance;
  if (inst && typeof inst === "object") {
    const id = (inst as { instanceId?: string }).instanceId;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

function isAlreadyExistsError(err: unknown): boolean {
  if (!(err instanceof EvolutionHttpError)) return false;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("already") ||
    msg.includes("exist") ||
    msg.includes("já existe") ||
    msg.includes("in use")
  );
}

async function ensureEvolutionInstanceUnlocked(
  whatsappId: number
): Promise<EnsureEvolutionInstanceResult> {
  const cred = await loadEvolutionCredential(whatsappId);
  const instanceName = assertSafeEvolutionInstanceName(cred.instanceName);
  const webhookUrl = buildEvolutionWebhookUrl(whatsappId);

  const fetched = await evolutionFetchInstances({
    whatsappId,
    instanceName
  });
  const existing = matchInstanceName(listFromFetch(fetched), instanceName);

  if (existing) {
    if (webhookUrl) {
      try {
        await evolutionSetWebhook({ whatsappId, webhookUrl });
      } catch (err) {
        logger.warn(
          {
            whatsappId,
            instanceName,
            code: err instanceof EvolutionHttpError ? err.code : "unknown"
          },
          "[EvolutionLifecycle] setWebhook on reuse failed (non-fatal)"
        );
      }
    }

    const instanceId = extractInstanceId(existing);
    if (instanceId) {
      await WhatsappEvolutionCredential.unscoped().update(
        { instanceId },
        { where: { whatsappId } }
      );
    }

    logger.info(
      { whatsappId, instanceName, created: false },
      "[EvolutionLifecycle] instance reused"
    );
    return {
      created: false,
      reused: true,
      instanceName,
      instanceId
    };
  }

  try {
    const created = await evolutionCreateInstance({
      whatsappId,
      instanceName,
      webhookUrl
    });
    const createdRec =
      created && typeof created === "object"
        ? (created as Record<string, unknown>)
        : null;
    const instanceId = extractInstanceId(createdRec);
    if (instanceId) {
      await WhatsappEvolutionCredential.unscoped().update(
        { instanceId },
        { where: { whatsappId } }
      );
    }
    logger.info(
      { whatsappId, instanceName, created: true },
      "[EvolutionLifecycle] instance created"
    );
    return {
      created: true,
      reused: false,
      instanceName,
      instanceId
    };
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      const again = await evolutionFetchInstances({
        whatsappId,
        instanceName
      });
      const row = matchInstanceName(listFromFetch(again), instanceName);
      if (row) {
        return {
          created: false,
          reused: true,
          instanceName,
          instanceId: extractInstanceId(row)
        };
      }
    }
    throw err;
  }
}

/**
 * Garante exatamente uma instância Evolution lógica para a conexão.
 * Reutiliza se existir; cria se ausente. Serializa concorrência por whatsappId.
 */
export async function ensureEvolutionInstance(
  whatsappId: number
): Promise<EnsureEvolutionInstanceResult> {
  const inflight = ensureLocks.get(whatsappId);
  if (inflight) {
    return inflight;
  }
  const run = ensureEvolutionInstanceUnlocked(whatsappId).finally(() => {
    ensureLocks.delete(whatsappId);
  });
  ensureLocks.set(whatsappId, run);
  return run;
}

/** Test helper — limpa locks. */
export function clearEnsureEvolutionInstanceLocks(): void {
  ensureLocks.clear();
}
