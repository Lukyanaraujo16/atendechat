import {
  createBaileysIdentityProbe,
  inboundAddressingAsMsgLike
} from "../baileysIdentityProbe";
import type { NormalizedWhatsAppMessage } from "../../../../inbound/NormalizedWhatsAppMessage";

describe("baileysIdentityProbe", () => {
  it("createBaileysIdentityProbe usa onWhatsApp do socket", async () => {
    const onWhatsApp = jest
      .fn()
      .mockResolvedValue([
        { exists: true, jid: "5511999998888@s.whatsapp.net" }
      ]);
    const probe = createBaileysIdentityProbe({ onWhatsApp } as never);
    const number = await probe("5511999998888@s.whatsapp.net");
    expect(onWhatsApp).toHaveBeenCalled();
    expect(number).toBe("5511999998888");
  });

  it("inboundAddressingAsMsgLike projeta key/addressing do DTO", () => {
    const inbound = {
      messageId: "ID1",
      fromMe: true,
      pushName: "Eu",
      isGroup: false,
      addressing: {
        remoteJid: "5511000000000@s.whatsapp.net",
        participant: "",
        senderPn: "5511000000000@s.whatsapp.net",
        remoteJidAlt: undefined,
        participantPn: undefined
      }
    } as Pick<
      NormalizedWhatsAppMessage,
      "messageId" | "fromMe" | "pushName" | "addressing" | "isGroup"
    >;

    const like = inboundAddressingAsMsgLike(inbound);
    expect(like.key.id).toBe("ID1");
    expect(like.key.fromMe).toBe(true);
    expect(like.key.remoteJid).toBe("5511000000000@s.whatsapp.net");
    expect(like.key.senderPn).toBe("5511000000000@s.whatsapp.net");
    expect(like.pushName).toBe("Eu");
  });
});
