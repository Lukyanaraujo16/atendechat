/* eslint-disable import/first */
const mockEmit = jest.fn();
const createEvent = jest.fn();
const updateEvent = jest.fn();

jest.mock("../../../../../../libs/socket", () => ({
  getIO: () => ({
    to: () => ({ emit: (...a: unknown[]) => mockEmit(...a) })
  })
}));

jest.mock("../../../../../../models/EvolutionWebhookEvent", () => ({
  __esModule: true,
  default: {
    create: (...a: unknown[]) => createEvent(...a)
  }
}));

import {
  processEvolutionConnectionUpdate,
  processEvolutionQrcodeUpdated
} from "../processEvolutionConnectionWebhook";

function whatsappRow(overrides: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    id: 5,
    companyId: 1,
    status: "OPENING",
    qrcode: "",
    ...overrides
  };
  row.update = jest.fn().mockImplementation(async (patch: Record<string, unknown>) => {
    Object.assign(row, patch);
  });
  return row;
}

describe("Evolution lifecycle webhooks Fase 10", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createEvent.mockImplementation(async (attrs: Record<string, unknown>) => ({
      id: 99,
      ...attrs,
      update: updateEvent.mockResolvedValue(undefined)
    }));
  });

  it("CONNECTION_UPDATE open → CONNECTED limpa QR + socket", async () => {
    const wa = whatsappRow({ status: "qrcode", qrcode: "2@OLD" });
    const result = await processEvolutionConnectionUpdate({
      whatsapp: wa as never,
      envelope: {
        event: "CONNECTION_UPDATE",
        data: { state: "open", statusReason: 200 }
      },
      sanitized: { event: "CONNECTION_UPDATE", data: { state: "open" } },
      apiKeyValid: true,
      eventType: "CONNECTION_UPDATE"
    });
    expect(result.outcome).toBe("processed");
    expect(wa.status).toBe("CONNECTED");
    expect(wa.qrcode).toBe("");
    expect(mockEmit).toHaveBeenCalledWith(
      "company-1-whatsappSession",
      expect.objectContaining({
        action: "update",
        session: expect.objectContaining({ status: "CONNECTED", qrcode: "" })
      })
    );
  });

  it("CONNECTION_UPDATE close → DISCONNECTED", async () => {
    const wa = whatsappRow({ status: "CONNECTED" });
    await processEvolutionConnectionUpdate({
      whatsapp: wa as never,
      envelope: { event: "connection.update", data: { state: "close" } },
      sanitized: {},
      apiKeyValid: true,
      eventType: "connection.update"
    });
    expect(wa.status).toBe("DISCONNECTED");
  });

  it("unknown state → DISCONNECTED", async () => {
    const wa = whatsappRow({ status: "OPENING" });
    await processEvolutionConnectionUpdate({
      whatsapp: wa as never,
      envelope: { event: "CONNECTION_UPDATE", data: { state: "weird" } },
      sanitized: {},
      apiKeyValid: true,
      eventType: "CONNECTION_UPDATE"
    });
    expect(wa.status).toBe("DISCONNECTED");
  });

  it("duplicate event noop via unique constraint", async () => {
    const { UniqueConstraintError } = jest.requireActual("sequelize");
    createEvent.mockRejectedValueOnce(new UniqueConstraintError({}));
    const result = await processEvolutionConnectionUpdate({
      whatsapp: whatsappRow() as never,
      envelope: { event: "CONNECTION_UPDATE", data: { state: "open" } },
      sanitized: {},
      apiKeyValid: true,
      eventType: "CONNECTION_UPDATE"
    });
    expect(result.outcome).toBe("duplicate");
  });

  it("QRCODE_UPDATED persiste code bruto e emite socket", async () => {
    const wa = whatsappRow({ status: "OPENING" });
    await processEvolutionQrcodeUpdated({
      whatsapp: wa as never,
      envelope: {
        event: "QRCODE_UPDATED",
        data: {
          qrcode: {
            code: "2@NEWER",
            base64: "data:image/png;base64,SECRET"
          }
        }
      },
      sanitized: { event: "QRCODE_UPDATED" },
      apiKeyValid: true,
      eventType: "QRCODE_UPDATED"
    });
    expect(wa.status).toBe("qrcode");
    expect(wa.qrcode).toBe("2@NEWER");
    expect(String(wa.qrcode)).not.toContain("base64");
    expect(mockEmit).toHaveBeenCalled();
  });

  it("QR após CONNECTED é ignorado", async () => {
    const wa = whatsappRow({ status: "CONNECTED", qrcode: "" });
    const result = await processEvolutionQrcodeUpdated({
      whatsapp: wa as never,
      envelope: {
        event: "qrcode.updated",
        data: { qrcode: { code: "2@LATE" } }
      },
      sanitized: {},
      apiKeyValid: true,
      eventType: "qrcode.updated"
    });
    expect(result.outcome).toBe("skipped");
    expect(wa.qrcode).toBe("");
  });
});
