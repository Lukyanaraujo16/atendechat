import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthContext } from "./Auth/AuthContext";
import { SocketContext } from "./Socket/SocketContext";
import useTickets from "../hooks/useTickets";

/** Mantém a mesma referência de array se todos os elementos forem === aos anteriores (ordem e tamanho iguais). */
function stabilizeListByRef(prevList, nextList) {
  if (prevList === nextList) return prevList;
  if (!prevList || !nextList || prevList.length !== nextList.length) {
    return nextList;
  }
  for (let i = 0; i < nextList.length; i += 1) {
    if (prevList[i] !== nextList[i]) {
      return nextList;
    }
  }
  return prevList;
}

const TicketsInboxMetricsContext = createContext(null);
const TicketsInboxOpenContext = createContext(null);
const TicketsInboxPendingContext = createContext(null);
const TicketsInboxChatbotContext = createContext(null);

/** Compat: expõe o objeto completo; prefira hooks de métrica/coluna para menos re-renders. */
const TicketsInboxContext = createContext(null);

/** Mescla um lote da API no array (mesma ideia do LOAD_TICKETS do reducer antigo). */
function mergeLoadBatch(prev, batch) {
  if (!Array.isArray(batch) || batch.length === 0) {
    return prev;
  }
  const state = [...prev];
  batch.forEach((ticket) => {
    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
      if (ticket.unreadMessages > 0) {
        state.unshift(state.splice(ticketIndex, 1)[0]);
      }
    } else {
      state.push(ticket);
    }
  });
  return state;
}

function upsertTicketInList(prev, ticket, { bumpToTop } = {}) {
  if (!ticket || ticket.id == null) {
    return prev;
  }
  const idx = prev.findIndex((t) => t.id === ticket.id);
  if (idx === -1) {
    return [ticket, ...prev];
  }
  const next = [...prev];
  next[idx] = ticket;
  if (bumpToTop) {
    next.unshift(next.splice(idx, 1)[0]);
  }
  return next;
}

