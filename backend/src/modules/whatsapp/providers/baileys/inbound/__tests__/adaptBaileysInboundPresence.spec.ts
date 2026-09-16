import { adaptBaileysInboundPresence } from "../adaptBaileysInboundPresence";

const OWN = "5511888887777@s.whatsapp.net";
const CLIENT = "5511999998888@s.whatsapp.net";

function event(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: CLIENT,
    presences: {
      [CLIENT]: { lastKnownPresence: "composing" }
    },
    ...overrides
  };
}

describe("adaptBaileysInboundPresence", () => {
  it("composing privado @s.whatsapp.net", () => {
    expect(
      adaptBaileysInboundPresence({ event: event(), ownJid: OWN })
    ).toEqual({
      ok: true,
      remoteJid: CLIENT,
      presence: "composing"
    });
  });

  it("recording privado", () => {
    const result = adaptBaileysInboundPresence({
      event: event({
        presences: { [CLIENT]: { lastKnownPresence: "recording" } }
      }),
      ownJid: OWN
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.presence).toBe("recording");
  });

  it("paused privado", () => {
    const result = adaptBaileysInboundPresence({
      event: event({
        presences: { [CLIENT]: { lastKnownPresence: "paused" } }
      }),
      ownJid: OWN
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.presence).toBe("paused");
  });

  it("available ignora", () => {
    expect(
      adaptBaileysInboundPresence({
        event: event({
          presences: { [CLIENT]: { lastKnownPresence: "available" } }
        }),
        ownJid: OWN
      })
    ).toEqual({ ok: false, reason: "ignored_presence" });
  });

  it("unavailable ignora", () => {
    expect(
      adaptBaileysInboundPresence({
        event: event({
          presences: { [CLIENT]: { lastKnownPresence: "unavailable" } }
        }),
        ownJid: OWN
      })
    ).toEqual({ ok: false, reason: "ignored_presence" });
  });

  it("unknown state ignora", () => {
    expect(
      adaptBaileysInboundPresence({
        event: event({
          presences: { [CLIENT]: { lastKnownPresence: "online" } }
        }),
        ownJid: OWN
      })
    ).toEqual({ ok: false, reason: "own_presence" });
  });

  it("@g.us ignora", () => {
    expect(
      adaptBaileysInboundPresence({
        event: event({
          id: "120363111@g.us",
          presences: { [CLIENT]: { lastKnownPresence: "composing" } }
        }),
        ownJid: OWN
      })
    ).toEqual({ ok: false, reason: "group" });
  });

  it("@lid sem PN ignora", () => {
    expect(
      adaptBaileysInboundPresence({
        event: event({
          id: "123456789012345@lid",
          presences: {
            "123456789012345@lid": { lastKnownPresence: "composing" }
          }
        }),
        ownJid: OWN
      })
    ).toEqual({ ok: false, reason: "lid_without_pn" });
  });

  it("payload malformado ignora sem throw", () => {
    expect(adaptBaileysInboundPresence({ event: null, ownJid: OWN })).toEqual({
      ok: false,
      reason: "malformed"
    });
    expect(
      adaptBaileysInboundPresence({
        event: { id: CLIENT },
        ownJid: OWN
      })
    ).toEqual({ ok: false, reason: "malformed" });
    expect(() =>
      adaptBaileysInboundPresence({ event: "nope", ownJid: OWN })
    ).not.toThrow();
  });

  it("own-account presence ignora", () => {
    expect(
      adaptBaileysInboundPresence({
        event: event({
          id: CLIENT,
          presences: { [OWN]: { lastKnownPresence: "composing" } }
        }),
        ownJid: OWN
      })
    ).toEqual({ ok: false, reason: "own_presence" });
    expect(
      adaptBaileysInboundPresence({
        event: event({
          id: OWN,
          presences: { [OWN]: { lastKnownPresence: "composing" } }
        }),
        ownJid: OWN
      })
    ).toEqual({ ok: false, reason: "own_presence" });
  });

  it("own JID com device suffix ainda é own", () => {
    expect(
      adaptBaileysInboundPresence({
        event: event({ id: OWN }),
        ownJid: "5511888887777:12@s.whatsapp.net"
      })
    ).toEqual({ ok: false, reason: "own_presence" });
  });

  it("own JID ausente é ambíguo", () => {
    expect(
      adaptBaileysInboundPresence({ event: event(), ownJid: null })
    ).toEqual({ ok: false, reason: "own_jid_unknown" });
  });

  it("múltiplas presences escolhe o JID do chat privado", () => {
    const other = "5511333332222@s.whatsapp.net";
    const result = adaptBaileysInboundPresence({
      event: {
        id: CLIENT,
        presences: {
          [OWN]: { lastKnownPresence: "composing" },
          [other]: { lastKnownPresence: "recording" },
          [CLIENT]: { lastKnownPresence: "paused" }
        }
      },
      ownJid: OWN
    });
    expect(result).toEqual({
      ok: true,
      remoteJid: CLIENT,
      presence: "paused"
    });
  });
});
