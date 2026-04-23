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
import TicketActionButtons from "../TicketActionButtonsCustom";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TagsContainer } from "../TagsContainer";
import { SocketContext } from "../../context/Socket/SocketContext";
import { i18n } from "../../translate/i18n";

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

  mainWrapper: {
    flex: 1,
    minHeight: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
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
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});

  const socketManager = useContext(SocketContext);
  const ticketRef = useRef(ticket);
  ticketRef.current = ticket;

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          const { data } = await api.get("/tickets/u/" + ticketId);
          const { queueId } = data;
          const u = userRef.current;
          const queues = u?.queues || [];
          const { profile } = u || {};

          const queueAllowed = queues.find((q) => q.id === queueId);
          if (queueAllowed === undefined && profile !== "admin") {
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
            return { ...prevState, ...data.contact };
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
      socket.disconnect();
    };
  }, [ticketId, history, socketManager, ticket?.id]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const renderTicketInfo = () => {
    if (ticket.user !== undefined) {
      return (
        <TicketInfo
          contact={contact}
          ticket={ticket}
          onClick={handleDrawerOpen}
        />
      );
    }
  };

  const renderMessagesList = () => {
    return (
      <>
        <MessagesList
          ticket={ticket}
          ticketId={ticket.id}
          isGroup={ticket.isGroup}
        />
        <div className={classes.messageInputFooter}>
          <MessageInput ticketId={ticket.id} ticketStatus={ticket.status} />
        </div>
      </>
    );
  };

  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
        data-ticket-chat-panel
      >
        <TicketHeader loading={loading}>
          {renderTicketInfo()}
          <TicketActionButtons ticket={ticket} />
        </TicketHeader>
        {ticket?.id && (
          <ErrorBoundary>
            <div className={classes.chatBody}>
              <Paper>
                <TagsContainer ticket={ticket} />
              </Paper>
              <ReplyMessageProvider>
                <div className={classes.chatBodyMain}>{renderMessagesList()}</div>
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
      />
    </div>
  );
};

export default Ticket;