export function TicketsInboxProvider({
  children,
  selectedQueueIds,
  showAll,
  /** Guia “ABERTAS” ativa: busca API; inativa: mantém estado e socket. */
  inboxUiActive,
}) {
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const { profile, queues } = user || {};
  const safeQueues = Array.isArray(queues) ? queues : [];

  const [tickets, setTickets] = useState([]);
  const [openPage, setOpenPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);

  const queueIdsJson = useMemo(
    () => JSON.stringify(Array.isArray(selectedQueueIds) ? selectedQueueIds : []),
    [selectedQueueIds]
  );

  useEffect(() => {
    setTickets([]);
    setOpenPage(1);
    setPendingPage(1);
  }, [queueIdsJson, showAll]);

  const fetchEnabled = inboxUiActive !== false;

  const openFetch = useTickets({
    enabled: fetchEnabled,
    pageNumber: openPage,
    searchParam: "",
    status: "open",
    showAll,
    tags: undefined,
    users: undefined,
    queueIds: queueIdsJson,
    isGroup: undefined,
  });

  const pendingFetch = useTickets({
    enabled: fetchEnabled,
    pageNumber: pendingPage,
    searchParam: "",
    status: "pending",
    showAll,
    tags: undefined,
    users: undefined,
    queueIds: queueIdsJson,
    isGroup: undefined,
  });

  useEffect(() => {
    if (!fetchEnabled) return;
    setTickets((prev) => mergeLoadBatch(prev, openFetch.tickets));
  }, [fetchEnabled, openFetch.tickets]);

  useEffect(() => {
    if (!fetchEnabled) return;
    setTickets((prev) => mergeLoadBatch(prev, pendingFetch.tickets));
  }, [fetchEnabled, pendingFetch.tickets]);

  const userId = user?.id;
  const shouldShowTicket = useCallback(
    (ticket) => {
      if (!ticket) return false;
      if (showAll) return true;
      const myId = Number(userId);
      const assigneeRaw = ticket.userId;
      const assignee =
        assigneeRaw != null && assigneeRaw !== ""
          ? Number(assigneeRaw)
          : null;
      const selected = Array.isArray(selectedQueueIds) ? selectedQueueIds : [];

      if (assignee != null && !Number.isNaN(assignee) && assignee > 0) {
        return assignee === myId;
      }
      const qidRaw = ticket.queueId;
      const qid =
        qidRaw != null && qidRaw !== "" && !Number.isNaN(Number(qidRaw))
          ? Number(qidRaw)
          : null;
      if (qid == null) {
        return user?.allTicket === "enabled";
      }
      return selected.indexOf(qid) > -1;
    },
    [userId, showAll, selectedQueueIds, user?.allTicket]
  );

  const upsertTicket = useCallback((ticket) => {
    setTickets((prev) => upsertTicketInList(prev, ticket, { bumpToTop: false }));
  }, []);

  const upsertTicketMessageActivity = useCallback((ticket) => {
    setTickets((prev) => upsertTicketInList(prev, ticket, { bumpToTop: true }));
  }, []);

  const removeTicket = useCallback((ticketId) => {
    if (ticketId == null) return;
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
  }, []);

  const updateUnread = useCallback((ticketId) => {
    if (ticketId == null) return;
    setTickets((prev) => {
      const idx = prev.findIndex((t) => t.id === ticketId);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], unreadMessages: 0 };
      return next;
    });
  }, []);

  const updateContact = useCallback((contact) => {
    if (!contact?.id) return;
    setTickets((prev) => {
      const idx = prev.findIndex((t) => t.contactId === contact.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], contact };
      return next;
    });
  }, []);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const handleTicketEvent = (data) => {
      if (data.action === "updateUnread" && data.ticketId != null) {
        updateUnread(data.ticketId);
        return;
      }
      if (data.action === "delete" && data.ticketId != null) {
        removeTicket(data.ticketId);
        return;
      }
      if (data.action === "update" && data.ticket) {
        const t = data.ticket;
        if (t.isGroup) {
          removeTicket(t.id);
          return;
        }
        if (!shouldShowTicket(t)) {
          removeTicket(t.id);
          return;
        }
        if (t.status === "open" || t.status === "pending") {
          upsertTicket(t);
        } else {
          removeTicket(t.id);
        }
      }
    };

    const handleAppMessage = (data) => {
      if (data.action !== "create" || !data.ticket) return;
      const myId = Number(user?.id);
      const t = data.ticket;
      if (profile === "user") {
        const queueIds = safeQueues.map((q) => q.id);
        const assigneeRaw = t?.userId;
        const assignee =
          assigneeRaw != null && assigneeRaw !== ""
            ? Number(assigneeRaw)
            : null;
        if (assignee != null && !Number.isNaN(assignee) && assignee > 0) {
          if (assignee !== myId) return;
        } else {
          const qid = t?.queue?.id;
          if (qid == null) {
            if (user?.allTicket !== "enabled") return;
          } else if (queueIds.indexOf(qid) === -1) {
            return;
          }
        }
      }
      const t2 = data.ticket;
      if (t2.isGroup || !shouldShowTicket(t2)) {
        removeTicket(t2.id);
        return;
      }
      if (t2.status === "open" || t2.status === "pending") {
        upsertTicketMessageActivity(t2);
      } else {
        removeTicket(t2.id);
      }
    };

    const handleContact = (data) => {
      if (data.action === "update" && data.contact) {
        updateContact(data.contact);
      }
    };

    socket.on("ready", () => {
      socket.emit("joinTickets", "open");
      socket.emit("joinTickets", "pending");
    });

    socket.on(`company-${companyId}-ticket`, handleTicketEvent);
    socket.on(`company-${companyId}-appMessage`, handleAppMessage);
    socket.on(`company-${companyId}-contact`, handleContact);

    return () => {
      socket.off(`company-${companyId}-ticket`, handleTicketEvent);
      socket.off(`company-${companyId}-appMessage`, handleAppMessage);
      socket.off(`company-${companyId}-contact`, handleContact);
    };
  }, [
    socketManager,
    profile,
    safeQueues,
    shouldShowTicket,
    upsertTicket,
    upsertTicketMessageActivity,
    removeTicket,
    updateUnread,
    updateContact,
    user?.id,
    user?.allTicket,
  ]);

  const afterProfileFilter = useMemo(() => {
    const queueIds = safeQueues.map((q) => q.id);
    let list = tickets.filter((t) => !t.isGroup);
    if (profile === "user") {
      const myId = Number(user?.id);
      list = list.filter((t) => {
        const assigneeRaw = t.userId;
        const assignee =
          assigneeRaw != null && assigneeRaw !== ""
            ? Number(assigneeRaw)
            : null;
        if (assignee != null && !Number.isNaN(assignee) && assignee === myId) {
          return true;
        }
        if (assignee != null && !Number.isNaN(assignee)) {
          return false;
        }
        const qidRaw = t.queueId;
        const qid =
          qidRaw != null && qidRaw !== "" && !Number.isNaN(Number(qidRaw))
            ? Number(qidRaw)
            : null;
        if (qid == null) {
          return user?.allTicket === "enabled";
        }
        return queueIds.indexOf(qid) > -1;
      });
    }
    return list;
  }, [tickets, profile, safeQueues, user?.id, user?.allTicket]);

  const openTicketsRaw = useMemo(
    () => afterProfileFilter.filter((t) => t.status === "open"),
    [afterProfileFilter]
  );

  const pendingAllRaw = useMemo(
    () => afterProfileFilter.filter((t) => t.status === "pending"),
    [afterProfileFilter]
  );

  const pendingTicketsRaw = useMemo(
    () => pendingAllRaw.filter((t) => !t.chatbot),
    [pendingAllRaw]
  );

  const chatbotTicketsRaw = useMemo(
    () => pendingAllRaw.filter((t) => !!t.chatbot),
    [pendingAllRaw]
  );

  const openStableRef = useRef(null);
  const pendingStableRef = useRef(null);
  const chatbotStableRef = useRef(null);

  const openTickets = useMemo(() => {
    const s = stabilizeListByRef(openStableRef.current, openTicketsRaw);
    openStableRef.current = s;
    return s;
  }, [openTicketsRaw]);

  const pendingTickets = useMemo(() => {
    const s = stabilizeListByRef(pendingStableRef.current, pendingTicketsRaw);
    pendingStableRef.current = s;
    return s;
  }, [pendingTicketsRaw]);

  const chatbotTickets = useMemo(() => {
    const s = stabilizeListByRef(chatbotStableRef.current, chatbotTicketsRaw);
    chatbotStableRef.current = s;
    return s;
  }, [chatbotTicketsRaw]);

  const openCount = openTickets.length;
  const pendingCount = pendingTickets.length;
  const chatbotCount = chatbotTickets.length;

  const loadMoreOpen = useCallback(() => {
    setOpenPage((p) => p + 1);
  }, []);

  const loadMorePending = useCallback(() => {
    setPendingPage((p) => p + 1);
  }, []);

  const metricsValue = useMemo(
    () => ({
      openCount,
      pendingCount,
      chatbotCount,
    }),
    [openCount, pendingCount, chatbotCount]
  );

  const openColumnValue = useMemo(
    () => ({
      tickets: openTickets,
      loading: openFetch.loading,
      hasMore: openFetch.hasMore,
      loadMore: loadMoreOpen,
    }),
    [openTickets, openFetch.loading, openFetch.hasMore, loadMoreOpen]
  );

  const pendingColumnValue = useMemo(
    () => ({
      tickets: pendingTickets,
      loading: pendingFetch.loading,
      hasMore: pendingFetch.hasMore,
      loadMore: loadMorePending,
    }),
    [pendingTickets, pendingFetch.loading, pendingFetch.hasMore, loadMorePending]
  );

  const chatbotColumnValue = useMemo(
    () => ({
      tickets: chatbotTickets,
      loading: pendingFetch.loading,
      hasMore: pendingFetch.hasMore,
      loadMore: loadMorePending,
    }),
    [chatbotTickets, pendingFetch.loading, pendingFetch.hasMore, loadMorePending]
  );

  const legacyValue = useMemo(
    () => ({
      tickets,
      openTickets,
      pendingTickets,
      chatbotTickets,
      openCount,
      pendingCount,
      chatbotCount,
      loadingOpen: openFetch.loading,
      loadingPending: pendingFetch.loading,
      hasMoreOpen: openFetch.hasMore,
      hasMorePending: pendingFetch.hasMore,
      loadMoreOpen,
      loadMorePending,
      upsertTicket,
      removeTicket,
      updateUnread,
    }),
    [
      tickets,
      openTickets,
      pendingTickets,
      chatbotTickets,
      openCount,
      pendingCount,
      chatbotCount,
      openFetch.loading,
      openFetch.hasMore,
      pendingFetch.loading,
      pendingFetch.hasMore,
      loadMoreOpen,
      loadMorePending,
      upsertTicket,
      removeTicket,
      updateUnread,
    ]
  );

  return (
    <TicketsInboxMetricsContext.Provider value={metricsValue}>
      <TicketsInboxOpenContext.Provider value={openColumnValue}>
        <TicketsInboxPendingContext.Provider value={pendingColumnValue}>
          <TicketsInboxChatbotContext.Provider value={chatbotColumnValue}>
            <TicketsInboxContext.Provider value={legacyValue}>
              {children}
            </TicketsInboxContext.Provider>
          </TicketsInboxChatbotContext.Provider>
        </TicketsInboxPendingContext.Provider>
      </TicketsInboxOpenContext.Provider>
    </TicketsInboxMetricsContext.Provider>
  );
}

