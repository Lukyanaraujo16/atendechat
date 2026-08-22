import { createContext, useContext } from "react";

export const AttendanceUnreadContext = createContext({
  unreadConversationsCount: 0,
});

export function useAttendanceUnread() {
  return useContext(AttendanceUnreadContext);
}
