jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../../helpers/whatsappTicketVisibility", () => ({
  filterUserIdsByWhatsappTicketVisibility: jest.fn(
    async (_c: number, _w: number | null | undefined, ids: number[]) => ids
  ),
  isWhatsappTicketVisibilityPrivileged: jest.fn()
}));
jest.mock("../../../helpers/unassignedTicketsVisibility", () => ({
  loadCompanyUnassignedTicketsQueueId: jest.fn(async () => null)
}));

import User from "../../../models/User";
import { filterUserIdsByWhatsappTicketVisibility } from "../../../helpers/whatsappTicketVisibility";
import {
  resolveRecipientsForInboundMessage,
  resolveRecipientsForPendingOrQueue
} from "../ResolveTicketPushRecipientsService";

const userFindAll = User.findAll as jest.Mock;
const userFindOne = User.findOne as jest.Mock;
const waFilter = filterUserIdsByWhatsappTicketVisibility as jest.Mock;

describe("ResolveTicketPushRecipientsService — hardening (2.14B)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    waFilter.mockImplementation(
      async (_c: number, _w: number | null | undefined, ids: number[]) => ids
    );
  });

  describe("ticket_message_inbound com assignee", () => {
    it("somente assignee da mesma empresa (não-super)", async () => {
      userFindOne.mockResolvedValue({ id: 25, profile: "user" });
      const ids = await resolveRecipientsForInboundMessage(1, {
        userId: 25,
        queueId: 3,
        whatsappId: 9
      });
      expect(ids).toEqual([25]);
      expect(userFindOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 25, companyId: 1 })
        })
      );
      expect(userFindAll).not.toHaveBeenCalled();
    });

    it("assignee inexistente / outro tenant / super → vazio", async () => {
      userFindOne.mockResolvedValue(null);
      const ids = await resolveRecipientsForInboundMessage(1, {
        userId: 999,
        queueId: 3
      });
      expect(ids).toEqual([]);
    });
  });

  describe("ticket sem assignee com fila", () => {
    it("só usuários da fila (sem admin/supervisor automáticos)", async () => {
      userFindAll.mockResolvedValue([{ id: 30 }, { id: 31 }]);
      const ids = await resolveRecipientsForInboundMessage(1, {
        userId: null,
        queueId: 7,
        whatsappId: 2
      });
      expect(ids).toEqual([30, 31]);
      expect(userFindAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("ticket_pending_new / pending-or-queue", () => {
    it("admins + supervisores + fila", async () => {
      userFindAll
        .mockResolvedValueOnce([{ id: 1 }]) // admins
        .mockResolvedValueOnce([{ id: 2 }]) // supervisors
        .mockResolvedValueOnce([{ id: 30 }, { id: 31 }]); // queue
      const ids = await resolveRecipientsForPendingOrQueue(1, 7, 2);
      expect(ids.sort()).toEqual([1, 2, 30, 31]);
    });

    it("aplica filtro WhatsApp visibility", async () => {
      userFindAll
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 30 }, { id: 40 }]);
      waFilter.mockResolvedValue([1, 30]);
      const ids = await resolveRecipientsForPendingOrQueue(1, 7, 99);
      expect(ids).toEqual([1, 30]);
      expect(waFilter).toHaveBeenCalledWith(1, 99, expect.any(Array));
    });
  });

  describe("fromMe / assignee isolation", () => {
    it("não inclui companyId como destinatário", async () => {
      userFindOne.mockResolvedValue({ id: 25, profile: "user" });
      const ids = await resolveRecipientsForInboundMessage(1, {
        userId: 25,
        queueId: null
      });
      expect(ids).toEqual([25]);
      expect(ids).not.toContain(1);
    });
  });
});
