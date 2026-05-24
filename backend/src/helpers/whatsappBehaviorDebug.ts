import { logger } from "../utils/logger";

const DEBUG_ENABLED = process.env.WHATSAPP_BEHAVIOR_DEBUG === "true";

export type BehaviorResolutionSource = "connection" | "global";

export type BehaviorResolutionLog = {
  companyId: number;
  whatsappId?: number | null;
  field?: string;
  source?: BehaviorResolutionSource;
  inherited?: boolean;
  context?: string;
};

export function logBehaviorResolution(payload: BehaviorResolutionLog): void {
  if (!DEBUG_ENABLED) {
    return;
  }
  logger.debug(
    {
      companyId: payload.companyId,
      whatsappId: payload.whatsappId ?? null,
      field: payload.field ?? null,
      source: payload.source ?? null,
      inherited: payload.inherited ?? null,
      context: payload.context ?? null
    },
    "[WhatsappBehavior] resolution"
  );
}

export function logBehaviorPatchApplied(payload: {
  companyId: number;
  whatsappId: number;
  fields: string[];
}): void {
  if (!DEBUG_ENABLED) {
    return;
  }
  logger.debug(
    {
      companyId: payload.companyId,
      whatsappId: payload.whatsappId,
      fields: payload.fields
    },
    "[WhatsappBehavior] patch applied"
  );
}

export type MessageSettingsRuntimeMetrics = {
  resolutions: number;
  totalMs: number;
};

export function createMessageSettingsTracker(): {
  noteResolution: (durationMs: number) => void;
  getMetrics: () => MessageSettingsRuntimeMetrics;
  finish: (payload: {
    companyId: number;
    messageId?: string | null;
    context?: string;
  }) => void;
} {
  let resolutions = 0;
  let totalMs = 0;

  return {
    noteResolution(durationMs: number) {
      resolutions += 1;
      totalMs += durationMs;
    },
    getMetrics: () => ({ resolutions, totalMs }),
    finish: payload => {
      if (!DEBUG_ENABLED) {
        return;
      }
      logger.debug(
        {
          companyId: payload.companyId,
          messageId: payload.messageId ?? null,
          context: payload.context ?? "handleMessage",
          resolutions,
          totalMs
        },
        "[WhatsappBehavior] message settings runtime"
      );
    }
  };
}
