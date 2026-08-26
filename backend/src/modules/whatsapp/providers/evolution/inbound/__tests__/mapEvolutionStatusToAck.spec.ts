import {
  mapEvolutionStatusToAck,
  shouldApplyAck,
  STREAMHUB_ACK
} from "../mapEvolutionStatusToAck";
import {
  adaptEvolutionMessageStatus,
  buildEvolutionAckExternalEventId
} from "../adaptEvolutionMessageStatus";

describe("mapEvolutionStatusToAck", () => {
  it("mapeia status textuais Evolution → ack 0–5", () => {
    expect(mapEvolutionStatusToAck("ERROR")).toBe(STREAMHUB_ACK.ERROR);
    expect(mapEvolutionStatusToAck("FAILED")).toBe(STREAMHUB_ACK.ERROR);
    expect(mapEvolutionStatusToAck("PENDING")).toBe(STREAMHUB_ACK.PENDING);
    expect(mapEvolutionStatusToAck("SERVER_ACK")).toBe(STREAMHUB_ACK.SERVER_ACK);
    expect(mapEvolutionStatusToAck("DELIVERY_ACK")).toBe(
      STREAMHUB_ACK.DELIVERY_ACK
    );
    expect(mapEvolutionStatusToAck("READ")).toBe(STREAMHUB_ACK.READ);
    expect(mapEvolutionStatusToAck("PLAYED")).toBe(STREAMHUB_ACK.PLAYED);
  });

  it("aceita números 0–5 e rejeita desconhecidos", () => {
    expect(mapEvolutionStatusToAck(3)).toBe(3);
    expect(mapEvolutionStatusToAck(9)).toBeNull();
    expect(mapEvolutionStatusToAck("UNKNOWN")).toBeNull();
  });

  it("regra monotônica: nunca regride; ERROR só se < SERVER_ACK", () => {
    expect(shouldApplyAck(4, 3)).toBe(false);
    expect(shouldApplyAck(4, 4)).toBe(false);
    expect(shouldApplyAck(3, 4)).toBe(true);
    expect(shouldApplyAck(5, 4)).toBe(false);
    expect(shouldApplyAck(1, 0)).toBe(true);
    expect(shouldApplyAck(2, 0)).toBe(false);
    expect(shouldApplyAck(4, 0)).toBe(false);
  });
});

describe("adaptEvolutionMessageStatus", () => {
  it("adapta payload real Evolution (keyId + status)", () => {
    const adapted = adaptEvolutionMessageStatus({
      companyId: 1,
      whatsappId: 10,
      envelope: {
        event: "MESSAGES_UPDATE",
        instance: "inst1",
        data: {
          keyId: "BAE5ACK1",
          remoteJid: "5511999998888@s.whatsapp.net",
          fromMe: true,
          status: "DELIVERY_ACK"
        }
      }
    });
    expect(adapted.ok).toBe(true);
    if (!adapted.ok) return;
    expect(adapted.status.messageId).toBe("BAE5ACK1");
    expect(adapted.status.ack).toBe(3);
    expect(adapted.status.provider).toBe("evolution");
    expect(adapted.status.companyId).toBe(1);
  });

  it("alias messages.update e delivered/read/played/failed", () => {
    for (const [status, ack] of [
      ["SERVER_ACK", 2],
      ["READ", 4],
      ["PLAYED", 5],
      ["ERROR", 0]
    ] as const) {
      const adapted = adaptEvolutionMessageStatus({
        companyId: 1,
        whatsappId: 10,
        envelope: {
          event: "messages.update",
          data: { keyId: "ID1", status, fromMe: true, remoteJid: "x@s.whatsapp.net" }
        }
      });
      expect(adapted.ok).toBe(true);
      if (adapted.ok) expect(adapted.status.ack).toBe(ack);
    }
  });

  it("rejeita evento não-update e status sem map", () => {
    expect(
      adaptEvolutionMessageStatus({
        companyId: 1,
        whatsappId: 1,
        envelope: { event: "MESSAGES_UPSERT", data: { keyId: "x", status: "READ" } }
      }).ok
    ).toBe(false);
    expect(
      adaptEvolutionMessageStatus({
        companyId: 1,
        whatsappId: 1,
        envelope: {
          event: "MESSAGES_UPDATE",
          data: { keyId: "x", status: "WEIRD" }
        }
      }).ok
    ).toBe(false);
  });

  it("externalEventId ACK não colide com UPSERT", () => {
    const id = buildEvolutionAckExternalEventId({
      whatsappId: 10,
      messageId: "BAE5",
      ack: 3,
      providerStatus: "DELIVERY_ACK"
    });
    expect(id).toBe("evo:10:BAE5:ack:DELIVERY_ACK");
    expect(id).not.toBe("evo:10:BAE5");
  });
});
