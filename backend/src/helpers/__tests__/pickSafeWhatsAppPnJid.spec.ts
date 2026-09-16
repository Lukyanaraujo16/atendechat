import { pickSafeWhatsAppPnJid } from "../normalizeWhatsAppJidToNumber";

describe("pickSafeWhatsAppPnJid", () => {
  it("aceita @s.whatsapp.net com dígitos plausíveis", () => {
    expect(pickSafeWhatsAppPnJid("5511999998888@s.whatsapp.net")).toBe(
      "5511999998888@s.whatsapp.net"
    );
  });

  it("rejeita @lid, @g.us, malformed e PN não plausível", () => {
    expect(pickSafeWhatsAppPnJid("999999999999999@lid")).toBeUndefined();
    expect(pickSafeWhatsAppPnJid("120363000000000000@g.us")).toBeUndefined();
    expect(pickSafeWhatsAppPnJid("not-a-jid")).toBeUndefined();
    expect(pickSafeWhatsAppPnJid("11111111111@s.whatsapp.net")).toBeUndefined();
    expect(pickSafeWhatsAppPnJid("")).toBeUndefined();
    expect(pickSafeWhatsAppPnJid(null)).toBeUndefined();
  });
});
