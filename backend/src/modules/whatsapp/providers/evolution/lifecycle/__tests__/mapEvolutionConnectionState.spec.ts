import {
  extractEvolutionQrcodeRaw,
  extractEvolutionStateFromPayload,
  mapEvolutionStateToStreamHubStatus,
  normalizeEvolutionConnectionState,
  shouldApplyStreamHubStatus
} from "../mapEvolutionConnectionState";

describe("mapEvolutionConnectionState Fase 10", () => {
  it("mapeia states Evolution → StreamHub", () => {
    expect(mapEvolutionStateToStreamHubStatus("open")).toBe("CONNECTED");
    expect(mapEvolutionStateToStreamHubStatus("connecting")).toBe("OPENING");
    expect(
      mapEvolutionStateToStreamHubStatus("connecting", { hasQrcode: true })
    ).toBe("qrcode");
    expect(mapEvolutionStateToStreamHubStatus("close")).toBe("DISCONNECTED");
    expect(mapEvolutionStateToStreamHubStatus("refused")).toBe("DISCONNECTED");
    expect(mapEvolutionStateToStreamHubStatus("unknown")).toBe("DISCONNECTED");
  });

  it("normaliza aliases", () => {
    expect(normalizeEvolutionConnectionState("OPEN")).toBe("open");
    expect(normalizeEvolutionConnectionState("connected")).toBe("open");
    expect(normalizeEvolutionConnectionState("closed")).toBe("close");
  });

  it("extrai state de payloads aninhados", () => {
    expect(
      extractEvolutionStateFromPayload({
        instance: { instanceName: "x", state: "open" }
      })
    ).toBe("open");
    expect(
      extractEvolutionStateFromPayload({
        data: { state: "connecting", statusReason: 200 }
      })
    ).toBe("connecting");
  });

  it("extrai QR code bruto (não base64)", () => {
    expect(
      extractEvolutionQrcodeRaw({
        code: "2@ABC",
        base64: "data:image/png;base64,xxx"
      })
    ).toBe("2@ABC");
    expect(
      extractEvolutionQrcodeRaw({
        qrcode: { code: "2@XYZ", base64: "data:image/png;base64,xxx" }
      })
    ).toBe("2@XYZ");
    expect(
      extractEvolutionQrcodeRaw({ base64: "data:image/png;base64,xxx" })
    ).toBeNull();
  });

  it("ordering: QR não regride CONNECTED; disconnect aplica", () => {
    expect(
      shouldApplyStreamHubStatus({ current: "CONNECTED", next: "qrcode" })
    ).toBe(false);
    expect(
      shouldApplyStreamHubStatus({
        current: "CONNECTED",
        next: "DISCONNECTED"
      })
    ).toBe(true);
    expect(
      shouldApplyStreamHubStatus({
        current: "DISCONNECTED",
        next: "CONNECTED"
      })
    ).toBe(true);
    expect(
      shouldApplyStreamHubStatus({ current: "CONNECTED", next: "CONNECTED" })
    ).toBe(false);
  });
});
