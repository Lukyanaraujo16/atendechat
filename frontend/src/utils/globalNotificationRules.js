/** Som / notificação só para tickets do usuário: atribuído a ele OU sem responsável na fila dele. */
export function canUserSeeTicketByWhatsapp(ticket, user) {
  if (!ticket) return false;
  const profile = user?.profile;
  if (
    profile === "admin" ||
    profile === "supervisor" ||
    user?.supportMode === true
  ) {
    return true;
  }
  const vis = ticket?.whatsapp?.ticketVisibility || "all";
  if (vis === "admin_supervisor") {
    return false;
  }
  return true;
}

export function shouldNotifyUserAboutTicket(ticket, user) {
  if (!user?.id || !ticket || ticket.isGroup) return false;
  if (!canUserSeeTicketByWhatsapp(ticket, user)) return false;
  const myId = Number(user.id);
  const rawAssignee = ticket.userId;
  const hasAssignee =
    rawAssignee != null &&
    rawAssignee !== "" &&
    !Number.isNaN(Number(rawAssignee)) &&
    Number(rawAssignee) > 0;
  const assigneeId = hasAssignee ? Number(rawAssignee) : null;

  const queueIds = Array.isArray(user.queues)
    ? user.queues.map((q) => Number(q.id))
    : [];
  const rawQ = ticket.queueId;
  const qid =
    rawQ != null && rawQ !== "" && !Number.isNaN(Number(rawQ))
      ? Number(rawQ)
      : null;

  if (assigneeId != null && assigneeId !== myId) {
    return false;
  }
  if (assigneeId === myId) {
    return true;
  }
  return qid != null && queueIds.includes(qid);
}

export function isTicketOpenInRoute(ticket, pathname = "") {
  if (!ticket || !pathname) return false;
  const m = pathname.match(/^\/tickets\/([^/?#]+)/);
  const seg = m?.[1];
  if (!seg) return false;
  return seg === String(ticket.uuid) || seg === String(ticket.id);
}

export function isInternalChatOpenInRoute(chat, pathname = "") {
  if (!chat || !pathname) return false;
  const m = pathname.match(/^\/chats\/([^/?#]+)/);
  const seg = m?.[1];
  if (!seg) return false;
  return seg === String(chat.uuid) || seg === String(chat.id);
}

export function shouldNotifyWhatsappMessage(data, user) {
  if (data.action !== "create" || data.message?.fromMe) return false;
  if (data.message?.read) return false;
  return shouldNotifyUserAboutTicket(data.ticket, user);
}

export function isParticipantInInternalChat(chat, userId) {
  if (!chat?.users || !userId) return false;
  const myId = Number(userId);
  return chat.users.some((u) => Number(u.userId) === myId);
}

const MEDIA_PREVIEW = {
  image: "📷 Imagem",
  sticker: "📷 Imagem",
  audio: "🎧 Áudio",
  video: "🎥 Vídeo",
  document: "📄 Documento",
  application: "📄 Arquivo",
  locationMessage: "📍 Localização",
  vcard: "👤 Contato",
};

export function buildWhatsappMessagePreview(message) {
  if (!message) return "";
  const mediaType = message.mediaType;
  if (mediaType && mediaType !== "chat" && mediaType !== "conversation") {
    return MEDIA_PREVIEW[mediaType] || `[${mediaType}]`;
  }
  const body = String(message.body || "").trim();
  if (!body) return "";
  return body.length > 80 ? `${body.slice(0, 80)}…` : body;
}

export function buildInternalChatPreview(newMessage) {
  if (!newMessage) return "";
  if (newMessage.mediaName) {
    const name = String(newMessage.mediaName);
    return name.length > 60 ? `📎 ${name.slice(0, 60)}…` : `📎 ${name}`;
  }
  const msg = String(newMessage.message || "").trim();
  if (!msg) return "";
  return msg.length > 80 ? `${msg.slice(0, 80)}…` : msg;
}

export function getInternalChatSenderName(newMessage, chat) {
  if (newMessage?.sender?.name) return newMessage.sender.name;
  const sid = Number(newMessage?.senderId);
  const row = chat?.users?.find((cu) => Number(cu.userId) === sid);
  if (row?.user?.name) return row.user.name;
  return chat?.title || "";
}

export function buildNotificationDedupeKey(type, messageId) {
  if (messageId == null || messageId === "") return null;
  return `${type}:${messageId}`;
}

/** Chave estável por ticket (toast único por conversa). */
export function buildTicketNotificationDedupeKey(ticket) {
  const id = ticket?.uuid || ticket?.id;
  if (id == null || id === "") return null;
  return `whatsapp-ticket:${id}`;
}

const REALTIME_SKEW_MS = 8000;

/** Mensagem criada após o início da sessão (evita burst ao reconectar). */
export function isRealtimeInboundMessage(message, sessionStartMs) {
  if (!sessionStartMs || !message) return false;
  const raw = message.createdAt;
  if (!raw) return false;
  const ts = new Date(raw).getTime();
  if (Number.isNaN(ts)) return false;
  return ts >= sessionStartMs - REALTIME_SKEW_MS;
}

/** /tickets sem conversa aberta = toast discreto; demais rotas = normal. */
export function getWhatsappToastVariant(pathname, ticket) {
  if (isTicketOpenInRoute(ticket, pathname)) {
    return "none";
  }
  const p = String(pathname || "");
  if (p === "/tickets" || p === "/tickets/") {
    return "discrete";
  }
  return "normal";
}

export function isOnAttendanceTicketsScreen(pathname) {
  return /^\/tickets(\/|$)/.test(String(pathname || ""));
}
