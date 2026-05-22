import React from "react";
import { Button, makeStyles } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import { i18n } from "../../translate/i18n";
import { TICKET_VIEW_STATE } from "../../utils/getTicketViewState";
import ButtonWithSpinner from "../ButtonWithSpinner";

const useStyles = makeStyles((theme) => ({
  root: {
    borderRadius: 0,
    flexShrink: 0,
    alignItems: "flex-start",
    "& .MuiAlert-message": {
      flex: 1,
      minWidth: 0,
    },
    "& .MuiAlert-action": {
      alignItems: "flex-start",
      paddingTop: theme.spacing(0.25),
      marginRight: 0,
    },
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    justifyContent: "flex-end",
  },
  actionBtn: {
    textTransform: "none",
    whiteSpace: "nowrap",
  },
}));

const TicketStateBanner = ({
  viewState,
  ticket,
  loading = false,
  partialEnrichWarning = false,
  onReassign,
  onFinalize,
  onAccept,
  onReopen,
  onDelete,
}) => {
  const classes = useStyles();

  if (viewState === TICKET_VIEW_STATE.ORPHAN) {
    const isClosed = String(ticket?.status || "").toLowerCase() === "closed";
    const isPending = String(ticket?.status || "").toLowerCase() === "pending";

    return (
      <Alert
        severity="warning"
        data-ticket-orphan-banner
        className={classes.root}
        action={
          <div className={classes.actions}>
            {isPending && onAccept ? (
              <ButtonWithSpinner
                loading={loading}
                size="small"
                variant="contained"
                color="primary"
                className={classes.actionBtn}
                onClick={onAccept}
              >
                {loading
                  ? i18n.t("ticketsList.buttons.accepting")
                  : i18n.t("messagesList.header.buttons.accept")}
              </ButtonWithSpinner>
            ) : null}
            {isClosed && onReopen ? (
              <ButtonWithSpinner
                loading={loading}
                size="small"
                variant="contained"
                color="primary"
                className={classes.actionBtn}
                onClick={onReopen}
              >
                {i18n.t("messagesList.header.buttons.reopen")}
              </ButtonWithSpinner>
            ) : null}
            {!isClosed && onFinalize ? (
              <ButtonWithSpinner
                loading={loading}
                size="small"
                variant="outlined"
                className={classes.actionBtn}
                onClick={onFinalize}
              >
                {i18n.t("messagesList.header.buttons.resolve")}
              </ButtonWithSpinner>
            ) : null}
            {isPending && onDelete ? (
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                disabled={loading}
                className={classes.actionBtn}
                onClick={onDelete}
              >
                {i18n.t("ticketOptionsMenu.buttons.delete")}
              </Button>
            ) : null}
            {onReassign ? (
              <Button
                size="small"
                color="inherit"
                variant="outlined"
                className={classes.actionBtn}
                onClick={onReassign}
              >
                {i18n.t("ticketsList.orphanReassign.button")}
              </Button>
            ) : null}
          </div>
        }
      >
        {i18n.t("ticket.orphan.banner")}
      </Alert>
    );
  }

  if (viewState === TICKET_VIEW_STATE.PENDING) {
    return (
      <Alert
        severity="info"
        data-ticket-pending-banner
        className={classes.root}
      >
        {i18n.t("ticket.pendingPreview.banner")}
      </Alert>
    );
  }

  if (viewState === TICKET_VIEW_STATE.ACTIVE && partialEnrichWarning) {
    return (
      <Alert severity="warning" className={classes.root}>
        {i18n.t("ticket.partialEnrichWarning")}
      </Alert>
    );
  }

  return null;
};

export default TicketStateBanner;
