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
  buildWhatsappMessagePreview,
  getInternalChatSenderName,
  isInternalChatOpenInRoute,
  isParticipantInInternalChat,
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

const TOAST_AUTO_CLOSE_MS = 7000;
const SOUND_DEBOUNCE_MS = 1000;

function createNotificationId(dedupeKey) {
  return dedupeKey || `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function GlobalNotificationsSocketBridge({ children }) {
  const { user } = useContext(AuthContext);
  const planFlags = usePlanFlags();
  const effectiveFeatures = planFlags.effectiveFeatures || {};
  const canAccessWhatsappInbox = hasAttendanceInboxAccess(effectiveFeatures);
  const socketManager = useContext(SocketContext);
  const history = useHistory();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  const lastSoundAtRef = useRef(0);

  const {
    addNotification,
    markAsReadByChat,
    markAsReadByTicket,
    removeByTicketId,
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

  const showToast = useCallback((notification, onOpen) => {
    const toastId = notification.dedupeKey || notification.id;
    if (toast.isActive(toastId)) {
      return;
    }

    toast.info(
      ({ closeToast }) => (
        <GlobalNotificationToast
          title={notification.title}
          body={notification.body}
          onOpen={onOpen}
          closeToast={closeToast}
        />
      ),
      {
        position: "top-right",
        autoClose: TOAST_AUTO_CLOSE_MS,
        hideProgressBar: false,
        closeOnClick: false,
        toastId,
      }
    );
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

  useEffect(() => {
    const match = location.pathname.match(/^\/chats\/([^/?#]+)/);
    if (!match) return;
    const segment = match[1];
    markAsReadByChat({ chatId: segment, chatUuid: segment });
  }, [location.pathname, markAsReadByChat]);

  useEffect(() => {
    const match = location.pathname.match(/^\/tickets\/([^/?#]+)/);
    if (!match) return;
    const segment = match[1];
    markAsReadByTicket({ ticketId: segment, ticketUuid: segment });
  }, [location.pathname, markAsReadByTicket]);

  const handleWhatsappMessage = useCallback(
    (data) => {
      if (!canAccessWhatsappInbox) {
        return;
      }
      if (!shouldNotifyWhatsappMessage(data, user)) {
        return;
      }

      const { message, contact, ticket } = data;
      const dedupeKey = buildNotificationDedupeKey("whatsapp", message?.id);
      if (!dedupeKey) return;

      const contactName = contact?.name || i18n.t("globalNotifications.unknownContact");
      const preview = buildWhatsappMessagePreview(message);
      const body = preview
        ? `${contactName}: ${preview}`
        : contactName;
      const targetUrl = `/tickets/${ticket.uuid || ticket.id}`;
      const ticketOpen = isTicketOpenInRoute(ticket, locationRef.current);

      const notification = {
        id: createNotificationId(dedupeKey),
        dedupeKey,
        type: "whatsapp",
        title: i18n.t("globalNotifications.whatsappTitle"),
        body,
        createdAt: Date.now(),
        read: false,
        targetUrl,
        ticketId: ticket.id,
        ticketUuid: ticket.uuid,
        chatId: null,
        senderName: contactName,
        companyId: user?.companyId,
        messageId: message.id,
      };

      addNotification(notification);

      if (ticketOpen) {
        playSound(NOTIFICATION_SOUND_TYPES.openConversationMessage, {
          ticketId: ticket.id,
          ticketUuid: ticket.uuid,
        });
        return;
      }

      playSound(NOTIFICATION_SOUND_TYPES.newMessage, {
        ticketId: ticket.id,
        ticketUuid: ticket.uuid,
      });
      showToast(notification, () => openNotificationTarget(notification));
    },
    [
      addNotification,
      canAccessWhatsappInbox,
      openNotificationTarget,
      playSound,
      showToast,
      user,
    ]
  );

  const handleInternalChatMessage = useCallback(
    (data) => {
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

      const dedupeKey = buildNotificationDedupeKey(
        "internalChat",
        newMessage.id
      );
      if (!dedupeKey) return;

      const senderName = getInternalChatSenderName(newMessage, chat);
      const preview = buildInternalChatPreview(newMessage);
      const body = preview
        ? `${senderName}: ${preview}`
        : senderName;
      const chatPathId = chat.uuid || chat.id;
      const targetUrl = `/chats/${chatPathId}`;
      const chatOpen = isInternalChatOpenInRoute(chat, locationRef.current);

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
        companyId: user?.companyId,
        messageId: newMessage.id,
      };

      addNotification(notification);

      if (chatOpen) {
        if (openConversationEnabled) {
          playNotificationSoundThrottled(
            playNotificationSound,
            NOTIFICATION_SOUND_TYPES.openConversationMessage
          );
        }
        return;
      }

      playSound(NOTIFICATION_SOUND_TYPES.internalChat);
      showToast(notification, () => openNotificationTarget(notification));
    },
    [
      addNotification,
      openConversationEnabled,
      openNotificationTarget,
      playSound,
      showToast,
      user?.companyId,
      user?.id,
    ]
  );

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

    const onReadyJoin = () => socket.emit("joinNotification");

    const onTicket = (payload) => {
      if (payload.action === "updateUnread" || payload.action === "delete") {
        removeByTicketId(payload.ticketId);
      }
    };

    socket.on("ready", onReadyJoin);
    socket.on(ticketEvent, onTicket);
    socket.on(appMessageEvent, handleWhatsappMessage);
    socket.on(chatEvent, handleInternalChatMessage);

    return () => {
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
