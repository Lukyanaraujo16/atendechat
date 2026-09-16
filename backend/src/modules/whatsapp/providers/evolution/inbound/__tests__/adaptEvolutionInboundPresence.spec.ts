import { adaptEvolutionInboundPresence } from "../adaptEvolutionInboundPresence";
import { EvolutionWebhookEnvelope } from "../evolutionWebhookTypes";

const OWN = "5511888887777@s.whatsapp.net";
const CLIENT = "5511999998888@s.whatsapp.net";

function envelope(
  overrides: Partial<EvolutionWebhookEnvelope> = {}
): EvolutionWebhookEnvelope {
  return {
    event: "presence.update",
    instance: "inst",
    sender: OWN,
    data: {
      id: CLIENT,
      presences: {
        [CLIENT]: { lastKnownPresence: "composing" }
      }
    },
    ...overrides
  };
}

describe("adaptEvolutionInboundPresence", () => {
  it("composing privado @s.whatsapp.net", () => {
    const result = adaptEvolutionInboundPresence({ envelope: envelope() });
    expect(result).toEqual({
      ok: true,
      remoteJid: CLIENT,
      presence: "composing"
    });
  });

  it("paused", () => {
    const result = adaptEvolutionInboundPresence({
      envelope: envelope({
        data: {
          id: CLIENT,
          presences: { [CLIENT]: { lastKnownPresence: "paused" } }
        }
      })
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.presence).toBe("paused");
  });

  it("recording", () => {
    const result = adaptEvolutionInboundPresence({
      envelope: envelope({
        data: {
          id: CLIENT,
          presences: { [CLIENT]: { lastKnownPresence: "recording" } }
        }
      })
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.presence).toBe("recording");
  });

  it("available ignorado", () => {
    const result = adaptEvolutionInboundPresence({
      envelope: envelope({
        data: {
          id: CLIENT,
          presences: { [CLIENT]: { lastKnownPresence: "available" } }
        }
      })
    });
    expect(result).toEqual({ ok: false, reason: "ignored_presence" });
  });

  it("unavailable ignorado", () => {
    const result = adaptEvolutionInboundPresence({
      envelope: envelope({
        data: {
          id: CLIENT,
          presences: { [CLIENT]: { lastKnownPresence: "unavailable" } }
        }
      })
    });
    expect(result).toEqual({ ok: false, reason: "ignored_presence" });
  });

  it("envelope.sender NÃO é o cliente", () => {
    const result = adaptEvolutionInboundPresence({ envelope: envelope() });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.remoteJid).toBe(CLIENT);
      expect(result.remoteJid).not.toBe(OWN);
      expect(result.remoteJid).not.toContain("5511888887777");
    }
  });

  it("own presence ignorado", () => {
    const result = adaptEvolutionInboundPresence({
      envelope: envelope({
        data: {
          id: CLIENT,
          presences: { [OWN]: { lastKnownPresence: "composing" } }
        }
      })
    });
    expect(result).toEqual({ ok: false, reason: "own_presence" });
  });

  it("chat id da própria conta ignorado", () => {
    const result = adaptEvolutionInboundPresence({
      envelope: envelope({
        data: {
          id: OWN,
          presences: { [OWN]: { lastKnownPresence: "composing" } }
        }
      })
    });
    expect(result).toEqual({ ok: false, reason: "own_presence" });
  });

  it("@g.us ignorado", () => {
    const result = adaptEvolutionInboundPresence({
      envelope: envelope({
        data: {
          id: "120363111@g.us",
          presences: {
            "5511999998888@s.whatsapp.net": { lastKnownPresence: "composing" }
          }
        }
      })
    });
    expect(result).toEqual({ ok: false, reason: "group" });
  });

  it("@lid sem PN ignorado", () => {
    const result = adaptEvolutionInboundPresence({
      envelope: envelope({
        data: {
          id: "123456789012345@lid",
          presences: {
            "123456789012345@lid": { lastKnownPresence: "composing" }
          }
        }
      })
    });
    expect(result).toEqual({ ok: false, reason: "lid_without_pn" });
  });

  it("malformed ignorado", () => {
    expect(
      adaptEvolutionInboundPresence({
        envelope: { event: "presence.update", sender: OWN }
      })
    ).toEqual({ ok: false, reason: "malformed" });
    expect(
      adaptEvolutionInboundPresence({
        envelope: {
          event: "presence.update",
          sender: OWN,
          data: { id: CLIENT }
        }
      })
    ).toEqual({ ok: false, reason: "malformed" });
  });

  it("sender ausente é ambíguo e descartado", () => {
    const result = adaptEvolutionInboundPresence({
      envelope: envelope({ sender: undefined })
    });
    expect(result).toEqual({ ok: false, reason: "own_jid_unknown" });
  });

  it("aceita PRESENCE_UPDATE maiúsculo", () => {
    const result = adaptEvolutionInboundPresence({
      envelope: envelope({ event: "PRESENCE_UPDATE" })
    });
    expect(result.ok).toBe(true);
  });
});
