/**
 * Chaves comparáveis entre notificações globais (Atividade) e persistentes (Central).
 * Só deduplicar entre fontes quando a chave for confiável ou o bridge de ticket+tipo aplicar.
 */

const TICKET_MESSAGE_TYPE_PREFIXES = [
  "ticket_message",
  "ticket_pending",
];

function normalizeId(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isNaN(n) && n > 0) return String(n);
  const s = String(value).trim();
  return s || null;
}

function normalizeTicketEventType(type) {
  const t = String(type || "").trim();
  if (!t) return "message";
  if (t === "ticket_message_inbound") return "ticket_message";
  if (t === "ticket_pending_new") return "ticket_pending";
  return t;
}

export function isCentralTicketMessageNotification(notification) {
  if (!notification) return false;
  const d = notification.data || {};
  const type = String(notification.type || d.type || "").trim();
  if (!type) return false;
  return TICKET_MESSAGE_TYPE_PREFIXES.some(
    (prefix) => type === prefix || type.startsWith(`${prefix}_`)
  );
}

export function parseGlobalWhatsappMessageId(notification) {
  if (!notification) return null;
  if (notification.messageId != null && notification.messageId !== "") {
    return String(notification.messageId);
  }
  const dk = notification.dedupeKey;
  if (typeof dk === "string" && dk.startsWith("whatsapp:")) {
    const id = dk.slice("whatsapp:".length).trim();
    return id || null;
  }
  return null;
}

export function getCentralTicketId(notification) {
  if (!notification) return null;
  const d = notification.data || {};
  return normalizeId(d.ticketId ?? notification.ticketId);
}

export function getCentralTicketUuid(notification) {
  if (!notification) return null;
  const d = notification.data || {};
  const raw = d.ticketUuid ?? notification.ticketUuid;
  if (raw == null || raw === "") return null;
  return String(raw).trim() || null;
}

/**
 * @param {object} notification
 * @param {"global"|"central"} source
 * @returns {string|null}
 */
export function getUnifiedNotificationKey(notification, source) {
  if (!notification) return null;

  if (source === "global") {
    if (notification.type === "internalChat") {
      const chatId = normalizeId(notification.chatId) || notification.chatUuid;
      const messageId = normalizeId(notification.messageId);
      if (chatId && messageId) {
        return `chat:${chatId}:message:${messageId}`;
      }
      if (chatId) {
        return `chat:${chatId}`;
      }
      if (notification.dedupeKey) {
        return `global:dedupe:${notification.dedupeKey}`;
      }
      return notification.id ? `global:id:${notification.id}` : null;
    }

    if (notification.type === "whatsapp") {
      const ticketId = normalizeId(notification.ticketId);
      const messageId = parseGlobalWhatsappMessageId(notification);
      if (ticketId && messageId) {
        return `ticket:${ticketId}:message:${messageId}`;
      }
      const ticketUuid = notification.ticketUuid
        ? String(notification.ticketUuid).trim()
        : null;
      if (ticketUuid) {
        return `ticketUuid:${ticketUuid}`;
      }
      if (ticketId) {
        return `ticket:${ticketId}:type:whatsapp`;
      }
    }

    if (notification.dedupeKey) {
      return `global:dedupe:${notification.dedupeKey}`;
    }
    return notification.id ? `global:id:${notification.id}` : null;
  }

  if (source === "central") {
    const d = notification.data || {};
    const eventType = normalizeTicketEventType(notification.type || d.type);
    const ticketId = getCentralTicketId(notification);
    const messageId = normalizeId(d.messageId ?? d.meta?.messageId);

    if (ticketId && messageId) {
      return `ticket:${ticketId}:message:${messageId}`;
    }

    if (ticketId && isCentralTicketMessageNotification(notification)) {
      return `ticket:${ticketId}:type:${eventType}`;
    }

    const ticketUuid = getCentralTicketUuid(notification);
    if (ticketUuid && isCentralTicketMessageNotification(notification)) {
      return `ticketUuid:${ticketUuid}:type:${eventType}`;
    }

    if (notification.id != null) {
      return `central:id:${notification.id}`;
    }
  }

  return null;
}

/**
 * Mesma chave exata entre fontes.
 */
export function haveExactUnifiedKey(globalNotification, centralNotification) {
  const gk = getUnifiedNotificationKey(globalNotification, "global");
  const ck = getUnifiedNotificationKey(centralNotification, "central");
  return Boolean(gk && ck && gk === ck);
}

/**
 * Bridge: WhatsApp global com messageId + Central ticket_message no mesmo ticket
 * (Central não persiste messageId no banco hoje).
 */
export function haveTicketMessageBridge(globalNotification, centralNotification) {
  if (!globalNotification || globalNotification.type !== "whatsapp") {
    return false;
  }
  if (!isCentralTicketMessageNotification(centralNotification)) {
    return false;
  }

  const globalTicketId = normalizeId(globalNotification.ticketId);
  const centralTicketId = getCentralTicketId(centralNotification);
  if (!globalTicketId || !centralTicketId) {
    return false;
  }
  if (globalTicketId !== centralTicketId) {
    return false;
  }

  const globalMsg = parseGlobalWhatsappMessageId(globalNotification);
  const d = centralNotification.data || {};
  const centralMsg = normalizeId(d.messageId ?? d.meta?.messageId);

  if (globalMsg && centralMsg) {
    return globalMsg === centralMsg;
  }

  if (globalMsg && !centralMsg) {
    return true;
  }

  return false;
}

export function areNotificationsDuplicate(globalNotification, centralNotification) {
  if (haveExactUnifiedKey(globalNotification, centralNotification)) {
    return true;
  }
  return haveTicketMessageBridge(globalNotification, centralNotification);
}

/**
 * Conta pares duplicados 1:1 entre listas (para badge).
 */
export function countCrossSourceDuplicates(globalUnread, centralUnread) {
  const globals = Array.isArray(globalUnread) ? globalUnread : [];
  const centrals = Array.isArray(centralUnread) ? centralUnread : [];
  const usedGlobal = new Set();
  const usedCentral = new Set();
  let duplicates = 0;

  centrals.forEach((central) => {
    if (usedCentral.has(central.id)) return;
    globals.forEach((global) => {
      if (usedGlobal.has(global.id)) return;
      if (areNotificationsDuplicate(global, central)) {
        duplicates += 1;
        usedGlobal.add(global.id);
        usedCentral.add(central.id);
      }
    });
  });

  return duplicates;
}

/**
 * Badge unificado com dedupe sobre itens globais + central carregada.
 * @returns {{ badgeCount: number, duplicateCount: number, globalUnreadCount: number, centralUnreadCount: number }}
 */
export function computeUnifiedBadgeCount({
  globalNotifications,
  centralUnreadCount,
  centralItems,
}) {
  const globalUnread = (Array.isArray(globalNotifications) ? globalNotifications : []).filter(
    (n) => !n.read
  );
  const centralUnreadLoaded = (Array.isArray(centralItems) ? centralItems : []).filter(
    (n) => !n.read
  );
  const apiCentralUnread = Math.max(0, Number(centralUnreadCount) || 0);

  const duplicateCount = countCrossSourceDuplicates(
    globalUnread,
    centralUnreadLoaded
  );

  const badgeCount = Math.max(
    0,
    globalUnread.length + apiCentralUnread - duplicateCount
  );

  return {
    badgeCount,
    duplicateCount,
    globalUnreadCount: globalUnread.length,
    centralUnreadCount: apiCentralUnread,
  };
}
