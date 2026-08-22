/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, render } from "@testing-library/react";
import { AuthContext } from "../../Auth/AuthContext";
import { SocketContext } from "../../Socket/SocketContext";
import { AttendanceUnreadProvider } from "../AttendanceUnreadProvider";
import { useAttendanceUnread } from "../AttendanceUnreadContext";
import {
  ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS,
  fetchAttendanceUnreadConversationsCount,
  shouldReconcileAttendanceUnreadFromAppMessage,
  shouldReconcileAttendanceUnreadFromTicket,
} from "../../../utils/attendanceUnreadCount";

jest.mock("../../../utils/attendanceUnreadCount", () => {
  const actual = jest.requireActual("../../../utils/attendanceUnreadCount");
  return {
    ...actual,
    fetchAttendanceUnreadConversationsCount: jest.fn(),
  };
});

const fetchCount = fetchAttendanceUnreadConversationsCount;

function Probe({ onValue }) {
  const value = useAttendanceUnread();
  onValue(value);
  return null;
}

function renderProvider({
  user = { id: 10, companyId: 3 },
  socket,
  debounceMs = ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS,
} = {}) {
  let latest = { unreadConversationsCount: null };
  const socketManager = {
    getSocket: jest.fn(() => socket),
  };
  const handlers = {};
  const defaultSocket = socket || {
    on: jest.fn((event, cb) => {
      handlers[event] = cb;
    }),
    off: jest.fn(),
  };
  socketManager.getSocket.mockReturnValue(defaultSocket);

  render(
    <AuthContext.Provider value={{ user }}>
      <SocketContext.Provider value={socketManager}>
        <AttendanceUnreadProvider debounceMs={debounceMs}>
          <Probe onValue={(v) => { latest = v; }} />
        </AttendanceUnreadProvider>
      </SocketContext.Provider>
    </AuthContext.Provider>
  );

  return { latest: () => latest, socketManager, socket: defaultSocket, handlers };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("AttendanceUnreadProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    fetchCount.mockResolvedValue(2);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("bootstrap inicial consulta a API", async () => {
    const { latest } = renderProvider();
    await flush();
    expect(fetchCount).toHaveBeenCalledTimes(1);
    expect(latest().unreadConversationsCount).toBe(2);
  });

  it("appMessage inbound agenda refresh com debounce", async () => {
    const { handlers } = renderProvider();
    await flush();
    fetchCount.mockResolvedValue(4);

    act(() => {
      handlers["company-3-appMessage"]({
        action: "create",
        message: { fromMe: false },
        ticket: { isGroup: false },
      });
      handlers["company-3-appMessage"]({
        action: "create",
        message: { fromMe: false },
        ticket: { isGroup: false },
      });
    });

    expect(fetchCount).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS);
      await Promise.resolve();
    });
    expect(fetchCount).toHaveBeenCalledTimes(2);
  });

  it("fromMe não agenda refresh extra", async () => {
    const { handlers } = renderProvider();
    await flush();
    act(() => {
      handlers["company-3-appMessage"]({
        action: "create",
        message: { fromMe: true },
        ticket: { isGroup: false },
      });
    });
    await act(async () => {
      jest.advanceTimersByTime(ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS);
      await Promise.resolve();
    });
    expect(fetchCount).toHaveBeenCalledTimes(1);
  });

  it("updateUnread reconcilia e a leitura diminui o badge", async () => {
    const { handlers, latest } = renderProvider();
    await flush();
    expect(latest().unreadConversationsCount).toBe(2);
    fetchCount.mockResolvedValue(1);
    act(() => {
      handlers["company-3-ticket"]({ action: "updateUnread", ticketId: 9 });
    });
    await act(async () => {
      jest.advanceTimersByTime(ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS);
      await Promise.resolve();
    });
    expect(latest().unreadConversationsCount).toBe(1);
  });

  it("resolução e transferência (update) provocam refresh", async () => {
    const { handlers } = renderProvider();
    await flush();
    act(() => {
      handlers["company-3-ticket"]({
        action: "update",
        ticket: { status: "closed" },
      });
    });
    await act(async () => {
      jest.advanceTimersByTime(ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS);
      await Promise.resolve();
    });
    expect(fetchCount).toHaveBeenCalledTimes(2);

    act(() => {
      handlers["company-3-ticket"]({
        action: "update",
        ticket: { userId: 99, queueId: 2 },
      });
    });
    await act(async () => {
      jest.advanceTimersByTime(ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS);
      await Promise.resolve();
    });
    expect(fetchCount).toHaveBeenCalledTimes(3);
  });

  it("exclusão provoca refresh", async () => {
    const { handlers } = renderProvider();
    await flush();
    act(() => {
      handlers["company-3-ticket"]({ action: "delete", ticketId: 4 });
    });
    await act(async () => {
      jest.advanceTimersByTime(ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS);
      await Promise.resolve();
    });
    expect(fetchCount).toHaveBeenCalledTimes(2);
  });

  it("logout zera o contador", async () => {
    let user = { id: 10, companyId: 3 };
    let latest = { unreadConversationsCount: null };
    const socket = { on: jest.fn(), off: jest.fn() };
    const { rerender } = render(
      <AuthContext.Provider value={{ user }}>
        <SocketContext.Provider value={{ getSocket: () => socket }}>
          <AttendanceUnreadProvider>
            <Probe onValue={(v) => { latest = v; }} />
          </AttendanceUnreadProvider>
        </SocketContext.Provider>
      </AuthContext.Provider>
    );
    await flush();
    expect(latest.unreadConversationsCount).toBe(2);

    user = {};
    rerender(
      <AuthContext.Provider value={{ user }}>
        <SocketContext.Provider value={{ getSocket: () => socket }}>
          <AttendanceUnreadProvider>
            <Probe onValue={(v) => { latest = v; }} />
          </AttendanceUnreadProvider>
        </SocketContext.Provider>
      </AuthContext.Provider>
    );
    await flush();
    expect(latest.unreadConversationsCount).toBe(0);
  });

  it("troca de company zera e recarrega", async () => {
    let user = { id: 10, companyId: 3 };
    let latest = { unreadConversationsCount: null };
    const socket = { on: jest.fn(), off: jest.fn() };
    const { rerender } = render(
      <AuthContext.Provider value={{ user }}>
        <SocketContext.Provider value={{ getSocket: () => socket }}>
          <AttendanceUnreadProvider>
            <Probe onValue={(v) => { latest = v; }} />
          </AttendanceUnreadProvider>
        </SocketContext.Provider>
      </AuthContext.Provider>
    );
    await flush();
    fetchCount.mockResolvedValue(8);
    user = { id: 10, companyId: 99 };
    rerender(
      <AuthContext.Provider value={{ user }}>
        <SocketContext.Provider value={{ getSocket: () => socket }}>
          <AttendanceUnreadProvider>
            <Probe onValue={(v) => { latest = v; }} />
          </AttendanceUnreadProvider>
        </SocketContext.Provider>
      </AuthContext.Provider>
    );
    await flush();
    expect(latest.unreadConversationsCount).toBe(8);
    expect(fetchCount).toHaveBeenCalledTimes(2);
  });
});

describe("attendance unread reconcile helpers (provider wiring)", () => {
  it("helpers usados pelo provider cobrem leitura e inbound", () => {
    expect(
      shouldReconcileAttendanceUnreadFromTicket({ action: "updateUnread" })
    ).toBe(true);
    expect(
      shouldReconcileAttendanceUnreadFromAppMessage({
        action: "create",
        message: { fromMe: false },
      })
    ).toBe(true);
  });
});
