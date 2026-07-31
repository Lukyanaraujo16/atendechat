import React, { useCallback, useContext, useEffect, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

import { AuthContext } from "../Auth/AuthContext";
import { SocketContext } from "../Socket/SocketContext";
import {
  useNotificationSound,
  NOTIFICATION_SOUND_TYPES,
} from "../NotificationSound/NotificationSoundContext";
import { playNotificationSoundThrottled } from "../../utils/notificationSoundPlayback";
import {
  buildInternalChatPreview,
  buildNotificationDedupeKey,
  buildTicketNotificationDedupeKey,
  buildWhatsappMessagePreview,
  getInternalChatSenderName,
  getWhatsappToastVariant,
  isInternalChatOpenInRoute,
  isParticipantInInternalChat,
  isRealtimeInboundMessage,
  isTicketOpenInRoute,
  shouldNotifyWhatsappMessage,
} from "../../utils/globalNotificationRules";
import GlobalNotificationToast from "../../components/GlobalNotificationToast";
import { i18n } from "../../translate/i18n";
import {
  GlobalNotificationsStateProvider,
  useGlobalNotifications,
} from "./GlobalNotificationsContext";
import usePlanFlags from "../../hooks/usePlanFlags";
import { hasAttendanceInboxAccess } from "../../utils/attendanceAccess";
import {
  getTicketMessageToastId,
  MESSAGE_TOAST_AUTO_CLOSE_DISCRETE_MS,
  MESSAGE_TOAST_AUTO_CLOSE_MS,
  showOrUpdateMessageToast,
} from "../../utils/globalMessageToast";
import "../../styles/globalMessageToast.css";
import {
  BACKGROUND_SUMMARY_TOAST_ID,
  initPageVisibilityNotifications,
  isPageHidden,
  queueBackgroundNotification,
  registerNotificationFlushHandlers,
  shouldDeferUiNotification,
  subscribePageVisibility,
} from "../../utils/pageVisibilityNotifications";
import {
  initNotificationTabLeader,
  isNotificationTabLeader,
} from "../../utils/notificationTabLeader";
import { claimNotificationAlertId } from "../../utils/notificationAlertDedupe";
import {
  getDesktopNotificationPermission,
  showDesktopMessageNotification,
} from "../../utils/browserDesktopNotification";
import {
  resetPendingMessageTabIndicators,
  syncPendingMessageTabIndicators,
} from "../../utils/notificationTabIndicators";
import { logNotificationMetric } from "../../utils/globalNotificationMetrics";
import { useBranding } from "../Branding/BrandingContext";

const SOUND_DEBOUNCE_MS = 1000;

function createNotificationId(dedupeKey) {
  return dedupeKey || `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function resolveNotificationIcon(branding) {
  const raw = branding?.faviconUrl || branding?.menuLogoUrl || "";
  if (raw && typeof window !== "undefined") {
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  }
  if (typeof window === "undefined") return undefined;
  const base = process.env.PUBLIC_URL || "";
  return `${window.location.origin}${base}/favicon.ico`;
}

function GlobalNotificationsSocketBridge({ children }) {
  const { user } = useContext(AuthContext);
  const { branding } = useBranding() || {};
  const planFlags = usePlanFlags();
  const effectiveFeatures = planFlags.effectiveFeatures || {};
  const canAccessWhatsappInbox = hasAttendanceInboxAccess(effectiveFeatures);
  const socketManager = useContext(SocketContext);
  const history = useHistory();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  const lastSoundAtRef = useRef(0);
  const sessionStartMsRef = useRef(Date.now());
  const socketLiveRef = useRef(false);

  const {
    addNotification,
    markAsReadByChat,
    markAsReadByTicket,
    removeByTicketId,
    unreadCount,
  } = useGlobalNotifications();

  const {
    playNotificationSound,
    playContextualNotificationSound,
    openConversationEnabled,
  } = useNotificationSound();

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  const playSound = useCallback(
    (soundType, ticketMeta) => {
      if (!isNotificationTabLeader()) {
        logNotificationMetric("sound_skipped_follower_tab");
        return;
      }
      const now = Date.now();
      if (now - lastSoundAtRef.current < SOUND_DEBOUNCE_MS) {
        return;
      }
      lastSoundAtRef.current = now;

      if (
        soundType === NOTIFICATION_SOUND_TYPES.openConversationMessage &&
        !openConversationEnabled
      ) {
        return;
      }

      if (ticketMeta?.ticketId || ticketMeta?.ticketUuid) {
        playContextualNotificationSound({
          ticketId: ticketMeta.ticketId,
          ticketUuid: ticketMeta.ticketUuid,
          route: locationRef.current,
        });
        return;
      }

      playNotificationSoundThrottled(playNotificationSound, soundType);
    },
    [
      openConversationEnabled,
      playContextualNotificationSound,
      playNotificationSound,
    ]
  );

  const showWhatsappMessageToast = useCallback((notification, onOpen) => {
    const toastId =
      notification.toastId || getTicketMessageToastId(notification.ticketRef);
    if (!toastId) return;

    const variant = notification.toastVariant || "normal";
    const autoClose =
      variant === "discrete"
        ? MESSAGE_TOAST_AUTO_CLOSE_DISCRETE_MS
        : MESSAGE_TOAST_AUTO_CLOSE_MS;

    showOrUpdateMessageToast({
      toastId,
      autoClose,
      className:
        variant === "discrete"
          ? "global-message-toast global-message-toast--discrete"
          : "global-message-toast",
      onOpen,
      render: ({ closeToast }) => (
        <GlobalNotificationToast
          contactName={notification.contactName}
          preview={notification.preview}
          avatarUrl={notification.avatarUrl}
          variant={variant}
          onOpen={onOpen}
          closeToast={closeToast}
        />
      ),
    });
  }, []);

  const showBackgroundSummaryToast = useCallback((count) => {
    const total = Number(count) || 0;
    if (total <= 0) return;

    const text =
      total === 1
        ? i18n.t("globalNotifications.backgroundSummaryOne")
        : i18n.t("globalNotifications.backgroundSummary", { count: total });

    toast.info(text, {
      toastId: BACKGROUND_SUMMARY_TOAST_ID,
      position: "top-right",
      autoClose: 6000,
      hideProgressBar: false,
      closeOnClick: true,
    });
  }, []);

  const showInternalChatToast = useCallback((notification, onOpen) => {
    const toastId = notification.dedupeKey || notification.id;
    showOrUpdateMessageToast({
      toastId,
      autoClose: MESSAGE_TOAST_AUTO_CLOSE_MS,
      className: "global-message-toast",
      onOpen,
      render: ({ closeToast }) => (
        <GlobalNotificationToast
          contactName={notification.senderName}
          preview={notification.preview}
          variant="normal"
          onOpen={onOpen}
          closeToast={closeToast}
        />
      ),
    });
  }, []);

  const openNotificationTarget = useCallback(
    (notification) => {
      if (notification.type === "internalChat") {
        markAsReadByChat({
          chatId: notification.chatId,
          chatUuid: notification.chatUuid,
        });
      } else {
        markAsReadByTicket({
          ticketId: notification.ticketId,
          ticketUuid: notification.ticketUuid,
        });
      }
      if (notification.targetUrl) {
        const isTicketTarget = String(notification.targetUrl).startsWith("/tickets");
        if (isTicketTarget && !canAccessWhatsappInbox) {
          return;
        }
        history.push(notification.targetUrl);
      }
    },
    [history, markAsReadByChat, markAsReadByTicket, canAccessWhatsappInbox]
  );

  const maybeShowDesktopNotification = useCallback(
    (notification) => {
      if (!isPageHidden()) return;
      if (!isNotificationTabLeader()) {
        logNotificationMetric("desktop_skipped_follower_tab");
        return;
      }
      if (getDesktopNotificationPermission() !== "granted") {
        logNotificationMetric("desktop_skipped_permission", {
          permission: getDesktopNotificationPermission(),
        });
        return;
      }

      const tag =
        notification.type === "internalChat"
          ? `chat-${notification.chatId || notification.dedupeKey}`
          : `ticket-${notification.ticketUuid || notification.ticketId}`;

      showDesktopMessageNotification({
        title: notification.contactName || notification.title,
        body: notification.preview || notification.body || "",
        icon: resolveNotificationIcon(branding),
        tag,
        data: {
          targetUrl: notification.targetUrl,
          ticketId: notification.ticketId,
          ticketUuid: notification.ticketUuid,
          chatId: notification.chatId,
          type: notification.type,
        },
        onClick: () => openNotificationTarget(notification),
      });
      logNotificationMetric("desktop_shown", {
        type: notification.type,
        tag,
      });
    },
    [branding, openNotificationTarget]
  );

  useEffect(() => {
    const match = location.pathname.match(/^\/chats\/([^/?#]+)/);
    if (!match) return;
    const segment = match[1];
    markAsReadByChat({ chatId: segment, chatUuid: segment });
  }, [location.pathname, markAsReadByChat]);

  useEffect(() => {
    registerNotificationFlushHandlers({
      showSummaryToast: showBackgroundSummaryToast,
    });
  }, [showBackgroundSummaryToast]);

  useEffect(() => {
    const stopVisibility = initPageVisibilityNotifications();
    const stopLeader = initNotificationTabLeader();
    return () => {
      stopVisibility();
      stopLeader();
      resetPendingMessageTabIndicators();
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      syncPendingMessageTabIndicators({
        count: unreadCount,
        pageHidden: isPageHidden(),
        systemName: branding?.systemName,
      });
    };
    sync();
    return subscribePageVisibility(() => {
      sync();
    });
  }, [unreadCount, branding?.systemName]);

  useEffect(() => {
    const match = location.pathname.match(/^\/tickets\/([^/?#]+)/);
    if (!match) return;
    const segment = match[1];
    markAsReadByTicket({ ticketId: segment, ticketUuid: segment });
  }, [location.pathname, markAsReadByTicket]);

  const handleWhatsappMessage = useCallback(
    (data) => {
      if (!canAccessWhatsappInbox) {
        logNotificationMetric("whatsapp_skipped_inbox_access");
        return;
      }
      if (!socketLiveRef.current) {
        return;
      }
      if (!shouldNotifyWhatsappMessage(data, user)) {
        logNotificationMetric("whatsapp_skipped_visibility");
        return;
      }

      const { message, contact, ticket } = data;
      if (!isRealtimeInboundMessage(message, sessionStartMsRef.current)) {
        logNotificationMetric("whatsapp_skipped_stale");
        return;
      }

      const messageDedupeKey = buildNotificationDedupeKey("whatsapp", message?.id);
      const ticketDedupeKey = buildTicketNotificationDedupeKey(ticket);
      if (!messageDedupeKey) return;

      if (!claimNotificationAlertId(messageDedupeKey)) {
        logNotificationMetric("whatsapp_skipped_dedupe", {
          key: messageDedupeKey,
        });
        return;
      }

      const contactName = contact?.name || i18n.t("globalNotifications.unknownContact");
      const preview = buildWhatsappMessagePreview(message);
      const body = preview ? `${contactName}: ${preview}` : contactName;
      const targetUrl = `/tickets/${ticket.uuid || ticket.id}`;
      const ticketOpen = isTicketOpenInRoute(ticket, locationRef.current);
      const toastVariant = getWhatsappToastVariant(locationRef.current, ticket);
      const pageHidden = isPageHidden();

      const notification = {
        id: createNotificationId(messageDedupeKey),
        dedupeKey: messageDedupeKey,
        type: "whatsapp",
        title: i18n.t("globalNotifications.whatsappTitle"),
        body,
        createdAt: Date.now(),
        read: false,
        targetUrl,
        ticketId: ticket.id,
        ticketUuid: ticket.uuid,
        ticketRef: ticket,
        chatId: null,
        contactName,
        preview,
        avatarUrl: contact?.profilePicUrl || contact?.urlPicture || null,
        toastVariant,
        toastId: getTicketMessageToastId(ticket),
        senderName: contactName,
        companyId: user?.companyId,
        messageId: message.id,
        ticketListDedupeKey: ticketDedupeKey,
      };

      addNotification(notification);
      logNotificationMetric("whatsapp_received", {
        ticketId: ticket.id,
        pageHidden,
        ticketOpen,
      });

      if (pageHidden) {
        queueBackgroundNotification({ messageId: message?.id });
      }

      if (ticketOpen || toastVariant === "none") {
        playSound(NOTIFICATION_SOUND_TYPES.openConversationMessage, {
          ticketId: ticket.id,
          ticketUuid: ticket.uuid,
        });
        maybeShowDesktopNotification(notification);
        return;
      }

      playSound(NOTIFICATION_SOUND_TYPES.newMessage, {
        ticketId: ticket.id,
        ticketUuid: ticket.uuid,
      });
      maybeShowDesktopNotification(notification);

      if (!shouldDeferUiNotification()) {
        showWhatsappMessageToast(notification, () =>
          openNotificationTarget(notification)
        );
      }
    },
    [
      addNotification,
      canAccessWhatsappInbox,
      maybeShowDesktopNotification,
      openNotificationTarget,
      playSound,
      showWhatsappMessageToast,
      user,
    ]
  );

  const handleInternalChatMessage = useCallback(
    (data) => {
      if (!socketLiveRef.current) {
        return;
      }
      if (data.action !== "new-message" || !data.newMessage || !data.chat) {
        return;
      }

      const myId = Number(user?.id);
      const { newMessage, chat } = data;

      if (!isParticipantInInternalChat(chat, myId)) {
        return;
      }
      if (Number(newMessage.senderId) === myId) {
        return;
      }
      if (!isRealtimeInboundMessage(newMessage, sessionStartMsRef.current)) {
        return;
      }

      const dedupeKey = buildNotificationDedupeKey(
        "internalChat",
        newMessage.id
      );
      if (!dedupeKey) return;

      if (!claimNotificationAlertId(dedupeKey)) {
        logNotificationMetric("internal_skipped_dedupe", { key: dedupeKey });
        return;
      }

      const senderName = getInternalChatSenderName(newMessage, chat);
      const preview = buildInternalChatPreview(newMessage);
      const body = preview ? `${senderName}: ${preview}` : senderName;
      const chatPathId = chat.uuid || chat.id;
      const targetUrl = `/chats/${chatPathId}`;
      const chatOpen = isInternalChatOpenInRoute(chat, locationRef.current);
      const pageHidden = isPageHidden();

      const notification = {
        id: createNotificationId(dedupeKey),
        dedupeKey,
        type: "internalChat",
        title: i18n.t("globalNotifications.internalChatTitle"),
        body,
        createdAt: Date.now(),
        read: false,
        targetUrl,
        ticketId: null,
        chatId: chat.id,
        chatUuid: chat.uuid,
        senderName,
        contactName: senderName,
        preview,
        companyId: user?.companyId,
        messageId: newMessage.id,
      };

      addNotification(notification);

      if (pageHidden) {
        queueBackgroundNotification({ messageId: newMessage?.id });
      }

      if (chatOpen) {
        if (openConversationEnabled) {
          if (isNotificationTabLeader()) {
            playNotificationSoundThrottled(
              playNotificationSound,
              NOTIFICATION_SOUND_TYPES.openConversationMessage
            );
          }
        }
        maybeShowDesktopNotification(notification);
        return;
      }

      playSound(NOTIFICATION_SOUND_TYPES.internalChat);
      maybeShowDesktopNotification(notification);

      if (!shouldDeferUiNotification()) {
        showInternalChatToast(notification, () =>
          openNotificationTarget(notification)
        );
      }
    },
    [
      addNotification,
      maybeShowDesktopNotification,
      openConversationEnabled,
      openNotificationTarget,
      playSound,
      playNotificationSound,
      showInternalChatToast,
      user?.companyId,
      user?.id,
    ]
  );

  useEffect(() => {
    sessionStartMsRef.current = Date.now();
    socketLiveRef.current = false;
  }, [user?.companyId, user?.id]);

  useEffect(() => {
    if (!user?.companyId || !user?.id) {
      return undefined;
    }

    const socket = socketManager.getSocket(user.companyId);
    if (!socket) {
      return undefined;
    }

    const companyId = user.companyId;
    const ticketEvent = `company-${companyId}-ticket`;
    const appMessageEvent = `company-${companyId}-appMessage`;
    const chatEvent = `company-${companyId}-chat`;

    const onReadyJoin = () => {
      socket.emit("joinNotification");
      socketLiveRef.current = true;
    };

    const onTicket = (payload) => {
      if (payload.action === "updateUnread" || payload.action === "delete") {
        removeByTicketId(payload.ticketId);
      }
    };

    socket.on("ready", onReadyJoin);
    socket.on(ticketEvent, onTicket);
    socket.on(appMessageEvent, handleWhatsappMessage);
    socket.on(chatEvent, handleInternalChatMessage);

    if (socket.connected) {
      onReadyJoin();
    }

    return () => {
      socketLiveRef.current = false;
      socket.off("ready", onReadyJoin);
      socket.off(ticketEvent, onTicket);
      socket.off(appMessageEvent, handleWhatsappMessage);
      socket.off(chatEvent, handleInternalChatMessage);
    };
  }, [
    user?.companyId,
    user?.id,
    socketManager,
    handleWhatsappMessage,
    handleInternalChatMessage,
    removeByTicketId,
  ]);

  return children;
}

function GlobalNotificationsProviderInner({ children }) {
  const { user } = useContext(AuthContext);
  const providerKey = `${user?.companyId ?? ""}-${user?.id ?? ""}`;

  return (
    <GlobalNotificationsStateProvider
      key={providerKey}
      userId={user?.id}
      companyId={user?.companyId}
    >
      <GlobalNotificationsSocketBridge>{children}</GlobalNotificationsSocketBridge>
    </GlobalNotificationsStateProvider>
  );
}

export default function GlobalNotificationsProvider({ children }) {
  return (
    <GlobalNotificationsProviderInner>{children}</GlobalNotificationsProviderInner>
  );
}
