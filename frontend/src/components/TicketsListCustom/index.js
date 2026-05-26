import React, { useState, useEffect, useReducer, useContext, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";
import Box from "@material-ui/core/Box";
import { toast } from "react-toastify";
import { AppEmptyState } from "../../ui";
import ConfirmationModal from "../ConfirmationModal";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { canDeleteTickets } from "../../utils/canDeleteTickets";

/**
 * Lista de tickets usada na tela de Atendimentos (fluxo atual).
 * Preferir este componente a `TicketsList` (legado).
 */
import TicketListItem from "../TicketListItemCustom";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsInboxContext } from "../../context/TicketsInboxContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import {
  PANEL_RADIUS,
  getTicketPanelScrollbarStyles,
  getSubtleBorder,
  getInboxListSurface,
} from "../../theme/ticketPanelStyles";
import { filterTicketsBySearchParam } from "../../utils/ticketSearchState";

const useStyles = makeStyles((theme) => ({
  ticketsListWrapper: {
    position: "relative",
    display: "flex",
    flex: 1,
    minHeight: 0,
    width: "100%",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: getInboxListSurface(theme),
  },

  ticketsList: {
    flex: 1,
    minHeight: 0,
    maxHeight: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    boxSizing: "border-box",
    ...getTicketPanelScrollbarStyles(theme),
    borderTop: getSubtleBorder(theme),
    backgroundColor: getInboxListSurface(theme),
    padding: "10px 10px 12px",
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: PANEL_RADIUS,
  },

  listRoot: {
    width: "100%",
    boxSizing: "border-box",
    padding: 0,
    margin: 0,
  },

  ticketsListHeader: {
    color: theme.palette.text.primary,
    zIndex: 2,
    backgroundColor: theme.palette.background.paper,
    borderBottom: getSubtleBorder(theme),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  ticketsCount: {
    fontWeight: "normal",
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
    fontSize: "0.875rem",
  },

  emptyStateWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
    padding: theme.spacing(4, 2),
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_TICKETS") {
    const newTickets = action.payload;

    newTickets.forEach((ticket) => {
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

    return [...state];
  }

  if (action.type === "RESET_UNREAD") {
    const ticketId = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state[ticketIndex] = { ...state[ticketIndex], unreadMessages: 0 };
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET") {
    const ticket = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
    } else {
      state.unshift(ticket);
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
    const ticket = action.payload;

    const ticketIndex = state.findIndex((t) => t.id === ticket.id);
    if (ticketIndex !== -1) {
      state[ticketIndex] = ticket;
      state.unshift(state.splice(ticketIndex, 1)[0]);
    } else {
      state.unshift(ticket);
    }

    return [...state];
  }

  if (action.type === "UPDATE_TICKET_CONTACT") {
    const contact = action.payload;
    const ticketIndex = state.findIndex((t) => t.contactId === contact.id);
    if (ticketIndex !== -1) {
      const prev = state[ticketIndex];
      state[ticketIndex] = { ...prev, contact };
    }
    return [...state];
  }

  if (action.type === "DELETE_TICKET") {
    const ticketId = action.payload;
    const ticketIndex = state.findIndex((t) => t.id === ticketId);
    if (ticketIndex !== -1) {
      state.splice(ticketIndex, 1);
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const TicketsListCustom = (props) => {
  const {
    status,
    searchParam,
    tags,
    contactLabels,
    users,
    showAll,
    selectedQueueIds,
    chatbotOnly = false,
    /** Apenas tickets de grupo (guia Grupos); não mistura com atendimentos 1:1 */
    groupsOnly = false,
    updateCount,
    style,
    /** Lista mais densa (Fase 3) */
    compact = false,
    // false: não registra socket (ex.: lista oculta na mesma aba com outras instâncias)
    socketActive = true,
    /** Inbox: tickets vindos do TicketsInboxContext (sem reducer/socket local). */
    controlledTickets,
    controlledLoading = false,
    controlledTabCount = 0,
    controlledHasMore = false,
    onControlledLoadMore,
    enableBulkDelete = false,
    /** Modo seleção ativado pelo botão na barra de busca */
    bulkSelectMode = false,
    /** Registra API de seleção em massa para a lista ativa (barra de busca) */
    onBulkSelectionApiChange,
    showPinInboxAction = false,
    onTogglePin,
    pinActionTicketId = null,
  } = props;
  const classes = useStyles();
  const { ticketId: routeTicketId } = useParams();
  const [pageNumber, setPageNumber] = useState(1);
  const [listReloadToken, setListReloadToken] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [ticketsList, dispatch] = useReducer(reducer, []);
  const { user } = useContext(AuthContext);
  const inbox = useContext(TicketsInboxContext);
  const { profile, queues } = user || {};
  const safeQueues = Array.isArray(queues) ? queues : [];

  const socketManager = useContext(SocketContext);

  const isControlled = Array.isArray(controlledTickets);

  useEffect(() => {
    if (isControlled) return;
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [isControlled, status, searchParam, dispatch, showAll, tags, contactLabels, users, selectedQueueIds, groupsOnly]);

  const reloadUncontrolledList = useCallback(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
    setListReloadToken((t) => t + 1);
  }, []);

  const { tickets, hasMore, loading } = useTickets({
    enabled: !isControlled,
    pageNumber,
    reloadToken: listReloadToken,
    searchParam,
    status: groupsOnly ? undefined : status,
    showAll: groupsOnly ? true : showAll,
    tags: JSON.stringify(tags),
    contactLabels: contactLabels ? JSON.stringify(contactLabels) : undefined,
    users: JSON.stringify(users),
    queueIds: JSON.stringify(selectedQueueIds),
    isGroup: groupsOnly ? "true" : undefined,
  });

  useEffect(() => {
    if (isControlled) return;
    const qIds = safeQueues.map((q) => q.id);
    const filteredTickets = tickets.filter((t) => {
      if (profile !== "user" || groupsOnly) return true;
      const myId = Number(user?.id);
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
      if (!t.queueId) {
        return user?.allTicket === "enabled";
      }
      return qIds.indexOf(t.queueId) > -1;
    });

    let base =
      profile === "user" && !groupsOnly ? filteredTickets : tickets;
    if (!groupsOnly) {
      base = base.filter((t) => !t.isGroup);
    } else {
      base = base.filter((t) => t.isGroup);
    }

    /** pending: separar "Aguardando" (!chatbot) de "Chatbot" (chatbot); evita o mesmo ticket nas duas abas */
    const applyPendingChatbotSplit = (list) => {
      if (groupsOnly || status !== "pending") return list;
      return chatbotOnly
        ? list.filter((t) => !!t.chatbot)
        : list.filter((t) => !t.chatbot);
    };

    dispatch({
      type: "LOAD_TICKETS",
      payload: applyPendingChatbotSplit(base),
    });
  }, [isControlled, tickets, status, searchParam, safeQueues, profile, chatbotOnly, groupsOnly, user?.id, user?.allTicket]);

  const rawDisplayTickets = isControlled ? controlledTickets : ticketsList;
  const displayTickets = useMemo(() => {
    if (isControlled && searchParam) {
      return filterTicketsBySearchParam(rawDisplayTickets, searchParam);
    }
    return rawDisplayTickets;
  }, [isControlled, rawDisplayTickets, searchParam]);
  /** Skeleton só na carga inicial (lista vazia). Refetch com itens não bloqueia a UI. */
  const displayLoading = isControlled
    ? Boolean(controlledLoading && displayTickets.length === 0)
    : Boolean(loading && displayTickets.length === 0);
  const displayHasMore = isControlled ? controlledHasMore : hasMore;

  useEffect(() => {
    if (isControlled || !socketActive) return undefined;

    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const shouldUpdateTicket = (ticket) => {
      if (groupsOnly) return true;
      const myId = Number(user?.id);
      if (showAll) return true;
      const assigneeRaw = ticket?.userId;
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
      if (!ticket.queueId) {
        return user?.allTicket === "enabled";
      }
      return selectedQueueIds.indexOf(ticket.queueId) > -1;
    };

    /** Mesma regra da lista inicial: em pending, Chatbot vs Aguardando são mutuamente exclusivos */
    const matchesPendingChatbotTab = (ticket) => {
      if (groupsOnly || status !== "pending") return true;
      return chatbotOnly ? !!ticket.chatbot : !ticket.chatbot;
    };

    const matchesTabStatus = (ticket) => {
      if (groupsOnly) {
        return (
          ticket.isGroup &&
          ticket.status !== "closed"
        );
      }
      /** Busca (sem status): aceita qualquer status, alinhado ao handler antigo de appMessage */
      if (status === undefined || status === null) {
        return true;
      }
      return ticket.status === status;
    };

    socket.on("ready", () => {
      if (groupsOnly) {
        socket.emit("joinTickets", "open");
        socket.emit("joinTickets", "pending");
      } else if (status) {
        socket.emit("joinTickets", status);
      } else {
        socket.emit("joinNotification");
      }
    });

    const ticketFitsThisList = (ticket) => {
      if (!ticket) return false;
      if (groupsOnly) {
        return ticket.isGroup && ticket.status !== "closed";
      }
      if (!shouldUpdateTicket(ticket) || ticket.isGroup) return false;
      if (!matchesTabStatus(ticket) || !matchesPendingChatbotTab(ticket)) return false;
      return true;
    };

    socket.on(`company-${companyId}-ticket`, (data) => {
      if (data.action === "updateUnread") {
        dispatch({
          type: "RESET_UNREAD",
          payload: data.ticketId,
        });
      }

      if (data.action === "update" && data.ticket) {
        if (ticketFitsThisList(data.ticket)) {
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.debug("[ticketsList pending split]", {
              ticketId: data.ticket?.id,
              status: data.ticket?.status,
              chatbot: data.ticket?.chatbot,
              queueId: data.ticket?.queueId,
              chatbotOnly,
            });
          }
          dispatch({
            type: "UPDATE_TICKET",
            payload: data.ticket,
          });
        } else if (
          (groupsOnly && data.ticket.isGroup) ||
          (!groupsOnly && !data.ticket.isGroup)
        ) {
          /** Saiu desta aba (status/chatbot/fila) ou deixou de ser visível — remove sem F5 */
          dispatch({ type: "DELETE_TICKET", payload: data.ticket.id });
        }
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_TICKET", payload: data.ticketId });
      }
    });

    socket.on(`company-${companyId}-appMessage`, (data) => {
      if (!groupsOnly && profile === "user") {
        const myId = Number(user?.id);
        const queueIds = safeQueues.map((q) => q.id);
        const assigneeRaw = data.ticket?.userId;
        const assignee =
          assigneeRaw != null && assigneeRaw !== ""
            ? Number(assigneeRaw)
            : null;
        if (assignee != null && !Number.isNaN(assignee) && assignee > 0) {
          if (assignee !== myId) return;
        } else {
          const qidRaw = data.ticket?.queueId ?? data.ticket?.queue?.id;
          const qid =
            qidRaw != null && qidRaw !== "" && !Number.isNaN(Number(qidRaw))
              ? Number(qidRaw)
              : null;
          if (qid == null) {
            if (user?.allTicket !== "enabled") return;
          } else if (queueIds.indexOf(qid) === -1) {
            return;
          }
        }
      }

      if (data.action === "create" && data.ticket) {
        if (ticketFitsThisList(data.ticket)) {
          dispatch({
            type: "UPDATE_TICKET_UNREAD_MESSAGES",
            payload: data.ticket,
          });
        } else if (
          (groupsOnly && data.ticket.isGroup) ||
          (!groupsOnly && !data.ticket.isGroup)
        ) {
          dispatch({ type: "DELETE_TICKET", payload: data.ticket.id });
        }
      }
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update") {
        dispatch({
          type: "UPDATE_TICKET_CONTACT",
          payload: data.contact,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [
    isControlled,
    socketActive,
    status,
    showAll,
    user?.id,
    user?.profile,
    selectedQueueIds,
    tags,
    users,
    profile,
    socketManager,
    chatbotOnly,
    groupsOnly,
    user?.allTicket,
    safeQueues,
  ]);

  useEffect(() => {
    if (isControlled || typeof updateCount !== "function") return;
    updateCount(ticketsList.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, ticketsList]);

  const loadMore = useCallback(() => {
    if (isControlled) {
      if (typeof onControlledLoadMore === "function") {
        onControlledLoadMore();
      }
      return;
    }
    setPageNumber((prevState) => prevState + 1);
  }, [isControlled, onControlledLoadMore]);

  const handleScroll = useCallback(
    (e) => {
      if (!displayHasMore || displayLoading) return;

      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

      if (scrollHeight - (scrollTop + 100) < clientHeight) {
        loadMore();
      }
    },
    [displayHasMore, displayLoading, loadMore]
  );

  const isRowSelected = useMemo(() => {
    if (!routeTicketId) return () => false;
    return (ticket) =>
      ticket.uuid === routeTicketId || String(ticket.id) === String(routeTicketId);
  }, [routeTicketId]);

  const bulkDeleteAllowed = enableBulkDelete && canDeleteTickets(user);
  const bulkActiveOnCards = bulkDeleteAllowed && bulkSelectMode;
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    displayTickets.length > 0 && selectedCount === displayTickets.length;

  const handleSelectAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(displayTickets.map((t) => t.id)));
  }, [allVisibleSelected, displayTickets]);

  const clearBulkSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    if (typeof onBulkSelectionApiChange !== "function") return undefined;
    if (!bulkSelectMode || !bulkDeleteAllowed) {
      onBulkSelectionApiChange(null);
      return undefined;
    }
    onBulkSelectionApiChange({
      selectedCount,
      allVisibleSelected,
      selectAll: handleSelectAllVisible,
      clearSelection: clearBulkSelection,
      openDeleteConfirm: () => setBulkConfirmOpen(true),
    });
    return () => onBulkSelectionApiChange(null);
  }, [
    bulkSelectMode,
    bulkDeleteAllowed,
    selectedCount,
    allVisibleSelected,
    handleSelectAllVisible,
    clearBulkSelection,
    onBulkSelectionApiChange,
  ]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [status, chatbotOnly, groupsOnly, searchParam, selectedQueueIds]);

  useEffect(() => {
    if (!bulkSelectMode) {
      setSelectedIds(new Set());
      setBulkConfirmOpen(false);
    }
  }, [bulkSelectMode]);

  const toggleBulkSelect = useCallback((ticketId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const { data } = await api.delete("/tickets/batch", {
        data: { ticketIds: ids },
      });
      const deleted = data?.deletedCount ?? 0;
      const failed = data?.failedCount ?? 0;
      const removedIds =
        Array.isArray(data?.deletedIds) && data.deletedIds.length > 0
          ? data.deletedIds
          : ids;
      if (isControlled && typeof inbox?.removeTickets === "function") {
        inbox.removeTickets(removedIds);
        if (status === "open" && typeof inbox?.reloadOpenList === "function") {
          inbox.reloadOpenList();
        } else if (
          status === "pending" &&
          typeof inbox?.reloadPendingList === "function"
        ) {
          inbox.reloadPendingList();
        }
      } else if (!isControlled) {
        removedIds.forEach((ticketId) => {
          dispatch({ type: "DELETE_TICKET", payload: ticketId });
        });
        reloadUncontrolledList();
      }
      if (typeof inbox?.refreshTabCounts === "function") {
        inbox.refreshTabCounts();
      }
      if (deleted === 0 && failed > 0) {
        toast.error(i18n.t("ticket.delete.bulkNoneFailed"));
      } else if (failed > 0) {
        toast.info(
          i18n.t("ticket.delete.bulkPartial", { deleted, failed })
        );
      } else {
        toast.success(i18n.t("ticket.delete.bulkSuccess", { deleted }));
      }
      setSelectedIds(new Set());
      setBulkConfirmOpen(false);
    } catch (err) {
      toastError(err);
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <Paper square className={classes.ticketsListWrapper} style={style} data-tickets-list-panel>
      <ConfirmationModal
        title={i18n.t("ticket.delete.bulkConfirmTitle")}
        open={bulkConfirmOpen}
        onClose={setBulkConfirmOpen}
        onConfirm={handleBulkDelete}
      >
        {i18n.t("ticket.delete.bulkConfirmMessage", { count: selectedCount })}
      </ConfirmationModal>
      <Paper
        square
        name="closed"
        elevation={0}
        className={classes.ticketsList}
        onScroll={handleScroll}
      >
        <List disablePadding className={classes.listRoot}>
          {displayTickets.length === 0 && !displayLoading ? (
            <Box className={classes.emptyStateWrap}>
              <AppEmptyState
                title={i18n.t("ticketsList.emptyStateTitle")}
                description={i18n.t("ticketsList.emptyStateMessage")}
                hint={i18n.t("ticketsList.emptyStateHint")}
              />
            </Box>
          ) : (
            <>
              {displayTickets.map((ticket) => (
                <TicketListItem
                  ticket={ticket}
                  key={ticket.id}
                  compact={compact}
                  selected={isRowSelected(ticket)}
                  bulkSelectMode={bulkActiveOnCards}
                  bulkSelected={selectedIds.has(ticket.id)}
                  onBulkToggle={toggleBulkSelect}
                  showPinInboxAction={showPinInboxAction}
                  onTogglePin={onTogglePin}
                  pinLoading={pinActionTicketId === ticket.id}
                  onTicketDeleted={
                    !isControlled
                      ? (ticketId) => {
                          dispatch({ type: "DELETE_TICKET", payload: ticketId });
                          reloadUncontrolledList();
                          if (typeof inbox?.refreshTabCounts === "function") {
                            inbox.refreshTabCounts();
                          }
                        }
                      : undefined
                  }
                />
              ))}
            </>
          )}
          {displayLoading && displayTickets.length === 0 && (
            <TicketsListSkeleton />
          )}
        </List>
      </Paper>
    </Paper>
  );
};

export default TicketsListCustom;
