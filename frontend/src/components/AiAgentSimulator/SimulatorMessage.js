import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import FileCopyOutlinedIcon from "@material-ui/icons/FileCopyOutlined";
import RateReviewOutlinedIcon from "@material-ui/icons/RateReviewOutlined";
import ReplayIcon from "@material-ui/icons/Replay";
import { i18n } from "../../translate/i18n";
import SimulatorKnowledgePanel, {
  extractMessageKnowledge,
} from "./SimulatorKnowledgePanel";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  return {
    row: {
      display: "flex",
      marginBottom: theme.spacing(1.5),
      justifyContent: (props) => (props.isUser ? "flex-end" : "flex-start"),
    },
    bubble: {
      maxWidth: "82%",
      padding: theme.spacing(1.25, 1.5),
      borderRadius: 16,
      backgroundColor: (props) =>
        props.isUser
          ? isDark
            ? "rgba(76, 175, 80, 0.22)"
            : "rgba(76, 175, 80, 0.16)"
          : isDark
            ? "rgba(255, 255, 255, 0.08)"
            : theme.palette.background.paper,
      border: (props) =>
        props.isUser ? "none" : `1px solid ${theme.palette.divider}`,
    },
    meta: {
      marginTop: theme.spacing(0.75),
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing(0.5),
      alignItems: "center",
    },
    actions: {
      marginTop: theme.spacing(0.5),
      display: "flex",
      gap: theme.spacing(0.25),
    },
    error: {
      color: theme.palette.error.main,
      fontSize: "0.8rem",
    },
  };
});

export default function SimulatorMessage({
  message,
  onCopy,
  onReview,
  onRepeat,
}) {
  const isUser = message.role === "user";
  const classes = useStyles({ isUser });
  const knowledge = !isUser ? extractMessageKnowledge(message) : null;

  return (
    <div className={classes.row}>
      <Paper className={classes.bubble} elevation={0}>
        <Typography variant="body2" style={{ whiteSpace: "pre-wrap" }}>
          {message.content || (message.errorCode ? "" : "…")}
        </Typography>
        {message.errorCode ? (
          <Typography className={classes.error}>
            {i18n.t("aiAgent.simulator.errors.provider", {
              code: message.errorCode,
            })}
          </Typography>
        ) : null}
        <div className={classes.meta}>
          {message.handoffSuggested ? (
            <Chip
              size="small"
              color="secondary"
              label={i18n.t("aiAgent.simulator.handoffBadge")}
            />
          ) : null}
          {message.latencyMs ? (
            <Typography variant="caption" color="textSecondary">
              {message.latencyMs}ms
            </Typography>
          ) : null}
        </div>
        {!isUser && message.content ? (
          <div className={classes.actions}>
            <Tooltip title={i18n.t("aiAgent.simulator.buttons.copy")}>
              <IconButton size="small" onClick={() => onCopy(message.content)}>
                <FileCopyOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={i18n.t("aiAgent.simulator.buttons.review")}>
              <IconButton size="small" onClick={() => onReview(message)}>
                <RateReviewOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={i18n.t("aiAgent.simulator.buttons.repeatQuestion")}>
              <IconButton size="small" onClick={() => onRepeat(message)}>
                <ReplayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ) : null}
        {knowledge ? <SimulatorKnowledgePanel knowledge={knowledge} /> : null}
      </Paper>
    </div>
  );
}
