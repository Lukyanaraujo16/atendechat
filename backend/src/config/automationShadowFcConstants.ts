/**
 * Fase IA 2.1E — Function Calling Shadow (observacional).
 */

export const AUTOMATION_SHADOW_FC_VERSION = "2.1.0-e";

export const SHADOW_FC_COMPANY_SETTING_KEY = "functionCallingShadow";

/** Estimativa conservadora USD por token (agregação observacional). */
export const SHADOW_FC_USD_PER_TOKEN = 0.000002;

export const SHADOW_FC_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "skipped"
] as const;

export type ShadowFcStatus = (typeof SHADOW_FC_STATUSES)[number];
