import React from "react";
import { useParams } from "react-router-dom";
import Box from "@material-ui/core/Box";
import { makeStyles } from "@material-ui/core/styles";

import TicketsManagerTabs from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import useMobileVisualViewport from "../../hooks/useMobileVisualViewport";

const useStyles = makeStyles((theme) => ({
  inboxRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  conversationRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    overflowX: "hidden",
    boxSizing: "border-box",
    backgroundColor: theme.palette.background.default,
  },
}));

/**
 * Mobile (< md): lista e conversa em rotas separadas — estilo app/PWA.
 * /tickets → só inbox; /tickets/:uuid → conversa fullscreen com voltar.
 * visualViewport: altura útil acima do teclado (sem faixa branca).
 */
const TicketAdvanced = () => {
  const classes = useStyles();
  const { ticketId } = useParams();
  const conversationOpen = Boolean(ticketId);

  const vv = useMobileVisualViewport({ enabled: conversationOpen });

  React.useEffect(() => {
    if (!conversationOpen || !vv.keyboardLikelyOpen) return;
    const list = document.getElementById("messagesList");
    if (!list) return;
    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    if (distanceFromBottom < 140) {
      list.scrollTop = list.scrollHeight;
    }
  }, [conversationOpen, vv.keyboardLikelyOpen, vv.height]);

  if (ticketId) {
    return (
      <Box className={classes.conversationRoot} data-tickets-mobile="conversation">
        <Ticket />
      </Box>
    );
  }

  return (
    <Box className={classes.inboxRoot} data-tickets-mobile="inbox">
      <TicketsManagerTabs />
    </Box>
  );
};

export default TicketAdvanced;
