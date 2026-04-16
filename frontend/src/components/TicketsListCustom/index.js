import React, { useState, useEffect, useReducer, useContext, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";
import Box from "@material-ui/core/Box";
import { AppEmptyState } from "../../ui";

/**
 * Lista de tickets usada na tela de Atendimentos (fluxo atual).
 * Preferir este componente a `TicketsList` (legado).
 */
import TicketListItem from "../TicketListItemCustom";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";

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
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },

  ticketsList: {
    flex: 1,
    minHeight: 0,
    maxHeight: "100%",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    ...theme.scrollbarStyles,
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },

  ticketsListHeader: {
    color: theme.palette.text.primary,
    zIndex: 2,
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
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
  } = props;
  const classes = useStyles();
  const { ticketId: routeTicketId } = useParams();
  const [pageNumber, setPageNumber] = useState(1);
  const [ticketsList, dispatch] = useReducer(reducer, []);
  const { user } = useContext(AuthContext);
  const { profile, queues } = user || {};
  const safeQueues = Array.isArray(queues) ? queues : [];

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [status, searchParam, dispatch, showAll, tags, users, selectedQueueIds, groupsOnly]);

  const { tickets, hasMore, loading } = useTickets({
    pageNumber,
    searchParam,
    status: groupsOnly ? undefined : status,
    showAll: groupsOnly ? true : showAll,
    tags: JSON.stringify(tags),
    users: JSON.stringify(users),
    queueIds: JSON.stringify(selectedQueueIds),
    isGroup: groupsOnly ? "true" : undefined,
  });

  useEffect(() => {
    const queueIds = safeQueues.map((q) => q.id);
    const filteredTickets = tickets.filter(
      (t) => queueIds.indexOf(t.queueId) > -1
    );

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
  }, [tickets, status, searchParam, safeQueues, profile, chatbotOnly, groupsOnly]);

  useEffect(() => {
    if (!socketActive) return undefined;

    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const shouldUpdateTicket = (ticket) =>
      (groupsOnly ||
        (!ticket.userId || ticket.userId === user?.id || showAll)) &&
      (groupsOnly ||
        !ticket.queueId ||
        selectedQueueIds.indexOf(ticket.queueId) > -1);

    const notBelongsToUserQueues = (ticket) =>
      ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1;

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

    socket.on(`company-${companyId}-ticket`, (data) => {
      
      if (data.action === "updateUnread") {
        dispatch({
          type: "RESET_UNREAD",
          payload: data.ticketId,
        });
      }

      if (
        data.action === "update" &&
        shouldUpdateTicket(data.ticket) &&
        matchesTabStatus(data.ticket) &&
        (groupsOnly ? data.ticket.isGroup : !data.ticket.isGroup)
      ) {
        if (!matchesPendingChatbotTab(data.ticket)) {
          dispatch({ type: "DELETE_TICKET", payload: data.ticket.id });
          return;
        }
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
      }

      if (
        data.action === "update" &&
        !groupsOnly &&
        notBelongsToUserQueues(data.ticket)
      ) {
        dispatch({ type: "DELETE_TICKET", payload: data.ticket.id });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_TICKET", payload: data.ticketId });
      }
    });

    socket.on(`company-${companyId}-appMessage`, (data) => {
      const queueIds = safeQueues.map((q) => q.id);
      if (
        !groupsOnly &&
        profile === "user" &&
        (queueIds.indexOf(data.ticket?.queue?.id) === -1 ||
          data.ticket.queue === null)
      ) {
        return;
      }

      if (
        data.action === "create" &&
        shouldUpdateTicket(data.ticket) &&
        (groupsOnly
          ? data.ticket.isGroup && data.ticket.status !== "closed"
          : status === undefined || data.ticket.status === status) &&
        (groupsOnly ? data.ticket.isGroup : !data.ticket.isGroup)
      ) {
        if (!matchesPendingChatbotTab(data.ticket)) {
          return;
        }
        dispatch({
          type: "UPDATE_TICKET_UNREAD_MESSAGES",
          payload: data.ticket,
        });
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
  ]);

  useEffect(() => {
    if (typeof updateCount === "function") {
      updateCount(ticketsList.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketsList]);

  const loadMore = useCallback(() => {
    setPageNumber((prevState) => prevState + 1);
  }, []);

  const handleScroll = useCallback(
    (e) => {
      if (!hasMore || loading) return;

      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

      if (scrollHeight - (scrollTop + 100) < clientHeight) {
        loadMore();
      }
    },
    [hasMore, loading, loadMore]
  );

  const isRowSelected = useMemo(() => {
    if (!routeTicketId) return () => false;
    return (ticket) =>
      ticket.uuid === routeTicketId || String(ticket.id) === String(routeTicketId);
  }, [routeTicketId]);

  return (
    <Paper className={classes.ticketsListWrapper} style={style} data-tickets-list-panel>
      <Paper
        square
        name="closed"
        elevation={0}
        className={classes.ticketsList}
        onScroll={handleScroll}
      >
        <List style={{ paddingTop: 0, height: "100%" }}>
          {ticketsList.length === 0 && !loading ? (
            <AppEmptyState
              title={i18n.t("ticketsList.emptyStateTitle")}
              description={i18n.t("ticketsList.emptyStateMessage")}
              hint={i18n.t("ticketsList.emptyStateHint")}
            />
          ) : (
            <>
              {ticketsList.map((ticket) => (
                <TicketListItem
                  ticket={ticket}
                  key={ticket.id}
                  compact={compact}
                  selected={isRowSelected(ticket)}
                />
              ))}
            </>
          )}
          {loading && <TicketsListSkeleton />}
        </List>
      </Paper>
    </Paper>
  );
};

export default TicketsListCustom;
