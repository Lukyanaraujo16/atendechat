import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AuthContext } from "../Auth/AuthContext";
import { SocketContext } from "../Socket/SocketContext";
import {
  ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS,
  fetchAttendanceUnreadConversationsCount,
  shouldReconcileAttendanceUnreadFromAppMessage,
  shouldReconcileAttendanceUnreadFromTicket,
} from "../../utils/attendanceUnreadCount";
import { AttendanceUnreadContext } from "./AttendanceUnreadContext";

export function AttendanceUnreadProvider({
  children,
  debounceMs = ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS,
}) {
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const [unreadConversationsCount, setUnreadConversationsCount] = useState(0);

  const userId = user?.id;
  const companyId = user?.companyId;
  const userRef = useRef(user);
  userRef.current = user;
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef(null);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    const currentUserId = userRef.current?.id;
    const currentCompanyId = userRef.current?.companyId;
    if (!currentUserId || currentCompanyId == null || currentCompanyId === "") {
      setUnreadConversationsCount(0);
      return;
    }

    const requestId = ++requestIdRef.current;
    try {
      const count = await fetchAttendanceUnreadConversationsCount();
      if (requestId !== requestIdRef.current) return;
      if (
        userRef.current?.id !== currentUserId ||
        userRef.current?.companyId !== currentCompanyId
      ) {
        return;
      }
      setUnreadConversationsCount(count);
    } catch (_err) {
      // Mantém o último valor conhecido; a API é a autoridade na próxima reconciliação.
    }
  }, []);

  const scheduleRefreshUnreadCount = useCallback(() => {
    clearDebounce();
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      refreshUnreadCount();
    }, debounceMs);
  }, [clearDebounce, debounceMs, refreshUnreadCount]);

  useEffect(() => {
    requestIdRef.current += 1;
    clearDebounce();
    setUnreadConversationsCount(0);
    if (!userId || companyId == null || companyId === "") {
      return undefined;
    }
    refreshUnreadCount();
    return () => {
      requestIdRef.current += 1;
      clearDebounce();
    };
  }, [userId, companyId, refreshUnreadCount, clearDebounce]);

  useEffect(() => {
    if (!userId || companyId == null || companyId === "" || !socketManager) {
      return undefined;
    }

    const socket = socketManager.getSocket(companyId);
    if (!socket) {
      return undefined;
    }

    const ticketEvent = `company-${companyId}-ticket`;
    const appMessageEvent = `company-${companyId}-appMessage`;

    const onTicket = (payload) => {
      if (shouldReconcileAttendanceUnreadFromTicket(payload)) {
        scheduleRefreshUnreadCount();
      }
    };

    const onAppMessage = (payload) => {
      if (shouldReconcileAttendanceUnreadFromAppMessage(payload)) {
        scheduleRefreshUnreadCount();
      }
    };

    socket.on(ticketEvent, onTicket);
    socket.on(appMessageEvent, onAppMessage);

    return () => {
      socket.off(ticketEvent, onTicket);
      socket.off(appMessageEvent, onAppMessage);
      clearDebounce();
    };
  }, [
    userId,
    companyId,
    socketManager,
    scheduleRefreshUnreadCount,
    clearDebounce,
  ]);

  const value = useMemo(
    () => ({ unreadConversationsCount }),
    [unreadConversationsCount]
  );

  return (
    <AttendanceUnreadContext.Provider value={value}>
      {children}
    </AttendanceUnreadContext.Provider>
  );
}

export default AttendanceUnreadProvider;
