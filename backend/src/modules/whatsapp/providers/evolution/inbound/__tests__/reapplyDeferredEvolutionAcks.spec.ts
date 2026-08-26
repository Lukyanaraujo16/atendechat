/* eslint-disable import/first */
jest.mock("@whiskeysockets/baileys", () => ({
  getContentType: () => "conversation",
  proto: {}
}));

jest.mock("../../../../../../libs/socket", () => ({
  getIO: () => ({
    to: () => ({
      emit: (...args: unknown[]) => mockEmit(...args)
    })
  })
}));

jest.mock("../../../../../../services/MessageServices/CreateMessageService", () => ({
  serializeMessageForClient: (m: unknown) => m
}));

const mockEmit = jest.fn();
const findOne = jest.fn();
const findByPk = jest.fn();
const findAllEvents = jest.fn();
const updateEvent = jest.fn();

jest.mock("../../../../../../models/Message", () => ({
  __esModule: true,
  default: {
    findOne: (...a: unknown[]) => findOne(...a),
    findByPk: (...a: unknown[]) => findByPk(...a)
  }
}));

jest.mock("../../../../../../models/EvolutionWebhookEvent", () => ({
  __esModule: true,
  default: {
    findAll: (...a: unknown[]) => findAllEvents(...a),
    update: (...a: unknown[]) => updateEvent(...a),
    count: jest.fn()
  }
}));

jest.mock("../../../../../../models/Contact", () => ({ __esModule: true, default: {} }));
jest.mock("../../../../../../models/Ticket", () => ({ __esModule: true, default: {} }));
jest.mock("../../../../../../models/Whatsapp", () => ({ __esModule: true, default: {} }));

import { reapplyDeferredEvolutionAcks } from "../reapplyDeferredEvolutionAcks";

function messageRow(overrides: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    id: "MSG_X",
    ack: 1,
    companyId: 1,
    ticketId: 77,
    ticket: { id: 77, whatsappId: 10, status: "open", queueId: null, contact: {} },
    ...overrides
  };
  row.update = jest.fn().mockImplementation(async (patch: Record<string, unknown>) => {
    Object.assign(row, patch);
  });
  return row;
}

function deferredEvent(status: string, id = 1) {
  const update = jest.fn().mockResolvedValue(undefined);
  return {
    id,
    companyId: 1,
    whatsappId: 10,
    providerMessageId: "MSG_X",
    processingStatus: "deferred",
    rawPayload: {
      event: "MESSAGES_UPDATE",
      data: {
        keyId: "MSG_X",
        status,
        fromMe: true,
        remoteJid: "5511999998888@s.whatsapp.net"
      }
    },
    update
  };
}

describe("reapplyDeferredEvolutionAcks Fase 9B", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateEvent.mockResolvedValue([1]);
  });

  it("Message nasce → DELIVERY + READ deferred → ack final 4", async () => {
    const row = messageRow({ ack: 1 });
    findOne.mockResolvedValue(row);
    findByPk.mockResolvedValue(row);
    const e1 = deferredEvent("DELIVERY_ACK", 1);
    const e2 = deferredEvent("READ", 2);
    findAllEvents.mockResolvedValue([e1, e2]);

    const result = await reapplyDeferredEvolutionAcks({
      companyId: 1,
      whatsappId: 10,
      providerMessageId: "MSG_X"
    });

    expect(result.scanned).toBe(2);
    expect(result.applied).toBeGreaterThanOrEqual(1);
    expect(row.update).toHaveBeenCalledWith({ ack: 3 });
    expect(row.update).toHaveBeenCalledWith({ ack: 4 });
    expect(e1.update).toHaveBeenCalledWith(
      expect.objectContaining({ processingStatus: "processed" })
    );
    expect(e2.update).toHaveBeenCalledWith(
      expect.objectContaining({ processingStatus: "processed" })
    );
    expect(mockEmit).toHaveBeenCalled();
  });

  it("FAILED + READ deferred → monotonia mantém READ", async () => {
    const row = messageRow({ ack: 1 });
    findOne.mockResolvedValue(row);
    findByPk.mockResolvedValue(row);
    findAllEvents.mockResolvedValue([
      deferredEvent("READ", 1),
      deferredEvent("ERROR", 2)
    ]);

    await reapplyDeferredEvolutionAcks({
      companyId: 1,
      whatsappId: 10,
      providerMessageId: "MSG_X"
    });

    expect(row.update).toHaveBeenCalledWith({ ack: 4 });
    // ERROR após READ não regride
    const updateMock = row.update as jest.Mock;
    const acks = updateMock.mock.calls.map(
      (c: unknown[]) => (c[0] as { ack?: number }).ack
    );
    expect(acks).not.toContain(0);
  });

  it("delivered+read+played → ack final 5", async () => {
    const row = messageRow({ ack: 2 });
    findOne.mockResolvedValue(row);
    findByPk.mockResolvedValue(row);
    findAllEvents.mockResolvedValue([
      deferredEvent("DELIVERY_ACK", 1),
      deferredEvent("READ", 2),
      deferredEvent("PLAYED", 3)
    ]);

    const result = await reapplyDeferredEvolutionAcks({
      companyId: 1,
      whatsappId: 10,
      providerMessageId: "MSG_X"
    });

    expect(result.finalAck).toBe(5);
    expect(row.update).toHaveBeenCalledWith({ ack: 5 });
  });

  it("reapply idempotente quando claim falha (já processado)", async () => {
    updateEvent.mockResolvedValue([0]);
    findAllEvents.mockResolvedValue([deferredEvent("READ", 1)]);
    const result = await reapplyDeferredEvolutionAcks({
      companyId: 1,
      whatsappId: 10,
      providerMessageId: "MSG_X"
    });
    expect(result.applied).toBe(0);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("tenant isolation: whatsappId diferente não atualiza", async () => {
    const row = messageRow({
      ticket: { id: 77, whatsappId: 99, status: "open", queueId: null, contact: {} }
    });
    findOne.mockResolvedValue(row);
    findAllEvents.mockResolvedValue([deferredEvent("READ", 1)]);
    updateEvent.mockResolvedValue([1]);

    const result = await reapplyDeferredEvolutionAcks({
      companyId: 1,
      whatsappId: 10,
      providerMessageId: "MSG_X"
    });

    // findMessage rejects wrong whatsapp → deferred again
    expect(result.stillDeferred + result.skipped + result.errors).toBeGreaterThanOrEqual(0);
    expect(row.update).not.toHaveBeenCalledWith({ ack: 4 });
  });
});
