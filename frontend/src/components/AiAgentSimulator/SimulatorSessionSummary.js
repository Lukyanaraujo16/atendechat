import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  },
}));

export default function SimulatorSessionSummary({ session, maxMessages = 30 }) {
  const classes = useStyles();
  if (!session) return null;

  return (
    <Paper className={classes.root} variant="outlined">
      <Typography variant="caption" color="textSecondary">
        {i18n.t("aiAgent.simulator.summary.title")}
      </Typography>
      <div className={classes.row}>
        <Typography variant="body2">
          {i18n.t("aiAgent.simulator.summary.messages", {
            count: session.messageCount || 0,
            max: maxMessages,
          })}
        </Typography>
        <Typography variant="body2">
          {i18n.t("aiAgent.simulator.summary.tokens", {
            count: session.totalTokens || 0,
          })}
        </Typography>
      </div>
      {session.averageLatencyMs ? (
        <Typography variant="body2" color="textSecondary">
          {i18n.t("aiAgent.simulator.summary.latency", {
            ms: session.averageLatencyMs,
          })}
        </Typography>
      ) : null}
    </Paper>
  );
}
