import React from "react";
import { Paper, Typography, makeStyles } from "@material-ui/core";

import { i18n } from "../../translate/i18n";
import {
  PANEL_RADIUS,
  getSubtleBorder,
  getComposerSurface,
  getComposerTopDivider,
} from "../../theme/ticketPanelStyles";

const useStyles = makeStyles((theme) => ({
  root: {
    flexShrink: 0,
    width: "100%",
    borderTop: "none",
    boxShadow: getComposerTopDivider(theme),
    borderBottomRightRadius: PANEL_RADIUS,
    backgroundColor: getComposerSurface(theme),
    padding: theme.spacing(1.5, 2),
    textAlign: "center",
  },
  text: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.45,
  },
}));

/** Rodapé estático para ticket órfão — substitui o composer ativo. */
const TicketOrphanComposer = () => {
  const classes = useStyles();

  return (
    <Paper
      square
      elevation={0}
      className={classes.root}
      data-ticket-orphan-composer
    >
      <Typography className={classes.text} component="p">
        {i18n.t("ticket.orphan.inputHint")}
      </Typography>
    </Paper>
  );
};

export default TicketOrphanComposer;
