import {
  applyPreviewError,
  applyPreviewSuccess,
  createPreviewRequestGuard,
  shouldReloadPreview
} from "../previewRequestGuard";
import { buildGroupParticipantsExportRequest } from "../exportRequest";

describe("GroupImportParticipantsModal preview guard", () => {
  it("não considera re-render irrelevante como novo preview", () => {
    const key = {
      open: true,
      whatsappId: "5",
      groupJid: "120363@g.us"
    };
    expect(shouldReloadPreview(key, { ...key, ignored: true })).toBe(false);
    expect(
      shouldReloadPreview(key, { ...key, open: true, whatsappId: "5" })
    ).toBe(false);
    expect(
      shouldReloadPreview(key, { ...key, groupJid: "999@g.us" })
    ).toBe(true);
  });

  it("resposta stale não aplica dados nem fecha o modal", () => {
    const session = createPreviewRequestGuard();
    const first = session.begin();
    const second = session.begin();

    const applied = [];
    let closed = false;

    expect(
      applyPreviewSuccess(first, { totalParticipants: 1 }, data => {
        applied.push(data);
      })
    ).toEqual({ applied: false });
    expect(applied).toEqual([]);

    expect(
      applyPreviewError(first, () => {
        closed = true;
      })
    ).toEqual({ applied: false, closed: false });
    expect(closed).toBe(false);

    expect(
      applyPreviewSuccess(second, { totalParticipants: 9 }, data => {
        applied.push(data);
      })
    ).toEqual({ applied: true });
    expect(applied).toEqual([{ totalParticipants: 9 }]);
  });
});

describe("GroupImportParticipantsModal export request", () => {
  it("exporta via POST com groupJid no body, sem query string", () => {
    const req = buildGroupParticipantsExportRequest("12", "120363-abc@g.us");
    expect(req.method).toBe("post");
    expect(req.url).toBe("/groups/12/participants/export");
    expect(req.data).toEqual({ groupJid: "120363-abc@g.us" });
    expect(req.params).toBeUndefined();
    expect(req.url).not.toMatch(/groupJid=/);
    expect(JSON.stringify(req)).not.toMatch(/\?/);
  });
});
