/**
 * @jest-environment jsdom
 */
import {
  ATTENDANCE_UNREAD_STATUSES,
  fetchAttendanceUnreadConversationsCount,
  parseTicketsCount,
  shouldReconcileAttendanceUnreadFromAppMessage,
  shouldReconcileAttendanceUnreadFromTicket,
} from "../attendanceUnreadCount";
import { TICKETS_NO_CACHE_HEADERS } from "../ticketsApiResponse";

describe("attendanceUnreadCount", () => {
  it("status do badge são somente open e pending", () => {
    expect(ATTENDANCE_UNREAD_STATUSES).toEqual(["open", "pending"]);
    expect(ATTENDANCE_UNREAD_STATUSES).not.toContain("closed");
  });

  it("parseTicketsCount ignora respostas inválidas", () => {
    expect(parseTicketsCount(null)).toBe(0);
    expect(parseTicketsCount({ status: 304, data: { count: 9 } })).toBe(0);
    expect(parseTicketsCount({ status: 200, data: { count: 4 } })).toBe(4);
  });

  it("soma countOnly de open + pending e não pede closed", async () => {
    const client = {
      get: jest.fn((url, { params }) =>
        Promise.resolve({
          status: 200,
          data: { tickets: [], count: params.status === "open" ? 2 : 5, hasMore: false },
        })
      ),
    };

    const total = await fetchAttendanceUnreadConversationsCount(client);

    expect(total).toBe(7);
    expect(client.get).toHaveBeenCalledTimes(2);
    const statuses = client.get.mock.calls.map(([, cfg]) => cfg.params.status);
    expect(statuses.sort()).toEqual(["open", "pending"]);
    client.get.mock.calls.forEach(([, cfg]) => {
      expect(cfg.params.withUnreadMessages).toBe("true");
      expect(cfg.params.countOnly).toBe(true);
      expect(cfg.params.showAll).toBe(true);
      expect(cfg.params.status).not.toBe("closed");
      expect(cfg.params.isGroup).toBeUndefined();
      expect(cfg.headers).toEqual(TICKETS_NO_CACHE_HEADERS);
    });
    expect(new Set(statuses).size).toBe(2);
  });

  it("envia showAll=true nas duas chamadas (open e pending)", async () => {
    const client = {
      get: jest.fn().mockResolvedValue({
        status: 200,
        data: { tickets: [], count: 1, hasMore: false },
      }),
    };

    await fetchAttendanceUnreadConversationsCount(client);

    expect(client.get).toHaveBeenCalledTimes(2);
    client.get.mock.calls.forEach(([, cfg]) => {
      expect(cfg.params.showAll).toBe(true);
      expect(["open", "pending"]).toContain(cfg.params.status);
    });
  });

  it("appMessage inbound provoca reconciliação; fromMe não", () => {
    expect(
      shouldReconcileAttendanceUnreadFromAppMessage({
        action: "create",
        message: { fromMe: false },
        ticket: { isGroup: false },
      })
    ).toBe(true);
    expect(
      shouldReconcileAttendanceUnreadFromAppMessage({
        action: "create",
        message: { fromMe: true },
        ticket: { isGroup: false },
      })
    ).toBe(false);
    expect(
      shouldReconcileAttendanceUnreadFromAppMessage({
        action: "create",
        message: { fromMe: false },
        ticket: { isGroup: true },
      })
    ).toBe(false);
  });

  it("ticket updateUnread/update/delete provocam reconciliação", () => {
    expect(shouldReconcileAttendanceUnreadFromTicket({ action: "updateUnread" })).toBe(true);
    expect(shouldReconcileAttendanceUnreadFromTicket({ action: "update" })).toBe(true);
    expect(shouldReconcileAttendanceUnreadFromTicket({ action: "delete" })).toBe(true);
    expect(shouldReconcileAttendanceUnreadFromTicket({ action: "other" })).toBe(false);
  });
});
