import { useMemo, useCallback } from "react";

import {
  areNotificationsDuplicate,
  computeUnifiedBadgeCount,
} from "../../utils/notifications/getUnifiedNotificationKey";

/**
 * Badge deduplicado + helpers para marcar lida nas duas fontes.
 */
export default function useUnifiedNotificationBadge({
  globalNotifications,
  globalUnreadCount,
  centralUnreadCount,
  centralItems,
  markAsReadByChat,
  markAsReadByTicket,
  markCentralRead,
}) {
  const badgeStats = useMemo(
    () =>
      computeUnifiedBadgeCount({
        globalNotifications,
        centralUnreadCount,
        centralItems,
      }),
    [globalNotifications, centralUnreadCount, centralItems]
  );

  const badgeDisplay =
    badgeStats.badgeCount > 99 ? "99+" : badgeStats.badgeCount;

  const findCentralDuplicatesForGlobal = useCallback(
    (globalNotification) => {
      if (!globalNotification) return [];
      const list = Array.isArray(centralItems) ? centralItems : [];
      return list.filter(
        (central) =>
          !central.read && areNotificationsDuplicate(globalNotification, central)
      );
    },
    [centralItems]
  );

  const findGlobalDuplicatesForCentral = useCallback(
    (centralNotification) => {
      if (!centralNotification) return [];
      const list = Array.isArray(globalNotifications) ? globalNotifications : [];
      return list.filter(
        (global) =>
          !global.read && areNotificationsDuplicate(global, centralNotification)
      );
    },
    [globalNotifications]
  );

  /** Atividade: marca global + tenta central carregada (não bloqueia navegação). */
  const syncReadFromActivity = useCallback(
    async (globalNotification) => {
      if (!globalNotification) return;

      try {
        if (globalNotification.type === "internalChat") {
          if (typeof markAsReadByChat === "function") {
            markAsReadByChat({
              chatId: globalNotification.chatId,
              chatUuid: globalNotification.chatUuid,
            });
          }
        } else if (typeof markAsReadByTicket === "function") {
          markAsReadByTicket({
            ticketId: globalNotification.ticketId,
            ticketUuid: globalNotification.ticketUuid,
          });
        }
      } catch {
        /* noop */
      }

      const centralMatches = findCentralDuplicatesForGlobal(globalNotification);
      await Promise.all(
        centralMatches.map((central) => {
          if (typeof markCentralRead !== "function") {
            return Promise.resolve();
          }
          return markCentralRead(central).catch(() => undefined);
        })
      );
    },
    [
      markAsReadByChat,
      markAsReadByTicket,
      findCentralDuplicatesForGlobal,
      markCentralRead,
    ]
  );

  /** Central: marca persistente + tenta global correspondente. */
  const syncReadFromCentral = useCallback(
    async (centralNotification) => {
      const globalMatches = findGlobalDuplicatesForCentral(centralNotification);
      globalMatches.forEach((global) => {
        try {
          if (global.type === "internalChat") {
            if (typeof markAsReadByChat === "function") {
              markAsReadByChat({
                chatId: global.chatId,
                chatUuid: global.chatUuid,
              });
            }
          } else if (typeof markAsReadByTicket === "function") {
            markAsReadByTicket({
              ticketId: global.ticketId,
              ticketUuid: global.ticketUuid,
            });
          }
        } catch {
          /* noop */
        }
      });
    },
    [findGlobalDuplicatesForCentral, markAsReadByChat, markAsReadByTicket]
  );

  return {
    badgeCount: badgeStats.badgeCount,
    badgeDisplay,
    duplicateCount: badgeStats.duplicateCount,
    activityUnreadCount: badgeStats.globalUnreadCount,
    centralUnreadCount: badgeStats.centralUnreadCount,
    /** Contador bruto da API (aba Central). */
    centralUnreadCountRaw: Math.max(0, Number(centralUnreadCount) || 0),
    globalUnreadCountRaw: Math.max(0, Number(globalUnreadCount) || 0),
    syncReadFromActivity,
    syncReadFromCentral,
  };
}
