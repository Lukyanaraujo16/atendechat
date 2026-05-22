import React, { useState, useEffect, useContext, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";

import { toast } from "react-toastify";
import clsx from "clsx";

import { Paper, makeStyles } from "@material-ui/core";

import ErrorBoundary from "../ErrorBoundary";
import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInputCustom/";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import ReassignOrphanWhatsappModal from "../ReassignOrphanWhatsappModal";
import TicketActionButtons from "../TicketActionButtonsCustom";
import TicketActionModals from "../TicketActionModals";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useGlobalNotifications } from "../../context/GlobalNotifications/GlobalNotificationsContext";
import { TagsContainer } from "../TagsContainer";
import { SocketContext } from "../../context/Socket/SocketContext";
import { i18n } from "../../translate/i18n";
import QuickMessageChatModal from "../QuickMessageChatModal";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import { canAccessTicket } from "../../utils/canAccessTicket";
import { canDeleteTickets } from "../../utils/canDeleteTickets";
import { TicketsSetContext } from "../../context/Tickets/TicketsContext";
import { TicketsInboxContext } from "../../context/TicketsInboxContext";
import getTicketViewState, {
  TICKET_VIEW_STATE,
} from "../../utils/getTicketViewState";
import TicketStateBanner from "../TicketStateBanner";
import TicketOrphanComposer from "../TicketOrphanComposer";
import { useAcceptTicket } from "../../hooks/useAcceptTicket";
import {
  PANEL_RADIUS,
  getPanelElevation,
  getChatPanelBackground,
} from "../../theme/ticketPanelStyles";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flex: 1,
    minHeight: 0,
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  ticketPanel: {
    flex: 1,
    minHeight: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: PANEL_RADIUS,
    borderBottomRightRadius: PANEL_RADIUS,
    border: "none",
    background: getChatPanelBackground(theme),
    boxShadow: getPanelElevation(theme),
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  mainWrapperShift: {
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  },

  chatBody: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: theme.palette.background.default,
  },

  chatBodyMain: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  messageInputFooter: {
    flexShrink: 0,
    backgroundColor: theme.palette.background.paper,
    borderBottomRightRadius: PANEL_RADIUS,
  },

  tagsBar: {
    flexShrink: 0,
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();

  const { user } = useContext(AuthContext);
  const userRef = useRef(user);
  userRef.current = user;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [crmPanelRefreshKey, setCrmPanelRefreshKey] = useState(0);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
  const chatInputControllerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [partialEnrichWarning, setPartialEnrichWarning] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState(false);

  const socketManager = useContext(SocketContext);
  const setCurrentTicket = useContext(TicketsSetContext);
  const inbox = useContext(TicketsInboxContext);
  const { completeAcceptTicket } = useAcceptTicket();
  const { markAsReadByTicket } = useGlobalNotifications();
  const mayDelete = canDeleteTickets(user);
  const ticketRef = useRef(ticket);
  ticketRef.current = ticket;

  useEffect(() => {
    setPartialEnrichWarning(false);
  }, [ticketId]);

  useEffect(() => {
    if (!ticket?.id) return;
    markAsReadByTicket({
      ticketId: ticket.id,
      ticketUuid: ticket.uuid,
    });
  }, [ticket?.id, ticket?.uuid, markAsReadByTicket]);

  useEffect(() => {
    setLoading(true);
    setTicket({});
    setContact({});
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          const { data } = await api.get("/tickets/u/" + ticketId);
          const u = userRef.current;

          if (!canAccessTicket(u, data)) {
            toast.error(i18n.t("tickets.toasts.unauthorized"));
            history.push("/tickets");
            return;
          }

          setContact(data.contact);
          setTicket(data);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, history]);

  /** Heartbeat Fase 4: não enviar push enquanto o ticket está aberto e visível. */
  useEffect(() => {
    const numericId = ticket?.id;
    if (!numericId) {
      return undefined;
    }
    const companyId = localStorage.getItem("companyId");
    if (!companyId) {
      return undefined;
    }

    const INTERVAL_MS = 18000;

    const ping = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      api.post(`/tickets/${numericId}/active-view`).catch(() => {});
    };

    ping();
    const intervalId = setInterval(ping, INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        ping();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ticket?.id]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    const joinRoom = () => {
      const id = ticketRef.current?.id;
      if (id) socket.emit("joinChatBox", `${id}`);
    };

    const handleTicket = (data) => {
      const id = ticketRef.current?.id;
      if (!id) return;
      if (data.action === "update" && data.ticket?.id === id) {
        setTicket(data.ticket);
      }
      if (data.action === "delete" && data.ticketId === id) {
        history.push("/tickets");
      }
    };

    const handleContact = (data) => {
      if (data.action === "update") {
        setContact((prevState) => {
          if (prevState.id === data.contact?.id) {
            const next = { ...prevState, ...data.contact };
            if (data.contact?.labels) {
              next.labels = data.contact.labels;
            }
            return next;
          }
          return prevState;
        });
      }
    };

    socket.on("ready", joinRoom);
    socket.on(`company-${companyId}-ticket`, handleTicket);
    socket.on(`company-${companyId}-contact`, handleContact);

    if (ticket?.id) {
      socket.emit("joinChatBox", `${ticket.id}`);
    }

    return () => {
      socket.off("ready", joinRoom);
      socket.off(`company-${companyId}-ticket`, handleTicket);
      socket.off(`company-${companyId}-contact`, handleContact);
    };
  }, [ticketId, history, socketManager, ticket?.id]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const viewState = getTicketViewState(ticket, { loading });
  const isOrphanView = viewState === TICKET_VIEW_STATE.ORPHAN;

  const handleFinalizeTicket = async () => {
    if (!ticket?.id) return;
    setStatusActionLoading(true);
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: "closed",
        userId: user?.id || null,
        useIntegration: false,
        promptId: false,
        integrationId: false,
      });
      history.push("/tickets");
    } catch (err) {
      toastError(err);
    } finally {
      setStatusActionLoading(false);
    }
  };

  const handleReopenOrphanTicket = async () => {
    if (!ticket?.id) return;
    setStatusActionLoading(true);
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: "open",
        userId: user?.id || null,
      });
      const { data } = await api.get("/tickets/u/" + ticketId);
      setTicket(data);
      setContact(data.contact);
    } catch (err) {
      toastError(err);
    } finally {
      setStatusActionLoading(false);
    }
  };

  const handleOrphanTicketDeleted = () => {
    if (typeof inbox?.removeTicket === "function") {
      inbox.removeTicket(ticket.id);
    }
    setCurrentTicket({ id: null, code: null });
    history.push("/tickets");
  };

  const handleAcceptOrphanTicket = async () => {
    if (!ticket?.id) return;
    setStatusActionLoading(true);
    try {
      await completeAcceptTicket(ticket);
    } catch (err) {
      toastError(err);
    } finally {
      setStatusActionLoading(false);
    }
  };

  const renderTicketInfo = () => {
    if (!ticket?.id) {
      return null;
    }
    return (
      <TicketInfo
        contact={contact}
        ticket={ticket}
        onClick={handleDrawerOpen}
        onLabelsChange={(labels) => {
          setContact((prev) => ({ ...prev, labels }));
          setTicket((prev) => ({
            ...prev,
            contact: prev.contact
              ? { ...prev.contact, labels }
              : prev.contact,
          }));
        }}
      />
    );
  };

  const renderMessagesList = () => (
    <MessagesList
      ticket={ticket}
      ticketId={ticket.id}
      isGroup={ticket.isGroup}
      onPartialEnrichWarning={() => setPartialEnrichWarning(true)}
      onLoadError={() => setPartialEnrichWarning(true)}
    />
  );

  const orphanPendingWithDelete =
    isOrphanView &&
    String(ticket?.status || "").toLowerCase() === "pending" &&
    mayDelete;

  const renderStateBanner = (openDelete) => (
    <TicketStateBanner
      viewState={viewState}
      ticket={ticket}
      loading={statusActionLoading}
      partialEnrichWarning={partialEnrichWarning}
      onReassign={() => setReassignModalOpen(true)}
      onFinalize={handleFinalizeTicket}
      onAccept={handleAcceptOrphanTicket}
      onReopen={handleReopenOrphanTicket}
      onDelete={openDelete}
    />
  );

  const renderComposer = () => {
    if (isOrphanView) {
      return <TicketOrphanComposer />;
    }
    return (
      <div className={classes.messageInputFooter}>
        <MessageInput
          ticketId={ticket.id}
          ticketStatus={ticket.status}
          contact={contact}
          ticket={ticket}
          chatInputControllerRef={chatInputControllerRef}
          transferModalOpen={transferTicketModalOpen}
          quickRepliesOpen={quickRepliesOpen}
        />
      </div>
    );
  };

  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        elevation={0}
        className={clsx(classes.ticketPanel, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
        data-ticket-chat-panel
      >
        <TicketHeader loading={loading} compact={isOrphanView}>
          {renderTicketInfo()}
          {!isOrphanView ? (
            <TicketActionButtons
              ticket={ticket}
              contact={contact}
              onContactUpdated={(next) => setContact(next)}
              onOpenQuickReplies={() => setQuickRepliesOpen(true)}
              onOpenTransfer={() => setTransferTicketModalOpen(true)}
              onCrmDealSaved={() => setCrmPanelRefreshKey((n) => n + 1)}
            />
          ) : null}
        </TicketHeader>
        {orphanPendingWithDelete ? (
          <TicketActionModals
            ticket={ticket}
            deleteTitle={i18n.t("ticket.delete.confirmTitle")}
            deleteMessage={i18n.t("ticket.delete.confirmMessage")}
            onDeleted={handleOrphanTicketDeleted}
          >
            {({ openDelete }) => renderStateBanner(openDelete)}
          </TicketActionModals>
        ) : (
          renderStateBanner()
        )}
        {ticket?.id && (
          <ErrorBoundary>
            <div className={classes.chatBody} data-ticket-message-list>
              <div className={classes.tagsBar}>
                <TagsContainer ticket={ticket} />
              </div>
              <ReplyMessageProvider>
                <div className={classes.chatBodyMain}>
                  {renderMessagesList()}
                  {renderComposer()}
                </div>
              </ReplyMessageProvider>
            </div>
          </ErrorBoundary>
        )}
      </Paper>
      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        loading={loading}
        ticket={ticket}
        crmPanelRefreshKey={crmPanelRefreshKey}
        onCrmPanelDataChanged={() => setCrmPanelRefreshKey((n) => n + 1)}
      />
      <ReassignOrphanWhatsappModal
        open={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        ticketId={ticket.id}
        onSuccess={(updated) => setTicket(updated)}
      />
      <QuickMessageChatModal
        open={quickRepliesOpen}
        onClose={() => setQuickRepliesOpen(false)}
        chatInputControllerRef={chatInputControllerRef}
        contact={contact}
        ticket={ticket}
      />
      <TransferTicketModalCustom
        modalOpen={transferTicketModalOpen}
        onClose={() => setTransferTicketModalOpen(false)}
        ticketid={ticket.id}
      />
    </div>
  );
};

export default Ticket;
