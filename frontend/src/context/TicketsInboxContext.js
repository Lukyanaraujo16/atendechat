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

function countVisibleTickets(list) {
  return (Array.isArray(list) ? list : []).filter((t) => !t.isGroup).length;
}

/** Upsert da API sem remover tickets locais (socket chega antes do GET). */
function mergeColumnWithApi(prev, apiTickets) {
  const apiList = Array.isArray(apiTickets) ? apiTickets : [];
  const apiIds = new Set(apiList.map((t) => Number(t.id)));
  const safePrev = Array.isArray(prev) ? prev : [];
  const kept = safePrev.filter((t) => !apiIds.has(Number(t.id)));
  const next = mergeLoadBatch(kept, apiList);
  return { tickets: next, count: countVisibleTickets(next) };
}

const OPTIMISTIC_MOVE_MS = 2500;

function markOptimisticMove(recentMovesRef, ticket) {
  if (ticket?.id == null) return;
  recentMovesRef.current.set(Number(ticket.id), {
    at: Date.now(),
    status: String(ticket.status || "").toLowerCase(),
    chatbot: !!ticket.chatbot,
  });
}

function hasRecentOptimisticMove(recentMovesRef, ticketId) {
  const entry = recentMovesRef.current.get(Number(ticketId));
  if (!entry) return false;
  return Date.now() - entry.at < OPTIMISTIC_MOVE_MS;
}

/** GET vazio após mover ticket não pode apagar lista (corrida com backend). */
function applySafeColumnMerge(prev, apiTickets, recentMovesRef) {
  const apiList = Array.isArray(apiTickets) ? apiTickets : [];
  const safePrev = Array.isArray(prev) ? prev : [];
  if (apiList.length === 0) {
    if (safePrev.length === 0) {
      return safePrev;
    }
    const optimisticKeep = safePrev.filter((t) =>
      hasRecentOptimisticMove(recentMovesRef, t.id)
    );
    if (optimisticKeep.length > 0) {
      return optimisticKeep;
    }
    return safePrev;
  }
  return mergeColumnWithApi(safePrev, apiList).tickets;
}

/**
 * Move ticket entre colunas open / aguardando / chatbot por status+chatbot.
 * Retorna as três listas já sem duplicar o id.
 */
function computeMoveTicketToColumns(
  prevOpen,
  prevWait,
  prevChat,
  ticket,
  { pinnedOrderIds, pinnedIdSet, userId, bumpToTop = false } = {}
) {
  const id = ticket.id;
  let open = (Array.isArray(prevOpen) ? prevOpen : []).filter((t) => t.id !== id);
  let wait = (Array.isArray(prevWait) ? prevWait : []).filter((t) => t.id !== id);
  let chat = (Array.isArray(prevChat) ? prevChat : []).filter((t) => t.id !== id);

  const status = String(ticket.status || "").toLowerCase();
  if (status === "closed") {
    return { open, wait, chat };
  }

  if (status === "open") {
    const normalized = {
      ...ticket,
      status: "open",
      userId: ticket.userId ?? userId,
      isPinned: pinnedIdSet.has(Number(id)) || Boolean(ticket.isPinned),
    };
    open = sortOpenTicketsWithPins([...open, normalized], pinnedOrderIds);
    return { open, wait, chat };
  }

  if (status === "pending") {
    const normalized = { ...ticket, status: "pending" };
    if (isPendingChatbotTicket(normalized)) {
      chat = upsertTicketInList(chat, normalized, { bumpToTop });
    } else {
      wait = upsertTicketInList(wait, normalized, { bumpToTop });
    }
    return { open, wait, chat };
  }

  return { open, wait, chat };
}

/**
 * Página 1: faz upsert por id (nunca apaga tickets locais se a API vier incompleta).
 * Só poda órfãos quando o lote cobre o contador esperado (resposta completa).
 */
