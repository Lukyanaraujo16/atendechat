jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { count: jest.fn() }
}));

jest.mock("../pushDedupe", () => ({
  acquireTicketPushDedupe: jest.fn()
}));

jest.mock("../ResolveTicketPushRecipientsService", () => ({
  resolveRecipientsForInboundMessage: jest.fn(),
  resolveRecipientsForPendingOrQueue: jest.fn()
}));

jest.mock("../SendOneSignalPushNotificationService", () => ({
  __esModule: true,
  default: jest.fn(async () => undefined)
}));

import Message from "../../../models/Message";
import { acquireTicketPushDedupe } from "../pushDedupe";
import {
  resolveRecipientsForInboundMessage,
  resolveRecipientsForPendingOrQueue
} from "../ResolveTicketPushRecipientsService";
import SendOneSignalPushNotificationService from "../SendOneSignalPushNotificationService";
import notifyTicketInboundMessage from "../notifyTicketInboundMessage";

const count = Message.count as jest.Mock;
const acquire = acquireTicketPushDedupe as jest.Mock;
const resolveInbound = resolveRecipientsForInboundMessage as jest.Mock;
const resolvePending = resolveRecipientsForPendingOrQueue as jest.Mock;
const sendPush = SendOneSignalPushNotificationService as jest.Mock;

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    fromMe: false,
    body: "olá",
    ticket: {
      id: 50,
      companyId: 1,
      uuid: "t-uuid",
      status: "open",
      userId: 25,
      queueId: 3,
      whatsappId: 9,
      channel: "whatsapp",
      contact: { name: "Cliente" },
      queue: { name: "Suporte" }
    },
    ...overrides
  } as any;
}

describe("notifyTicketInboundMessage — hardening (2.14B)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    acquire.mockResolvedValue(true);
    count.mockResolvedValue(5);
    resolveInbound.mockResolvedValue([25]);
    resolvePending.mockResolvedValue([1, 2, 30]);
    sendPush.mockResolvedValue(undefined);
  });

  it("fromMe === true → zero push", async () => {
    await notifyTicketInboundMessage({
      message: makeMessage({ fromMe: true }),
      companyId: 1
    });
    expect(sendPush).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
  });

  it("assignee: ticket_message_inbound só para resolve inbound", async () => {
    await notifyTicketInboundMessage({
      message: makeMessage(),
      companyId: 1
    });
    expect(resolveInbound).toHaveBeenCalled();
    expect(resolvePending).not.toHaveBeenCalled();
    expect(sendPush.mock.calls[0][0].eventType).toBe("ticket_message_inbound");
    expect(sendPush.mock.calls[0][0].recipientUserIds).toEqual([25]);
    expect(sendPush.mock.calls[0][0].preferenceCategory).toBe("message");
  });

  it("pending primeira mensagem → ticket_pending_new", async () => {
    count.mockResolvedValue(1);
    await notifyTicketInboundMessage({
      message: makeMessage({
        ticket: {
          id: 51,
          companyId: 1,
          uuid: "p",
          status: "pending",
          userId: null,
          queueId: 3,
          whatsappId: 9,
          channel: "whatsapp",
          contact: { name: "Novo" },
          queue: { name: "Fila" }
        }
      }),
      companyId: 1
    });
    expect(resolvePending).toHaveBeenCalledWith(1, 3, 9);
    expect(sendPush.mock.calls[0][0].eventType).toBe("ticket_pending_new");
    expect(sendPush.mock.calls[0][0].preferenceCategory).toBe("new_ticket");
  });

  it("dedupe por messageId", async () => {
    acquire.mockResolvedValue(false);
    await notifyTicketInboundMessage({
      message: makeMessage(),
      companyId: 1
    });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("companyId do ticket divergente → sem push", async () => {
    await notifyTicketInboundMessage({
      message: makeMessage({
        ticket: { ...makeMessage().ticket, companyId: 2 }
      }),
      companyId: 1
    });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("External IDs individuais no dispatcher (recipientUserIds numéricos)", async () => {
    resolveInbound.mockResolvedValue([25, 26]);
    await notifyTicketInboundMessage({
      message: makeMessage({
        ticket: { ...makeMessage().ticket, userId: null, queueId: 3 }
      }),
      companyId: 1
    });
    // Sem assignee usa resolveInbound (fila)
    const args = sendPush.mock.calls[0][0];
    expect(args.recipientUserIds).toEqual([25, 26]);
    expect(args.recipientUserIds).not.toContain(1);
  });
});
