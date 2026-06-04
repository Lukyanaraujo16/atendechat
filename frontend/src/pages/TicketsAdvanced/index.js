import React from "react";
import { useParams } from "react-router-dom";
import Box from "@material-ui/core/Box";
import { makeStyles } from "@material-ui/core/styles";

import TicketsManagerTabs from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";

const useStyles = makeStyles((theme) => ({
  inboxRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  conversationRoot: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    height: "100%",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    backgroundColor: theme.palette.background.default,
  },
}));

/**
 * Mobile (< md): lista e conversa em rotas separadas — estilo app/PWA.
 * /tickets → só inbox; /tickets/:uuid → conversa fullscreen com voltar.
 */
const TicketAdvanced = () => {
  const classes = useStyles();
  const { ticketId } = useParams();

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
