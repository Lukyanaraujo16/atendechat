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
function isPendingChatbotTicket(ticket) {
  return !!ticket?.chatbot;
}

/** Página 1 da coluna = substituição total pela API (id único por coluna). */
function applyColumnFetchBatch(prev, batch, pageNumber, recentlyDeletedRef) {
  const page = Number(pageNumber) || 1;
  const raw = Array.isArray(batch) ? batch : [];
  const list =
    recentlyDeletedRef?.current?.size > 0
      ? raw.filter((t) => !recentlyDeletedRef.current.has(Number(t.id)))
      : raw;

  if (page <= 1) {
    return list;
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
  /** Sub-aba ativa (open | pending | chatbot) — refetch ao trocar se lista vazia e contador > 0. */
  activeInboxSubTab = "open",
}) {
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const { profile, queues } = user || {};
  const safeQueues = Array.isArray(queues) ? queues : [];

  const [openTicketsList, setOpenTicketsList] = useState([]);
  const [waitingTicketsList, setWaitingTicketsList] = useState([]);
  const [chatbotTicketsList, setChatbotTicketsList] = useState([]);
  const [openPage, setOpenPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const [openReloadToken, setOpenReloadToken] = useState(0);
  const [pendingReloadToken, setPendingReloadToken] = useState(0);
  const [chatbotPage, setChatbotPage] = useState(1);
  const [chatbotReloadToken, setChatbotReloadToken] = useState(0);
  const [pinnedMeta, setPinnedMeta] = useState([]);
  const [pinActionTicketId, setPinActionTicketId] = useState(null);
  const [tabCounts, setTabCounts] = useState({
    open: 0,
    pending: 0,
    chatbot: 0,
  });
  const recentlyDeletedIdsRef = useRef(new Set());
  const refreshCountsTimerRef = useRef(null);
  const reloadOpenTimerRef = useRef(null);
  const reloadPendingTimerRef = useRef(null);
  const reloadChatbotTimerRef = useRef(null);
  const mismatchReloadTimersRef = useRef({});
  const lastMismatchReloadAtRef = useRef({ open: 0, pending: 0, chatbot: 0 });

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
    setOpenTicketsList([]);
    setWaitingTicketsList([]);
    setChatbotTicketsList([]);
    setOpenPage(1);
    setPendingPage(1);
    setChatbotPage(1);
    setPinnedMeta([]);
    setTabCounts({ open: 0, pending: 0, chatbot: 0 });
    recentlyDeletedIdsRef.current = new Set();
    lastMismatchReloadAtRef.current = { open: 0, pending: 0, chatbot: 0 };
  }, [queueIdsJson, showAll]);

  const refreshTabCounts = useCallback(async () => {
    if (!fetchEnabled) return;
    try {
      const baseParams = {
        pageNumber: 1,
        countOnly: true,
        showAll,
        queueIds: queueIdsJson,
      };
      const [openRes, pendingRes, chatbotRes] = await Promise.all([
        api.get("/tickets", { params: { ...baseParams, status: "open" } }),
        api.get("/tickets", {
          params: { ...baseParams, status: "pending", chatbot: "false" },
        }),
        api.get("/tickets", {
          params: { ...baseParams, status: "pending", chatbot: "true" },
        }),
      ]);
      setTabCounts({
        open: Number(openRes.data?.count) || 0,
        pending: Number(pendingRes.data?.count) || 0,
        chatbot: Number(chatbotRes.data?.count) || 0,
      });
    } catch (err) {
      toastError(err);
    }
  }, [fetchEnabled, showAll, queueIdsJson]);

  const scheduleRefreshTabCounts = useCallback(() => {
    if (!fetchEnabled) return;
    if (refreshCountsTimerRef.current) {
      clearTimeout(refreshCountsTimerRef.current);
    }
    refreshCountsTimerRef.current = setTimeout(() => {
      refreshTabCounts();
    }, 400);
  }, [fetchEnabled, refreshTabCounts]);

  useEffect(() => {
    refreshTabCounts();
    return () => {
      if (refreshCountsTimerRef.current) {
        clearTimeout(refreshCountsTimerRef.current);
      }
      if (reloadOpenTimerRef.current) {
        clearTimeout(reloadOpenTimerRef.current);
      }
      if (reloadPendingTimerRef.current) {
        clearTimeout(reloadPendingTimerRef.current);
      }
      if (reloadChatbotTimerRef.current) {
        clearTimeout(reloadChatbotTimerRef.current);
      }
      Object.values(mismatchReloadTimersRef.current).forEach((id) => {
        if (id) clearTimeout(id);
      });
    };
  }, [refreshTabCounts]);

  const reloadOpenList = useCallback(({ force } = {}) => {
    if (force) {
      lastMismatchReloadAtRef.current.open = 0;
    }
    setOpenPage(1);
    setOpenReloadToken((n) => n + 1);
  }, []);

  const reloadPendingList = useCallback(({ force } = {}) => {
    if (force) {
      lastMismatchReloadAtRef.current.pending = 0;
    }
    setPendingPage(1);
    setPendingReloadToken((n) => n + 1);
  }, []);

  const reloadChatbotList = useCallback(({ force } = {}) => {
    if (force) {
      lastMismatchReloadAtRef.current.chatbot = 0;
    }
    setChatbotPage(1);
    setChatbotReloadToken((n) => n + 1);
  }, []);

  const scheduleReloadOpenList = useCallback(() => {
    if (!fetchEnabled) return;
    if (reloadOpenTimerRef.current) {
      clearTimeout(reloadOpenTimerRef.current);
    }
    reloadOpenTimerRef.current = setTimeout(() => {
      reloadOpenList();
    }, 400);
  }, [fetchEnabled, reloadOpenList]);

  const scheduleReloadPendingList = useCallback(() => {
    if (!fetchEnabled) return;
    if (reloadPendingTimerRef.current) {
      clearTimeout(reloadPendingTimerRef.current);
    }
    reloadPendingTimerRef.current = setTimeout(() => {
      reloadPendingList();
    }, 400);
  }, [fetchEnabled, reloadPendingList]);

  const scheduleReloadChatbotList = useCallback(() => {
    if (!fetchEnabled) return;
    if (reloadChatbotTimerRef.current) {
      clearTimeout(reloadChatbotTimerRef.current);
    }
    reloadChatbotTimerRef.current = setTimeout(() => {
      reloadChatbotList();
    }, 400);
  }, [fetchEnabled, reloadChatbotList]);

  /** pending e chatbot compartilham status; qualquer mudança exige os dois refetch. */
  const reloadBothPendingSubsets = useCallback(() => {
    reloadPendingList();
    reloadChatbotList();
  }, [reloadPendingList, reloadChatbotList]);

  const scheduleReloadBothPendingSubsets = useCallback(() => {
    scheduleReloadPendingList();
    scheduleReloadChatbotList();
  }, [scheduleReloadPendingList, scheduleReloadChatbotList]);

  const scheduleMismatchReload = useCallback(
    (tabKey, reloadFn) => {
      if (!fetchEnabled || typeof reloadFn !== "function") return;
      const prevTimer = mismatchReloadTimersRef.current[tabKey];
      if (prevTimer) {
        clearTimeout(prevTimer);
      }
      mismatchReloadTimersRef.current[tabKey] = setTimeout(() => {
        const now = Date.now();
        const last = lastMismatchReloadAtRef.current[tabKey] || 0;
        if (now - last < 2000) {
          return;
        }
        lastMismatchReloadAtRef.current[tabKey] = now;
        reloadFn();
      }, 400);
    },
    [fetchEnabled]
  );

  const openFetch = useTickets({
    enabled: fetchEnabled,
    pageNumber: openPage,
    reloadToken: openReloadToken,
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
    reloadToken: pendingReloadToken,
    searchParam: "",
    status: "pending",
    chatbot: "false",
    showAll,
    tags: undefined,
    users: undefined,
    queueIds: queueIdsJson,
    isGroup: undefined,
  });

  const chatbotFetch = useTickets({
    enabled: fetchEnabled,
    pageNumber: chatbotPage,
    reloadToken: chatbotReloadToken,
    searchParam: "",
    status: "pending",
    chatbot: "true",
    showAll,
    tags: undefined,
    users: undefined,
    queueIds: queueIdsJson,
    isGroup: undefined,
  });

  useEffect(() => {
    if (!fetchEnabled || openFetch.loading) return;
    setOpenTicketsList((prev) =>
      applyColumnFetchBatch(
        prev,
        openFetch.tickets,
        openPage,
        recentlyDeletedIdsRef
      )
    );
  }, [fetchEnabled, openFetch.loading, openFetch.tickets, openPage]);

  useEffect(() => {
    if (!fetchEnabled || pendingFetch.loading) return;
    setWaitingTicketsList((prev) =>
      applyColumnFetchBatch(
        prev,
        pendingFetch.tickets,
        pendingPage,
        recentlyDeletedIdsRef
      )
    );
  }, [fetchEnabled, pendingFetch.loading, pendingFetch.tickets, pendingPage]);

  useEffect(() => {
    if (!fetchEnabled || chatbotFetch.loading) return;
    setChatbotTicketsList((prev) =>
      applyColumnFetchBatch(
        prev,
        chatbotFetch.tickets,
        chatbotPage,
        recentlyDeletedIdsRef
      )
    );
  }, [fetchEnabled, chatbotFetch.loading, chatbotFetch.tickets, chatbotPage]);

  useEffect(() => {
    if (!fetchEnabled || openFetch.loading) return;
    const nextOpen = Number(openFetch.count);
    if (!Number.isFinite(nextOpen)) return;
    setTabCounts((prev) =>
      prev.open === nextOpen ? prev : { ...prev, open: nextOpen }
    );
  }, [fetchEnabled, openFetch.loading, openFetch.count]);

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

  const removeTicketFromAllColumns = useCallback((ticketId) => {
    const filterOut = (prev) => prev.filter((t) => t.id !== ticketId);
    setOpenTicketsList(filterOut);
    setWaitingTicketsList(filterOut);
    setChatbotTicketsList(filterOut);
  }, []);

  const removeTicket = useCallback((ticketId) => {
    if (ticketId == null) return;
    const id = Number(ticketId);
    recentlyDeletedIdsRef.current.add(id);
    setPinnedMeta((prev) => prev.filter((row) => row.ticketId !== id));
    setTimeout(() => {
      recentlyDeletedIdsRef.current.delete(id);
    }, 120000);
    removeTicketFromAllColumns(ticketId);
  }, [removeTicketFromAllColumns]);

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
    const filterOut = (prev) => prev.filter((t) => !idSet.has(Number(t.id)));
    setOpenTicketsList(filterOut);
    setWaitingTicketsList(filterOut);
    setChatbotTicketsList(filterOut);
  }, []);

  /** Transição chatbot ↔ aguardando: id único; remove da coluna oposta. */
  const reconcilePendingTicket = useCallback(
    (ticket, { bumpToTop = false } = {}) => {
      if (!ticket?.id || isRecentlyDeleted(ticket.id)) return;
      const id = ticket.id;
      const isBot = isPendingChatbotTicket(ticket);
      if (isBot) {
        setWaitingTicketsList((prev) => prev.filter((t) => t.id !== id));
        setChatbotTicketsList((prev) =>
          upsertTicketInList(
            prev.filter((t) => t.id !== id),
            ticket,
            { bumpToTop }
          )
        );
      } else {
        setChatbotTicketsList((prev) => prev.filter((t) => t.id !== id));
        setWaitingTicketsList((prev) =>
          upsertTicketInList(
            prev.filter((t) => t.id !== id),
            ticket,
            { bumpToTop }
          )
        );
      }
    },
    [isRecentlyDeleted]
  );

  const upsertTicket = useCallback(
    (ticket) => {
      if (!ticket?.id || isRecentlyDeleted(ticket.id)) return;
      if (ticket.status === "pending") {
        reconcilePendingTicket(ticket);
        return;
      }
      if (ticket.status === "open") {
        const id = ticket.id;
        setWaitingTicketsList((prev) => prev.filter((t) => t.id !== id));
        setChatbotTicketsList((prev) => prev.filter((t) => t.id !== id));
        setOpenTicketsList((prev) =>
          upsertTicketInList(
            prev.filter((t) => t.id !== id),
            ticket,
            { bumpToTop: false }
          )
        );
      }
    },
    [isRecentlyDeleted, reconcilePendingTicket]
  );

  const pinnedOrderIds = useMemo(
    () => pinnedMeta.map((row) => row.ticketId),
    [pinnedMeta]
  );

  const pinnedIdSet = useMemo(
    () => new Set(pinnedOrderIds),
    [pinnedOrderIds]
  );

  /** pending → open: remove de outras abas, insere em open abaixo dos fixados. */
  const acceptTicketInInbox = useCallback(
    (ticket) => {
      if (!ticket?.id || isRecentlyDeleted(ticket.id)) return;
      const normalized = {
        ...ticket,
        status: "open",
        userId: ticket.userId ?? userId,
        isPinned: pinnedIdSet.has(Number(ticket.id)) || Boolean(ticket.isPinned),
      };
      const id = normalized.id;
      setWaitingTicketsList((prev) => prev.filter((t) => t.id !== id));
      setChatbotTicketsList((prev) => prev.filter((t) => t.id !== id));
      setOpenTicketsList((prev) => {
        const rest = prev.filter((t) => t.id !== id);
        return sortOpenTicketsWithPins([...rest, normalized], pinnedOrderIds);
      });
      scheduleRefreshTabCounts();
    },
    [
      isRecentlyDeleted,
      userId,
      pinnedIdSet,
      pinnedOrderIds,
      scheduleRefreshTabCounts,
    ]
  );

  const upsertTicketMessageActivity = useCallback(
    (ticket) => {
      if (!ticket?.id || isRecentlyDeleted(ticket.id)) return;
      if (ticket.status === "pending") {
        reconcilePendingTicket(ticket, { bumpToTop: true });
        return;
      }
      if (ticket.status === "open") {
        setOpenTicketsList((prev) =>
          upsertTicketInList(prev, ticket, { bumpToTop: true })
        );
      }
    },
    [isRecentlyDeleted, reconcilePendingTicket]
  );

  const patchTicketInLists = useCallback((predicate, patch) => {
    const mapList = (prev) => {
      const idx = prev.findIndex(predicate);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch(next[idx]) };
      return next;
    };
    setOpenTicketsList(mapList);
    setWaitingTicketsList(mapList);
    setChatbotTicketsList(mapList);
  }, []);

  const updateUnread = useCallback(
    (ticketId) => {
      if (ticketId == null) return;
      patchTicketInLists(
        (t) => t.id === ticketId,
        () => ({ unreadMessages: 0 })
      );
    },
    [patchTicketInLists]
  );

  const updateContact = useCallback(
    (contact) => {
      if (!contact?.id) return;
      patchTicketInLists(
        (t) => t.contactId === contact.id,
        () => ({ contact })
      );
    },
    [patchTicketInLists]
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
          setOpenTicketsList((prev) =>
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
          setOpenTicketsList((prev) =>
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
        scheduleRefreshTabCounts();
        scheduleReloadOpenList();
        scheduleReloadPendingList();
        scheduleReloadChatbotList();
        return;
      }
      if (data.action === "update" && data.ticket) {
        const t = data.ticket;
        if (isRecentlyDeleted(t.id)) {
          return;
        }
        if (t.isGroup) {
          removeTicket(t.id);
          scheduleRefreshTabCounts();
          return;
        }
        if (!shouldShowTicket(t)) {
          removeTicket(t.id);
          scheduleRefreshTabCounts();
          scheduleReloadOpenList();
          scheduleReloadPendingList();
          scheduleReloadChatbotList();
          return;
        }
        if (t.status === "open" || t.status === "pending") {
          const normalized = {
            ...t,
            isPinned: pinnedIdSet.has(Number(t.id)),
          };
          if (t.status === "pending") {
            reconcilePendingTicket(normalized);
            scheduleReloadBothPendingSubsets();
          } else {
            upsertTicket(normalized);
            scheduleReloadOpenList();
            scheduleReloadBothPendingSubsets();
          }
        } else {
          setPinnedMeta((prev) =>
            prev.filter((row) => row.ticketId !== Number(t.id))
          );
          removeTicket(t.id);
          scheduleReloadOpenList();
          scheduleReloadPendingList();
          scheduleReloadChatbotList();
        }
        scheduleRefreshTabCounts();
      }
    };

    const handleAppMessage = (data) => {
      if (data.action !== "create" || !data.ticket) return;
      if (isRecentlyDeleted(data.ticket.id)) return;
      const t2 = data.ticket;
      if (t2.isGroup || !shouldShowTicket(t2)) {
        if (t2.id != null) {
          removeTicket(t2.id);
        }
        scheduleRefreshTabCounts();
        return;
      }
      if (t2.status === "open" || t2.status === "pending") {
        const normalizedMsg = {
          ...t2,
          isPinned: pinnedIdSet.has(Number(t2.id)),
        };
        if (t2.status === "pending") {
          reconcilePendingTicket(normalizedMsg, { bumpToTop: true });
          scheduleReloadBothPendingSubsets();
        } else {
          upsertTicketMessageActivity(normalizedMsg);
          scheduleReloadOpenList();
          scheduleReloadBothPendingSubsets();
        }
      } else {
        setPinnedMeta((prev) =>
          prev.filter((row) => row.ticketId !== Number(t2.id))
        );
        removeTicket(t2.id);
        scheduleReloadOpenList();
        scheduleReloadPendingList();
        scheduleReloadChatbotList();
      }
      scheduleRefreshTabCounts();
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
    shouldShowTicket,
    upsertTicket,
    reconcilePendingTicket,
    upsertTicketMessageActivity,
    removeTicket,
    updateUnread,
    updateContact,
    isRecentlyDeleted,
    pinnedIdSet,
    scheduleRefreshTabCounts,
    scheduleReloadOpenList,
    scheduleReloadBothPendingSubsets,
    scheduleReloadChatbotList,
  ]);

  const filterTicketsForProfile = useCallback(
    (list) => {
      const base = (Array.isArray(list) ? list : []).filter((t) => !t.isGroup);
      if (profile !== "user") {
        return base;
      }
      const queueIds = safeQueues.map((q) => q.id);
      const myId = Number(user?.id);
      return base.filter((t) => {
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
    },
    [profile, safeQueues, user?.id, user?.allTicket]
  );

  const tickets = useMemo(
    () => [...openTicketsList, ...waitingTicketsList, ...chatbotTicketsList],
    [openTicketsList, waitingTicketsList, chatbotTicketsList]
  );

  const openTicketsRaw = useMemo(() => {
    const withPinFlag = filterTicketsForProfile(openTicketsList).map((t) => ({
      ...t,
      isPinned: pinnedIdSet.has(Number(t.id)) || Boolean(t.isPinned),
    }));
    return sortOpenTicketsWithPins(withPinFlag, pinnedOrderIds);
  }, [openTicketsList, filterTicketsForProfile, pinnedOrderIds, pinnedIdSet]);

  const pendingTicketsRaw = useMemo(
    () => filterTicketsForProfile(waitingTicketsList),
    [waitingTicketsList, filterTicketsForProfile]
  );

  const chatbotTicketsRaw = useMemo(
    () => filterTicketsForProfile(chatbotTicketsList),
    [chatbotTicketsList, filterTicketsForProfile]
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

  const openCount = tabCounts.open;
  const pendingCount = tabCounts.pending;
  const chatbotCount = tabCounts.chatbot;

  const loadMoreOpen = useCallback(() => {
    setOpenPage((p) => p + 1);
  }, []);

  const loadMorePending = useCallback(() => {
    setPendingPage((p) => p + 1);
  }, []);

  const loadMoreChatbot = useCallback(() => {
    setChatbotPage((p) => p + 1);
  }, []);

  /**
   * Regra obrigatória: se contador > tickets renderizados na aba ativa, refetch da API.
   * Fonte da verdade da lista = GET /tickets (alinhado ao countOnly por chatbot).
   */
  useEffect(() => {
    if (!fetchEnabled) return;

    const tabSpecs = [
      {
        key: "open",
        count: tabCounts.open,
        loaded: openTickets.length,
        loading: openFetch.loading,
        reload: () => reloadOpenList({ force: true }),
      },
      {
        key: "pending",
        count: tabCounts.pending,
        loaded: pendingTickets.length,
        loading: pendingFetch.loading,
        reload: () => reloadPendingList({ force: true }),
      },
      {
        key: "chatbot",
        count: tabCounts.chatbot,
        loaded: chatbotTickets.length,
        loading: chatbotFetch.loading,
        reload: () => reloadChatbotList({ force: true }),
      },
    ];

    tabSpecs.forEach(({ key, count, loaded, loading, reload }) => {
      if (loaded >= count) {
        lastMismatchReloadAtRef.current[key] = 0;
        return;
      }
      if (activeInboxSubTab !== key || count <= 0 || loading) {
        return;
      }
      scheduleMismatchReload(key, reload);
    });
  }, [
    fetchEnabled,
    activeInboxSubTab,
    tabCounts.open,
    tabCounts.pending,
    tabCounts.chatbot,
    openTickets.length,
    pendingTickets.length,
    chatbotTickets.length,
    openFetch.loading,
    pendingFetch.loading,
    chatbotFetch.loading,
    reloadOpenList,
    reloadPendingList,
    reloadChatbotList,
    scheduleMismatchReload,
  ]);

  /** Ao trocar de sub-aba: refetch forçado da coluna (debounce no scheduleMismatchReload). */
  useEffect(() => {
    if (!fetchEnabled) return;
    if (activeInboxSubTab === "open") {
      scheduleMismatchReload("open", () => reloadOpenList({ force: true }));
    } else if (activeInboxSubTab === "pending") {
      scheduleMismatchReload("pending", () => reloadPendingList({ force: true }));
    } else if (activeInboxSubTab === "chatbot") {
      scheduleMismatchReload("chatbot", () => reloadChatbotList({ force: true }));
    }
  }, [
    fetchEnabled,
    activeInboxSubTab,
    reloadOpenList,
    reloadPendingList,
    reloadChatbotList,
    scheduleMismatchReload,
  ]);

  const metricsValue = useMemo(
    () => ({
      openCount,
      pendingCount,
      chatbotCount,
      reloadOpenList,
      reloadPendingList,
      reloadChatbotList,
    }),
    [
      openCount,
      pendingCount,
      chatbotCount,
      reloadOpenList,
      reloadPendingList,
      reloadChatbotList,
    ]
  );

  const openColumnValue = useMemo(
    () => ({
      tickets: openTickets,
      loading: openFetch.loading,
      tabCount: openCount,
      hasMore: openFetch.hasMore,
      loadMore: loadMoreOpen,
      toggleTicketPin,
      pinActionTicketId,
      pinnedOrderIds,
    }),
    [
      openTickets,
      openFetch.loading,
      openCount,
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
      tabCount: pendingCount,
      hasMore: pendingFetch.hasMore,
      loadMore: loadMorePending,
    }),
    [
      pendingTickets,
      pendingFetch.loading,
      pendingCount,
      pendingFetch.hasMore,
      loadMorePending,
    ]
  );

  const chatbotColumnValue = useMemo(
    () => ({
      tickets: chatbotTickets,
      loading: chatbotFetch.loading,
      tabCount: chatbotCount,
      hasMore: chatbotFetch.hasMore,
      loadMore: loadMoreChatbot,
    }),
    [
      chatbotTickets,
      chatbotFetch.loading,
      chatbotCount,
      chatbotFetch.hasMore,
      loadMoreChatbot,
    ]
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
      acceptTicketInInbox,
      reloadOpenList,
      reloadPendingList,
      reloadChatbotList,
      reloadBothPendingSubsets,
      scheduleReloadOpenList,
      scheduleReloadPendingList,
      scheduleReloadChatbotList,
      scheduleReloadBothPendingSubsets,
      refreshTabCounts,
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
      acceptTicketInInbox,
      reloadOpenList,
      reloadPendingList,
      reloadChatbotList,
      reloadBothPendingSubsets,
      scheduleReloadOpenList,
      scheduleReloadPendingList,
      scheduleReloadChatbotList,
      scheduleReloadBothPendingSubsets,
      refreshTabCounts,
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
