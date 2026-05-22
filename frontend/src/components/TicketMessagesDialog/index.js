import React, { useContext, useEffect, useState } from "react";

import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { canAccessTicket } from "../../utils/canAccessTicket";
import { i18n } from "../../translate/i18n";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  makeStyles,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { useHistory } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import MessagesList from "../MessagesList";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import ReassignOrphanWhatsappModal from "../ReassignOrphanWhatsappModal";
import { SocketContext } from "../../context/Socket/SocketContext";
import { isOrphanTicket } from "../../utils/isOrphanTicket";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  mainWrapper: {
    flex: 1,
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
  orphanBanner: {
    borderRadius: 0,
    flexShrink: 0,
  },
}));

export default function TicketMessagesDialog({ open, handleClose, ticketId }) {
  const history = useHistory();
  const classes = useStyles();

  const { user } = useContext(AuthContext);

  const [, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [reassignModalOpen, setReassignModalOpen] = useState(false);

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    let delayDebounceFn = null;
    if (open) {
      setLoading(true);
      delayDebounceFn = setTimeout(() => {
        const fetchTicket = async () => {
          try {
            const { data } = await api.get("/tickets/" + ticketId);

            if (!canAccessTicket(user, data)) {
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
    }
    return () => {
      if (delayDebounceFn !== null) {
        clearTimeout(delayDebounceFn);
      }
    };
  }, [ticketId, user, history, open]);

  useEffect(() => {
    if (!open || !ticket?.id) {
      return undefined;
    }

    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);
    const ticketNumericId = ticket.id;

    const joinRoom = () => {
      socket.emit("joinChatBox", `${ticketNumericId}`);
    };

    const handleTicketEvent = (data) => {
      if (data.action === "update" && data.ticket?.id === ticketNumericId) {
        setTicket(data.ticket);
      }
      if (data.action === "delete" && data.ticketId === ticketNumericId) {
        history.push("/tickets");
      }
    };

    const handleContactEvent = (data) => {
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
    socket.on(`company-${companyId}-ticket`, handleTicketEvent);
    socket.on(`company-${companyId}-contact`, handleContactEvent);
    joinRoom();

    return () => {
      socket.off("ready", joinRoom);
      socket.off(`company-${companyId}-ticket`, handleTicketEvent);
      socket.off(`company-${companyId}-contact`, handleContactEvent);
    };
  }, [ticketId, ticket?.id, history, open, socketManager]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const orphanTicket = isOrphanTicket(ticket);

  const renderTicketInfo = () => {
    if (!ticket?.id) {
      return null;
    }
    return (
      <TicketInfo
        contact={contact}
        ticket={ticket}
        onClick={handleDrawerOpen}
      />
    );
  };

  const renderMessagesList = () => {
    return (
      <Box className={classes.root}>
        <MessagesList
          ticket={ticket}
          ticketId={ticket.id}
          isGroup={ticket.isGroup}
        ></MessagesList>
      </Box>
    );
  };

  return (
    <Dialog maxWidth="md" onClose={handleClose} open={open}>
      <TicketHeader loading={loading}>{renderTicketInfo()}</TicketHeader>
      {orphanTicket && (
        <Alert
          severity="warning"
          className={classes.orphanBanner}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => setReassignModalOpen(true)}
            >
              {i18n.t("ticketsList.orphanReassign.button")}
            </Button>
          }
        >
          {i18n.t("ticket.orphan.banner")}
        </Alert>
      )}
      <ReplyMessageProvider>{renderMessagesList()}</ReplyMessageProvider>
      <ReassignOrphanWhatsappModal
        open={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        ticketId={ticket.id}
        onSuccess={(updated) => setTicket(updated)}
      />
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
