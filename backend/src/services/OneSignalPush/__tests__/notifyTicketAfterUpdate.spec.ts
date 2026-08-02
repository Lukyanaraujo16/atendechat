jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

jest.mock("../pushDedupe", () => ({
  acquireTicketPushDedupe: jest.fn()
}));

jest.mock("../ResolveTicketPushRecipientsService", () => ({
  resolveRecipientsForPendingOrQueue: jest.fn()
}));

jest.mock("../SendOneSignalPushNotificationService", () => ({
  __esModule: true,
  default: jest.fn(async () => undefined)
}));

import { acquireTicketPushDedupe } from "../pushDedupe";
import { resolveRecipientsForPendingOrQueue } from "../ResolveTicketPushRecipientsService";
import SendOneSignalPushNotificationService from "../SendOneSignalPushNotificationService";
import notifyTicketAfterUpdate from "../notifyTicketAfterUpdate";

const acquire = acquireTicketPushDedupe as jest.Mock;
const resolvePending = resolveRecipientsForPendingOrQueue as jest.Mock;
const sendPush = SendOneSignalPushNotificationService as jest.Mock;

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 80,
    companyId: 1,
    uuid: "tu",
    status: "open",
    userId: 25,
    queueId: 3,
    whatsappId: 9,
    contact: { name: "Cliente" },
    queue: { name: "Suporte" },
    ...overrides
  } as any;
}

describe("notifyTicketAfterUpdate — hardening (2.14B)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    acquire.mockResolvedValue(true);
    resolvePending.mockResolvedValue([1, 2, 30]);
    sendPush.mockResolvedValue(undefined);
  });

  it("ticket_assigned: somente novo responsável", async () => {
    await notifyTicketAfterUpdate({
      companyId: 1,
      ticket: ticket({ userId: 25 }),
      oldStatus: "pending",
      oldQueueId: 3,
      oldUserId: null
    });
    const assignCall = sendPush.mock.calls.find(
      c => c[0].eventType === "ticket_assigned"
    );
    expect(assignCall).toBeTruthy();
    expect(assignCall[0].recipientUserIds).toEqual([25]);
    expect(assignCall[0].preferenceCategory).toBe("assigned");
  });

  it("ticket_queue_transfer: destinatários da nova fila (pending resolver)", async () => {
    await notifyTicketAfterUpdate({
      companyId: 1,
      ticket: ticket({ userId: 25, queueId: 8 }),
      oldStatus: "open",
      oldQueueId: 3,
      oldUserId: 25
    });
    expect(resolvePending).toHaveBeenCalledWith(1, 8, 9);
    const transfer = sendPush.mock.calls.find(
      c => c[0].eventType === "ticket_queue_transfer"
    );
    expect(transfer).toBeTruthy();
    expect(transfer[0].recipientUserIds).toEqual([1, 2, 30]);
  });

  it("ticket_returned_pending", async () => {
    await notifyTicketAfterUpdate({
      companyId: 1,
      ticket: ticket({ status: "pending", userId: null }),
      oldStatus: "open",
      oldQueueId: 3,
      oldUserId: 25
    });
    const pending = sendPush.mock.calls.find(
      c => c[0].eventType === "ticket_returned_pending"
    );
    expect(pending).toBeTruthy();
    expect(pending[0].preferenceCategory).toBe("new_ticket");
  });

  it("sem mudanças relevantes → zero push", async () => {
    await notifyTicketAfterUpdate({
      companyId: 1,
      ticket: ticket(),
      oldStatus: "open",
      oldQueueId: 3,
      oldUserId: 25
    });
    expect(sendPush).not.toHaveBeenCalled();
  });
});
