import {
  buildDispatchCampaignJobId,
  buildProcessCampaignJobId,
  buildProcessCampaignRestartJobId,
  isBullDuplicateJobError
} from "../campaignQueueJobIds";

describe("12.5-F1 campaignQueueJobIds", () => {
  it("ProcessCampaign jobId é estável para o mesmo campaignId+scheduledAt", () => {
    const scheduledAt = "2026-09-28T22:52:00.000-03:00";
    const a = buildProcessCampaignJobId(3, scheduledAt);
    const b = buildProcessCampaignJobId(3, scheduledAt);
    expect(a).toBe(b);
    expect(a).toBe(
      `campaign-process:3:${new Date(scheduledAt).getTime()}`
    );
  });

  it("Verify T-60/T-40/T-20 produzem o mesmo ProcessCampaign jobId", () => {
    const scheduledAt = "2026-09-28 22:52:00";
    const ids = [0, 20, 40].map(() =>
      buildProcessCampaignJobId(3, scheduledAt)
    );
    expect(new Set(ids).size).toBe(1);
  });

  it("reagendar com novo scheduledAt gera novo ProcessCampaign jobId", () => {
    const first = buildProcessCampaignJobId(3, "2026-09-28T22:52:00.000Z");
    const second = buildProcessCampaignJobId(3, "2026-09-28T23:52:00.000Z");
    expect(first).not.toBe(second);
  });

  it("Restart jobId é distinto do ciclo Verify", () => {
    const verifyId = buildProcessCampaignJobId(3, "2026-09-28T22:52:00.000Z");
    const restartId = buildProcessCampaignRestartJobId(3);
    expect(restartId).toMatch(/^campaign-process:3:restart:\d+$/);
    expect(restartId).not.toBe(verifyId);
  });

  it("Dispatch jobId é 1:1 com CampaignShippingId", () => {
    expect(buildDispatchCampaignJobId(3)).toBe("campaign-dispatch:3");
    expect(buildDispatchCampaignJobId(4)).toBe("campaign-dispatch:4");
  });

  it("detecta erro de job duplicado do Bull", () => {
    expect(
      isBullDuplicateJobError(new Error("Job campaign-process:3:1 already exists"))
    ).toBe(true);
    expect(isBullDuplicateJobError(new Error("network down"))).toBe(false);
  });
});