function applyColumnFetchBatch(
  prev,
  batch,
  pageNumber,
  recentlyDeletedRef,
  expectedCount = null
) {
  const page = Number(pageNumber) || 1;
  const raw = Array.isArray(batch) ? batch : [];
  const list =
    recentlyDeletedRef?.current?.size > 0
      ? raw.filter((t) => !recentlyDeletedRef.current.has(Number(t.id)))
      : raw;

  const listIds = new Set(list.map((t) => Number(t.id)));
  const expected = Number(expectedCount);
  const hasExpected =
    Number.isFinite(expected) && expected >= 0 ? expected : null;

  if (page <= 1) {
    if (list.length === 0) {
      if (prev.length > 0 && hasExpected != null && hasExpected > 0) {
        return prev;
      }
      return [];
    }
    const withoutIdsInBatch = prev.filter((t) => !listIds.has(Number(t.id)));
    let next = mergeLoadBatch(withoutIdsInBatch, list);
    if (hasExpected != null && list.length >= hasExpected) {
      next = next.filter((t) => listIds.has(Number(t.id)));
    }
    return next;
  }
  if (list.length === 0) {
    return prev;
  }
  const scrubbed = prev.filter((t) => !listIds.has(Number(t.id)));
  return mergeLoadBatch(scrubbed, list);
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
  const [chatbotPage, setChatbotPage] = useState(1);
  const [openReloadToken, setOpenReloadToken] = useState(0);
  const [pendingColumnLoading, setPendingColumnLoading] = useState(false);
  const [chatbotColumnLoading, setChatbotColumnLoading] = useState(false);
  const [pendingHasMore, setPendingHasMore] = useState(false);
  const [chatbotHasMore, setChatbotHasMore] = useState(false);
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
  const mismatchRetryCountRef = useRef({ open: 0, pending: 0, chatbot: 0 });
  const waitingSyncAtRef = useRef(0);
  const chatbotSyncAtRef = useRef(0);
  const syncWaitingTimerRef = useRef(null);
  const syncChatbotTimerRef = useRef(null);
  /** IDs inseridos/atualizados via socket antes do GET refletir no banco. */
  const recentSocketPendingIdsRef = useRef(new Set());
  /** Movimentação otimista (aceitar, transferir, socket) — protege contra GET vazio. */
  const recentOptimisticMovesRef = useRef(new Map());
  const openListRef = useRef([]);
  const waitingListRef = useRef([]);
  const chatbotListRef = useRef([]);

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
    mismatchRetryCountRef.current = { open: 0, pending: 0, chatbot: 0 };
  }, [queueIdsJson, showAll]);

  const fetchAllTicketsForColumn = useCallback(
    async (columnParams) => {
      const baseParams = {
        showAll,
        queueIds: queueIdsJson,
        ...columnParams,
      };
      let page = 1;
      let all = [];
      let total = 0;
      let hasMore = true;

      while (page <= 10 && hasMore) {
        const { data } = await api.get("/tickets", {
          params: { ...baseParams, pageNumber: page },
        });
        const raw = Array.isArray(data?.tickets) ? data.tickets : [];
        const batch =
          recentlyDeletedIdsRef.current.size > 0
            ? raw.filter((t) => !recentlyDeletedIdsRef.current.has(Number(t.id)))
            : raw;
        all = page === 1 ? batch : mergeLoadBatch(all, batch);
        total = typeof data?.count === "number" ? data.count : all.length;
        hasMore = Boolean(data?.hasMore);
        if (all.length >= total || batch.length === 0) {
          break;
        }
        page += 1;
      }

      const responseComplete = all.length >= total;
      return {
        tickets: all,
        count: responseComplete ? total : all.length,
        hasMore: !responseComplete && hasMore,
      };
    },
    [showAll, queueIdsJson]
  );

  const syncWaitingColumnFromApi = useCallback(
    async ({ ignoreUiGate = false } = {}) => {
      if (!fetchEnabled && !ignoreUiGate) return;
      setPendingColumnLoading(true);
      try {
        const { tickets, hasMore } = await fetchAllTicketsForColumn({
          status: "pending",
          chatbot: "false",
        });
        waitingSyncAtRef.current = Date.now();
        setWaitingTicketsList((prev) => {
          const next = applySafeColumnMerge(
            prev,
            tickets,
            recentOptimisticMovesRef
          );
          tickets.forEach((t) => {
            if (t?.id != null) {
              recentSocketPendingIdsRef.current.delete(Number(t.id));
            }
          });
          waitingListRef.current = next;
          return next;
        });
        setPendingHasMore(Boolean(hasMore));
        setPendingPage(1);
        mismatchRetryCountRef.current.pending = 0;
      } catch (err) {
        toastError(err);
      } finally {
        setPendingColumnLoading(false);
      }
    },
    [fetchEnabled, fetchAllTicketsForColumn]
  );

  const syncChatbotColumnFromApi = useCallback(
    async ({ ignoreUiGate = false } = {}) => {
      if (!fetchEnabled && !ignoreUiGate) return;
      setChatbotColumnLoading(true);
      try {
        const { tickets, hasMore } = await fetchAllTicketsForColumn({
          status: "pending",
          chatbot: "true",
        });
        chatbotSyncAtRef.current = Date.now();
        setChatbotTicketsList((prev) => {
          const next = applySafeColumnMerge(
            prev,
            tickets,
            recentOptimisticMovesRef
          );
          chatbotListRef.current = next;
          return next;
        });
        setChatbotHasMore(Boolean(hasMore));
        setChatbotPage(1);
        mismatchRetryCountRef.current.chatbot = 0;
      } catch (err) {
        toastError(err);
      } finally {
        setChatbotColumnLoading(false);
      }
    },
    [fetchEnabled, fetchAllTicketsForColumn]
  );

  const scheduleSyncWaitingColumn = useCallback(() => {
    if (!fetchEnabled) return;
    if (syncWaitingTimerRef.current) {
      clearTimeout(syncWaitingTimerRef.current);
    }
    syncWaitingTimerRef.current = setTimeout(() => {
      syncWaitingColumnFromApi({ ignoreUiGate: true });
    }, 350);
  }, [fetchEnabled, syncWaitingColumnFromApi]);

  const scheduleSyncChatbotColumn = useCallback(() => {
    if (!fetchEnabled) return;
    if (syncChatbotTimerRef.current) {
      clearTimeout(syncChatbotTimerRef.current);
    }
    syncChatbotTimerRef.current = setTimeout(() => {
      syncChatbotColumnFromApi({ ignoreUiGate: true });
    }, 350);
  }, [fetchEnabled, syncChatbotColumnFromApi]);

  const scheduleSyncBothPendingColumns = useCallback(() => {
    scheduleSyncWaitingColumn();
    scheduleSyncChatbotColumn();
  }, [scheduleSyncWaitingColumn, scheduleSyncChatbotColumn]);

  const refreshTabCounts = useCallback(async () => {
    if (!fetchEnabled) return;
    try {
      const { data: openRes } = await api.get("/tickets", {
        params: {
          pageNumber: 1,
          countOnly: true,
          showAll,
          queueIds: queueIdsJson,
          status: "open",
        },
      });
      await Promise.all([
        syncWaitingColumnFromApi(),
        syncChatbotColumnFromApi(),
      ]);
      setTabCounts((prev) => ({
        ...prev,
        open: Number(openRes?.count) || 0,
      }));
    } catch (err) {
      toastError(err);
    }
  }, [
    fetchEnabled,
    showAll,
    queueIdsJson,
    syncWaitingColumnFromApi,
    syncChatbotColumnFromApi,
  ]);

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
      if (syncWaitingTimerRef.current) {
        clearTimeout(syncWaitingTimerRef.current);
      }
      if (syncChatbotTimerRef.current) {
        clearTimeout(syncChatbotTimerRef.current);
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

  const reloadPendingList = useCallback(
    ({ force } = {}) => {
      if (force) {
        lastMismatchReloadAtRef.current.pending = 0;
        mismatchRetryCountRef.current.pending = 0;
      }
      return syncWaitingColumnFromApi({ ignoreUiGate: true });
    },
    [syncWaitingColumnFromApi]
  );

  const reloadChatbotList = useCallback(
    ({ force } = {}) => {
      if (force) {
        lastMismatchReloadAtRef.current.chatbot = 0;
        mismatchRetryCountRef.current.chatbot = 0;
      }
      return syncChatbotColumnFromApi({ ignoreUiGate: true });
    },
    [syncChatbotColumnFromApi]
  );

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

  /** pending e chatbot compartilham status; qualquer mudança exige sync das duas colunas. */
  const reloadBothPendingSubsets = useCallback(() => {
    scheduleSyncBothPendingColumns();
  }, [scheduleSyncBothPendingColumns]);

  const scheduleReloadBothPendingSubsets = useCallback(() => {
    scheduleSyncBothPendingColumns();
  }, [scheduleSyncBothPendingColumns]);

  const scheduleMismatchReload = useCallback(
    (tabKey, reloadFn, { urgent = false } = {}) => {
      if (!fetchEnabled || typeof reloadFn !== "function") return;
      if (urgent) {
        const retries = mismatchRetryCountRef.current[tabKey] || 0;
        if (retries >= 8) {
          return;
        }
        mismatchRetryCountRef.current[tabKey] = retries + 1;
      }
      const prevTimer = mismatchReloadTimersRef.current[tabKey];
      if (prevTimer) {
        clearTimeout(prevTimer);
      }
      mismatchReloadTimersRef.current[tabKey] = setTimeout(() => {
        lastMismatchReloadAtRef.current[tabKey] = Date.now();
        reloadFn();
      }, urgent ? 250 : 400);
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

  useEffect(() => {
    openListRef.current = openTicketsList;
  }, [openTicketsList]);

  useEffect(() => {
    waitingListRef.current = waitingTicketsList;
  }, [waitingTicketsList]);

  useEffect(() => {
    chatbotListRef.current = chatbotTicketsList;
  }, [chatbotTicketsList]);

  useEffect(() => {
    if (!fetchEnabled || openFetch.loading) return;
    if (openPage > 1) {
      setOpenTicketsList((prev) =>
        applyColumnFetchBatch(
          prev,
          openFetch.tickets,
          openPage,
          recentlyDeletedIdsRef,
          tabCounts.open
        )
      );
      return;
    }
    setOpenTicketsList((prev) => {
      const next = applySafeColumnMerge(
        prev,
        openFetch.tickets,
        recentOptimisticMovesRef
      );
      openListRef.current = next;
      return next;
    });
  }, [
    fetchEnabled,
    openFetch.loading,
    openFetch.tickets,
    openPage,
    reloadOpenList,
    scheduleMismatchReload,
  ]);

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

  const pinnedOrderIds = useMemo(
    () => pinnedMeta.map((row) => row.ticketId),
    [pinnedMeta]
  );

  const pinnedIdSet = useMemo(
    () => new Set(pinnedOrderIds),
    [pinnedOrderIds]
  );

  const moveTicketToColumn = useCallback(
    (ticket, { bumpToTop = false } = {}) => {
      if (!ticket?.id || isRecentlyDeleted(ticket.id)) return;
      markOptimisticMove(recentOptimisticMovesRef, ticket);
      const id = Number(ticket.id);
      recentSocketPendingIdsRef.current.add(id);
      setTimeout(() => {
        recentSocketPendingIdsRef.current.delete(id);
      }, 120000);

      const result = computeMoveTicketToColumns(
        openListRef.current,
        waitingListRef.current,
        chatbotListRef.current,
        ticket,
        { pinnedOrderIds, pinnedIdSet, userId, bumpToTop }
      );
      openListRef.current = result.open;
      waitingListRef.current = result.wait;
      chatbotListRef.current = result.chat;
      setOpenTicketsList(result.open);
      setWaitingTicketsList(result.wait);
      setChatbotTicketsList(result.chat);
    },
    [isRecentlyDeleted, pinnedOrderIds, pinnedIdSet, userId]
  );

  const reconcilePendingTicket = useCallback(
    (ticket, options = {}) => {
      moveTicketToColumn(ticket, options);
    },
    [moveTicketToColumn]
  );

  const upsertTicket = useCallback(
    (ticket) => {
      moveTicketToColumn(ticket, { bumpToTop: false });
    },
    [moveTicketToColumn]
  );

  /** pending → open: moveTicketToColumn + reload open em background. */
  const acceptTicketInInbox = useCallback(
    (ticket) => {
      if (!ticket?.id || isRecentlyDeleted(ticket.id)) return;
      const normalized = {
        ...ticket,
        status: "open",
        userId: ticket.userId ?? userId,
        isPinned: pinnedIdSet.has(Number(ticket.id)) || Boolean(ticket.isPinned),
      };
      moveTicketToColumn(normalized, { bumpToTop: true });
      scheduleReloadOpenList();
      scheduleReloadBothPendingSubsets();
    },
    [
      isRecentlyDeleted,
      userId,
      pinnedIdSet,
      moveTicketToColumn,
      scheduleReloadOpenList,
      scheduleReloadBothPendingSubsets,
    ]
  );

  const upsertTicketMessageActivity = useCallback(
    (ticket) => {
      moveTicketToColumn(ticket, { bumpToTop: true });
    },
    [moveTicketToColumn]
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
        scheduleReloadOpenList();
        scheduleSyncBothPendingColumns();
        scheduleRefreshTabCounts();
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
        const normalized = {
          ...t,
          isPinned: pinnedIdSet.has(Number(t.id)),
        };
        if (t.status === "open" || t.status === "pending") {
          if (shouldShowTicket(t)) {
            moveTicketToColumn(normalized, { bumpToTop: false });
          } else {
            removeTicket(t.id);
          }
          if (t.status === "pending") {
            scheduleSyncBothPendingColumns();
          } else {
            scheduleReloadOpenList();
            scheduleSyncBothPendingColumns();
          }
        } else {
          setPinnedMeta((prev) =>
            prev.filter((row) => row.ticketId !== Number(t.id))
          );
          moveTicketToColumn({ ...normalized, status: "closed" });
          scheduleReloadOpenList();
          scheduleSyncBothPendingColumns();
          scheduleRefreshTabCounts();
        }
      }
    };

    const handleAppMessage = (data) => {
      if (data.action !== "create" || !data.ticket) return;
      if (isRecentlyDeleted(data.ticket.id)) return;
      const t2 = data.ticket;
      if (t2.isGroup) {
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
        if (shouldShowTicket(t2)) {
          moveTicketToColumn(normalizedMsg, { bumpToTop: true });
        } else if (t2.id != null) {
          removeTicket(t2.id);
        }
        if (t2.status === "pending") {
          scheduleSyncBothPendingColumns();
        } else {
          scheduleReloadOpenList();
          scheduleSyncBothPendingColumns();
        }
      } else {
        setPinnedMeta((prev) =>
          prev.filter((row) => row.ticketId !== Number(t2.id))
        );
        moveTicketToColumn({ ...t2, status: "closed" });
        scheduleReloadOpenList();
        scheduleSyncBothPendingColumns();
        scheduleRefreshTabCounts();
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
    shouldShowTicket,
    moveTicketToColumn,
    removeTicket,
    updateUnread,
    updateContact,
    isRecentlyDeleted,
    pinnedIdSet,
    scheduleRefreshTabCounts,
    scheduleReloadOpenList,
    scheduleSyncBothPendingColumns,
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

  /** API já aplica visibilidade; só exclui grupos da coluna 1:1. */
  const pendingTickets = useMemo(
    () => (waitingTicketsList || []).filter((t) => !t.isGroup),
    [waitingTicketsList]
  );

  const chatbotTickets = useMemo(
    () => (chatbotTicketsList || []).filter((t) => !t.isGroup),
    [chatbotTicketsList]
  );

  const openStableRef = useRef(null);

  const openTickets = useMemo(() => {
    const s = stabilizeListByRef(openStableRef.current, openTicketsRaw);
    openStableRef.current = s;
    return s;
  }, [openTicketsRaw]);

  /** Contadores alinhados ao que a UI renderiza (evita contador 1 + lista vazia). */
  useEffect(() => {
    const open = openTicketsRaw.length;
    const pending = pendingTickets.length;
    const chatbot = chatbotTickets.length;
    setTabCounts((prev) =>
      prev.open === open && prev.pending === pending && prev.chatbot === chatbot
        ? prev
        : { ...prev, open, pending, chatbot }
    );
  }, [openTicketsRaw, pendingTickets, chatbotTickets]);

  const openCount = tabCounts.open;
  const pendingCount = tabCounts.pending;
  const chatbotCount = tabCounts.chatbot;

  const loadMoreOpen = useCallback(() => {
    setOpenPage((p) => p + 1);
  }, []);

  const loadMorePending = useCallback(async () => {
    if (!fetchEnabled || pendingColumnLoading || !pendingHasMore) return;
    const nextPage = pendingPage + 1;
    setPendingColumnLoading(true);
    try {
      const { data } = await api.get("/tickets", {
        params: {
          pageNumber: nextPage,
          status: "pending",
          chatbot: "false",
          showAll,
          queueIds: queueIdsJson,
        },
      });
      const batch = Array.isArray(data?.tickets) ? data.tickets : [];
      setWaitingTicketsList((prev) => mergeLoadBatch(prev, batch));
      setPendingPage(nextPage);
      setPendingHasMore(Boolean(data?.hasMore));
    } catch (err) {
      toastError(err);
    } finally {
      setPendingColumnLoading(false);
    }
  }, [
    fetchEnabled,
    pendingColumnLoading,
    pendingHasMore,
    pendingPage,
    showAll,
    queueIdsJson,
  ]);

  const loadMoreChatbot = useCallback(async () => {
    if (!fetchEnabled || chatbotColumnLoading || !chatbotHasMore) return;
    const nextPage = chatbotPage + 1;
    setChatbotColumnLoading(true);
    try {
      const { data } = await api.get("/tickets", {
        params: {
          pageNumber: nextPage,
          status: "pending",
          chatbot: "true",
          showAll,
          queueIds: queueIdsJson,
        },
      });
      const batch = Array.isArray(data?.tickets) ? data.tickets : [];
      setChatbotTicketsList((prev) => mergeLoadBatch(prev, batch));
      setChatbotPage(nextPage);
      setChatbotHasMore(Boolean(data?.hasMore));
    } catch (err) {
      toastError(err);
    } finally {
      setChatbotColumnLoading(false);
    }
  }, [
    fetchEnabled,
    chatbotColumnLoading,
    chatbotHasMore,
    chatbotPage,
    showAll,
    queueIdsJson,
  ]);

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
        loading: pendingColumnLoading,
        reload: () => {
          syncWaitingColumnFromApi();
        },
      },
      {
        key: "chatbot",
        count: tabCounts.chatbot,
        loaded: chatbotTickets.length,
        loading: chatbotColumnLoading,
        reload: () => {
          syncChatbotColumnFromApi();
        },
      },
    ];

    tabSpecs.forEach(({ key, count, loaded, loading, reload }) => {
      if (loaded >= count) {
        lastMismatchReloadAtRef.current[key] = 0;
        mismatchRetryCountRef.current[key] = 0;
        return;
      }
      if (count <= 0 || loading) {
        return;
      }
      scheduleMismatchReload(key, reload, {
        urgent: activeInboxSubTab === key,
      });
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
    pendingColumnLoading,
    chatbotColumnLoading,
    reloadOpenList,
    syncWaitingColumnFromApi,
    syncChatbotColumnFromApi,
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
      syncWaitingColumnFromApi,
      syncChatbotColumnFromApi,
    }),
    [
      openCount,
      pendingCount,
      chatbotCount,
      reloadOpenList,
      reloadPendingList,
      reloadChatbotList,
      syncWaitingColumnFromApi,
      syncChatbotColumnFromApi,
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
      loading: pendingColumnLoading,
      tabCount: pendingCount,
      hasMore: pendingHasMore,
      loadMore: loadMorePending,
    }),
    [
      pendingTickets,
      pendingColumnLoading,
      pendingCount,
      pendingHasMore,
      loadMorePending,
    ]
  );

  const chatbotColumnValue = useMemo(
    () => ({
      tickets: chatbotTickets,
      loading: chatbotColumnLoading,
      tabCount: chatbotCount,
      hasMore: chatbotHasMore,
      loadMore: loadMoreChatbot,
    }),
    [
      chatbotTickets,
      chatbotColumnLoading,
      chatbotCount,
      chatbotHasMore,
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
      loadingPending: pendingColumnLoading,
      hasMoreOpen: openFetch.hasMore,
      hasMorePending: pendingHasMore,
      loadMoreOpen,
      loadMorePending,
      upsertTicket,
      moveTicketToColumn,
      acceptTicketInInbox,
      reloadOpenList,
      reloadPendingList,
      reloadChatbotList,
      reloadBothPendingSubsets,
      scheduleReloadOpenList,
      scheduleReloadPendingList,
      scheduleReloadChatbotList,
      scheduleReloadBothPendingSubsets,
      scheduleSyncBothPendingColumns,
      syncWaitingColumnFromApi,
      syncChatbotColumnFromApi,
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
      pendingColumnLoading,
      pendingHasMore,
      loadMoreOpen,
      loadMorePending,
      upsertTicket,
      moveTicketToColumn,
      acceptTicketInInbox,
      reloadOpenList,
      reloadPendingList,
      reloadChatbotList,
      reloadBothPendingSubsets,
      scheduleReloadOpenList,
      scheduleReloadPendingList,
      scheduleReloadChatbotList,
      scheduleReloadBothPendingSubsets,
      scheduleSyncBothPendingColumns,
      syncWaitingColumnFromApi,
      syncChatbotColumnFromApi,
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