export function useTicketsInboxMetrics() {
  const ctx = useContext(TicketsInboxMetricsContext);
  if (!ctx) {
    throw new Error("useTicketsInboxMetrics deve ser usado dentro de TicketsInboxProvider");
  }
  return ctx;
}

export function useTicketsInboxOpenColumn() {
  const ctx = useContext(TicketsInboxOpenContext);
  if (!ctx) {
    throw new Error("useTicketsInboxOpenColumn deve ser usado dentro de TicketsInboxProvider");
  }
  return ctx;
}

export function useTicketsInboxPendingColumn() {
  const ctx = useContext(TicketsInboxPendingContext);
  if (!ctx) {
    throw new Error("useTicketsInboxPendingColumn deve ser usado dentro de TicketsInboxProvider");
  }
  return ctx;
}

export function useTicketsInboxChatbotColumn() {
  const ctx = useContext(TicketsInboxChatbotContext);
  if (!ctx) {
    throw new Error("useTicketsInboxChatbotColumn deve ser usado dentro de TicketsInboxProvider");
  }
  return ctx;
}

export function useTicketsInbox() {
  const ctx = useContext(TicketsInboxContext);
  if (!ctx) {
    throw new Error("useTicketsInbox deve ser usado dentro de TicketsInboxProvider");
  }
  return ctx;
}

export { TicketsInboxContext };
