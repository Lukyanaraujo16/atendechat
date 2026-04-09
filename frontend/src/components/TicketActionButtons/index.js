import React, { useContext, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { Replay } from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketActionModals from "../TicketActionModals";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import TicketConversationActionBar from "../TicketConversationActionBar";

const useStyles = makeStyles((theme) => ({
  actionButtons: {
    flex: "none",
    alignSelf: "center",
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  },
  legacyCluster: {
    marginRight: theme.spacing(0.5),
    "& > *": {
      margin: theme.spacing(0.5),
    },
  },
}));

const TicketActionButtons = ({ ticket }) => {
  const classes = useStyles();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const { user } = useContext(AuthContext);

  const handleUpdateTicketStatus = async (e, status, userId) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${ticket.id}`, {
        status: status,
        userId: userId || null,
      });

      setLoading(false);
      if (status === "open") {
        history.push(`/tickets/${ticket.id}`);
      } else {
        history.push("/tickets");
      }
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  return (
    <div className={classes.actionButtons}>
      {ticket.status === "closed" && (
        <div className={classes.legacyCluster}>
          <ButtonWithSpinner
            loading={loading}
            startIcon={<Replay />}
            size="small"
            onClick={(e) => handleUpdateTicketStatus(e, "open", user?.id)}
          >
            {i18n.t("messagesList.header.buttons.reopen")}
          </ButtonWithSpinner>
        </div>
      )}
      {ticket.status === "open" && (
        <TicketActionModals ticket={ticket}>
          {({ openSchedule, openTransfer, openDelete }) => (
            <TicketConversationActionBar
              loading={loading}
              userProfile={user?.profile}
              ticketId={ticket.id}
              onResolve={(e) =>
                handleUpdateTicketStatus(e, "closed", user?.id)
              }
              onReturn={(e) => handleUpdateTicketStatus(e, "pending", null)}
              onScheduleClick={openSchedule}
              onTransferClick={openTransfer}
              onDeleteClick={openDelete}
            />
          )}
        </TicketActionModals>
      )}
      {ticket.status === "pending" && (
        <div className={classes.legacyCluster}>
          <ButtonWithSpinner
            loading={loading}
            size="small"
            variant="contained"
            color="primary"
            onClick={(e) => handleUpdateTicketStatus(e, "open", user?.id)}
          >
            {i18n.t("messagesList.header.buttons.accept")}
          </ButtonWithSpinner>
        </div>
      )}
    </div>
  );
};

export default TicketActionButtons;
