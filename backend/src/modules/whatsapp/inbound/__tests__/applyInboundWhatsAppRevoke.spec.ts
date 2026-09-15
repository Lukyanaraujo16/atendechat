/* eslint-disable import/first */
const findOne = jest.fn();
const findByPk = jest.fn();
const mockEmit = jest.fn();

jest.mock("../../../../libs/socket", () => ({
  getIO: () => ({
    to: () => ({
      emit: (...args: unknown[]) => mockEmit(...args)
    })
  })
}));

jest.mock("../../../../services/MessageServices/CreateMessageService", () => ({
  serializeMessageForClient: (m: unknown) => m
}));

jest.mock("../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findOne(...a),
    findByPk: (...a: unknown[]) => findByPk(...a)
  }
}));

jest.mock("../../../../models/Ticket", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {}
}));
jest.mock("../../../../models/Contact", () => ({
  __esModule: true,
  default: {}
}));

import { applyInboundWhatsAppRevoke } from "../applyInboundWhatsAppRevoke";

function messageRow(overrides: Record<string, unknown> = {}) {
  const update = jest.fn().mockResolvedValue(undefined);
  return {
    id: "MSG1",
    ticketId: 77,
    companyId: 1,
    body: "conteúdo original",
    mediaUrl: "file.mp4",
    ack: 2,
    isDeleted: false,
    ticket: { id: 77, whatsappId: 10 },
    update,
    ...overrides
  };
}

describe("applyInboundWhatsAppRevoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marca isDeleted e preserva body/mídia/ack", async () => {
    const row = messageRow();
    findOne.mockResolvedValue(row);
    findByPk.mockResolvedValue({ ...row, isDeleted: true });

    const result = await applyInboundWhatsAppRevoke({
      companyId: 1,
      whatsappId: 10,
      messageId: "MSG1"
    });

    expect(result.outcome).toBe("updated");
    expect(row.update).toHaveBeenCalledWith({ isDeleted: true });
    expect(row.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.anything() })
    );
    expect(row.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ ack: expect.anything() })
    );
    expect(mockEmit).toHaveBeenCalledWith(
      "company-1-appMessage",
      expect.objectContaining({ action: "update" })
    );
  });

  it("replay com isDeleted já true é idempotente", async () => {
    const row = messageRow({ isDeleted: true });
    findOne.mockResolvedValue(row);
    const result = await applyInboundWhatsAppRevoke({
      companyId: 1,
      whatsappId: 10,
      messageId: "MSG1"
    });
    expect(result.outcome).toBe("noop");
    expect(row.update).not.toHaveBeenCalled();
  });

  it("alvo inexistente não cria Message", async () => {
    findOne.mockResolvedValue(null);
    const result = await applyInboundWhatsAppRevoke({
      companyId: 1,
      whatsappId: 10,
      messageId: "GHOST"
    });
    expect(result).toEqual({
      outcome: "skipped",
      reason: "revoke_target_not_found"
    });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("isolamento tenant: whatsappId divergente", async () => {
    findOne.mockResolvedValue(
      messageRow({ ticket: { id: 77, whatsappId: 99 } })
    );
    const result = await applyInboundWhatsAppRevoke({
      companyId: 1,
      whatsappId: 10,
      messageId: "MSG1"
    });
    expect(result.outcome).toBe("skipped");
  });
});
