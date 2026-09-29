/**
 * 12.5-F1 — IDs Bull determinísticos para Campaign.
 *
 * Process: campaignId + instante scheduledAt (ms) → Verify T-60/T-40/T-20
 * reusa o mesmo job. Reagendar com novo scheduledAt gera novo ciclo.
 *
 * Dispatch: campaignShippingId → um shipping = um Dispatch lógico.
 * RetryFailed remove o job desse id antes de recriar.
 */

export function buildProcessCampaignJobId(
  campaignId: number,
  scheduledAt: string | Date | number
): string {
  const ms = toEpochMs(scheduledAt);
  return `campaign-process:${Number(campaignId)}:${ms}`;
}

/** Restart manual: ciclo distinto do Verify por scheduledAt. */
export function buildProcessCampaignRestartJobId(campaignId: number): string {
  return `campaign-process:${Number(campaignId)}:restart:${Date.now()}`;
}

export function buildDispatchCampaignJobId(campaignShippingId: number): string {
  return `campaign-dispatch:${Number(campaignShippingId)}`;
}

export function isBullDuplicateJobError(err: unknown): boolean {
  const message = String((err as { message?: string })?.message || err || "");
  return /already (exists|exists with this id)|JobId.*exists|duplicate/i.test(
    message
  );
}

function toEpochMs(value: string | Date | number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) {
    throw new Error(`ERR_CAMPAIGN_SCHEDULEDAT_INVALID: ${String(value)}`);
  }
  return ms;
}
