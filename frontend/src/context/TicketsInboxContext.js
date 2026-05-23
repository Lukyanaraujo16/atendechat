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
import api from "../services/api";
import toastError from "../errors/toastError";
import sortOpenTicketsWithPins from "../utils/sortOpenTicketsWithPins";

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

/**
 * Página 1: substitui todos os tickets daquele status (permite lista vazia após exclusão).
 * Páginas seguintes: apenas mescla.
 */
function applyStatusPageBatch(prev, batch, status, pageNumber, recentlyDeletedRef) {
  const page = Number(pageNumber) || 1;
  const raw = Array.isArray(batch) ? batch : [];
  const list =
    recentlyDeletedRef?.current?.size > 0
      ? raw.filter((t) => !recentlyDeletedRef.current.has(Number(t.id)))
      : raw;
  if (page <= 1) {
    const other = prev.filter((t) => t.status !== status);
    if (list.length === 0) {
      return other;
    }
    return mergeLoadBatch(other, list);
  }
  if (list.length === 0) {
    return prev;
  }
  return mergeLoadBatch(prev, list);
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
  const [pinnedMeta, setPinnedMeta] = useState([]);
  const [pinActionTicketId, setPinActionTicketId] = useState(null);
  const recentlyDeletedIdsRef = useRef(new Set());

  const queueIdsJson = useMemo(
    () => JSON.stringify(Array.isArray(selectedQueueIds) ? selectedQueueIds : []),
    [selectedQueueIds]
  );

  const fetchEnabled = inboxUiActive !== false;

  const loadPinnedTickets = useCallback(async () => {
    try {
      const { data } = await api.get("/tickets/pinned");
      const list = Array.isArray(data?.pinned) ? data.pinned : [];
      setPinnedMeta(
        list
          .map((row) => ({
            ticketId: Number(row.ticketId),
            createdAt: row.createdAt,
          }))
          .filter((row) => Number.isFinite(row.ticketId))
      );
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    if (fetchEnabled) {
      loadPinnedTickets();
    }
  }, [fetchEnabled, loadPinnedTickets, user?.id, user?.companyId]);

  useEffect(() => {
    setTickets([]);
    setOpenPage(1);
    setPendingPage(1);
    setPinnedMeta([]);
    recentlyDeletedIdsRef.current = new Set();
  }, [queueIdsJson, showAll]);

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
    if (!fetchEnabled || openFetch.loading) return;
    setTickets((prev) =>
      applyStatusPageBatch(
        prev,
        openFetch.tickets,
        "open",
        openPage,
        recentlyDeletedIdsRef
      )
    );
  }, [fetchEnabled, openFetch.loading, openFetch.tickets, openPage]);

  useEffect(() => {
    if (!fetchEnabled || pendingFetch.loading) return;
    setTickets((prev) =>
      applyStatusPageBatch(
        prev,
        pendingFetch.tickets,
        "pending",
        pendingPage,
        recentlyDeletedIdsRef
      )
    );
  }, [fetchEnabled, pendingFetch.loading, pendingFetch.tickets, pendingPage]);

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

  const isRecentlyDeleted = useCallback((ticketId) => {
    if (ticketId == null) return false;
    return recentlyDeletedIdsRef.current.has(Number(ticketId));
  }, []);

  const removeTicket = useCallback((ticketId) => {
    if (ticketId == null) return;
    const id = Number(ticketId);
    recentlyDeletedIdsRef.current.add(id);
    setPinnedMeta((prev) => prev.filter((row) => row.ticketId !== id));
    setTimeout(() => {
      recentlyDeletedIdsRef.current.delete(id);
    }, 120000);
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
  }, []);

  const removeTickets = useCallback((ticketIds) => {
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) return;
    ticketIds.forEach((ticketId) => {
      if (ticketId != null) {
        recentlyDeletedIdsRef.current.add(Number(ticketId));
      }
    });
    setTimeout(() => {
      ticketIds.forEach((ticketId) => {
        if (ticketId != null) {
          recentlyDeletedIdsRef.current.delete(Number(ticketId));
        }
      });
    }, 120000);
    const idSet = new Set(ticketIds.map((id) => Number(id)));
    setTickets((prev) => prev.filter((t) => !idSet.has(Number(t.id))));
  }, []);

  const upsertTicket = useCallback(
    (ticket) => {
      if (!ticket?.id || isRecentlyDeleted(ticket.id)) return;
      setTickets((prev) => upsertTicketInList(prev, ticket, { bumpToTop: false }));
    },
    [isRecentlyDeleted]
  );

  const upsertTicketMessageActivity = useCallback(
    (ticket) => {
      if (!ticket?.id || isRecentlyDeleted(ticket.id)) return;
      setTickets((prev) => upsertTicketInList(prev, ticket, { bumpToTop: true }));
    },
    [isRecentlyDeleted]
  );

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

  const pinnedOrderIds = useMemo(
    () => pinnedMeta.map((row) => row.ticketId),
    [pinnedMeta]
  );

  const pinnedIdSet = useMemo(
    () => new Set(pinnedOrderIds),
    [pinnedOrderIds]
  );

  const toggleTicketPin = useCallback(
    async (ticket) => {
      if (!ticket?.id || ticket.status !== "open") return;
      const ticketId = Number(ticket.id);
      const isPinned = pinnedIdSet.has(ticketId) || ticket.isPinned;
      setPinActionTicketId(ticketId);
      try {
        if (isPinned) {
          await api.delete(`/tickets/${ticketId}/pin`);
          setPinnedMeta((prev) =>
            prev.filter((row) => row.ticketId !== ticketId)
          );
          setTickets((prev) =>
            prev.map((t) =>
              t.id === ticketId ? { ...t, isPinned: false, pinnedAt: null } : t
            )
          );
        } else {
          const { data } = await api.post(`/tickets/${ticketId}/pin`);
          setPinnedMeta((prev) => {
            const next = prev.filter((row) => row.ticketId !== ticketId);
            next.push({
              ticketId,
              createdAt: data?.createdAt || new Date().toISOString(),
            });
            return next.sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
          });
          setTickets((prev) =>
            prev.map((t) =>
              t.id === ticketId
                ? {
                    ...t,
                    isPinned: true,
                    pinnedAt: data?.createdAt || new Date().toISOString(),
                  }
                : t
            )
          );
        }
      } catch (err) {
        toastError(err);
      } finally {
        setPinActionTicketId(null);
      }
    },
    [pinnedIdSet]
  );

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
        if (isRecentlyDeleted(t.id)) {
          return;
        }
        if (t.isGroup) {
          removeTicket(t.id);
          return;
        }
        if (!shouldShowTicket(t)) {
          removeTicket(t.id);
          return;
        }
        if (t.status === "open" || t.status === "pending") {
          upsertTicket({
            ...t,
            isPinned: pinnedIdSet.has(Number(t.id)),
          });
        } else {
          setPinnedMeta((prev) =>
            prev.filter((row) => row.ticketId !== Number(t.id))
          );
          removeTicket(t.id);
        }
      }
    };

    const handleAppMessage = (data) => {
      if (data.action !== "create" || !data.ticket) return;
      if (isRecentlyDeleted(data.ticket.id)) return;
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
        upsertTicketMessageActivity({
          ...t2,
          isPinned: pinnedIdSet.has(Number(t2.id)),
        });
      } else {
        setPinnedMeta((prev) =>
          prev.filter((row) => row.ticketId !== Number(t2.id))
        );
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
    isRecentlyDeleted,
    user?.id,
    user?.allTicket,
    pinnedIdSet,
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

  const openTicketsRaw = useMemo(() => {
    const openOnly = afterProfileFilter.filter((t) => t.status === "open");
    const withPinFlag = openOnly.map((t) => ({
      ...t,
      isPinned: pinnedIdSet.has(Number(t.id)) || Boolean(t.isPinned),
    }));
    return sortOpenTicketsWithPins(withPinFlag, pinnedOrderIds);
  }, [afterProfileFilter, pinnedOrderIds, pinnedIdSet]);

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
      toggleTicketPin,
      pinActionTicketId,
      pinnedOrderIds,
    }),
    [
      openTickets,
      openFetch.loading,
      openFetch.hasMore,
      loadMoreOpen,
      toggleTicketPin,
      pinActionTicketId,
      pinnedOrderIds,
    ]
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
      removeTickets,
      updateUnread,
      toggleTicketPin,
      pinActionTicketId,
      pinnedOrderIds,
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
      removeTickets,
      updateUnread,
      toggleTicketPin,
      pinActionTicketId,
      pinnedOrderIds,
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
