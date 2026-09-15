import {
  adaptEvolutionMessageRevoke,
  omitRevokeMessageContent
} from "../adaptEvolutionMessageRevoke";

describe("adaptEvolutionMessageRevoke", () => {
  it("payload inbound comprovado { ...key, status: DELETED }", () => {
    const result = adaptEvolutionMessageRevoke({
      envelope: {
        event: "MESSAGES_DELETE",
        data: {
          id: "BAE5TARGET",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: false,
          status: "DELETED"
        }
      },
      companyId: 1,
      whatsappId: 10
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.revoke.messageId).toBe("BAE5TARGET");
      expect(result.revoke.remoteJid).toBe("5511999998888@s.whatsapp.net");
      expect(result.revoke.fromMe).toBe(false);
    }
  });

  it("payload API Evolution usa key.id e ignora id Prisma", () => {
    const result = adaptEvolutionMessageRevoke({
      envelope: {
        event: "MESSAGES_DELETE",
        data: {
          id: "prisma-internal-uuid",
          key: {
            id: "BAE5WAID",
            remoteJid: "5511999998888@s.whatsapp.net",
            fromMe: true
          },
          status: "DELETED"
        }
      },
      companyId: 1,
      whatsappId: 10
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.revoke.messageId).toBe("BAE5WAID");
      expect(result.revoke.fromMe).toBe(true);
    }
  });

  it("evento inválido ou sem id é skipped", () => {
    expect(
      adaptEvolutionMessageRevoke({
        envelope: { event: "MESSAGES_UPDATE", data: { id: "X" } },
        companyId: 1,
        whatsappId: 10
      }).ok
    ).toBe(false);

    expect(
      adaptEvolutionMessageRevoke({
        envelope: { event: "MESSAGES_DELETE", data: { status: "DELETED" } },
        companyId: 1,
        whatsappId: 10
      })
    ).toMatchObject({ ok: false, reason: "missing_message_id" });
  });

  it("omitRevokeMessageContent remove message do payload persistido", () => {
    const omitted = omitRevokeMessageContent({
      event: "MESSAGES_DELETE",
      data: {
        id: "prisma",
        key: { id: "WA" },
        message: { conversation: "segredo" }
      }
    });
    expect((omitted.data as Record<string, unknown>).message).toBeUndefined();
    expect((omitted.data as Record<string, unknown>).key).toEqual({ id: "WA" });
  });
});
