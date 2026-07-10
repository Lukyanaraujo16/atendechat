import React, { useState } from "react";
import { Chip, IconButton, Tooltip, makeStyles } from "@material-ui/core";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import useFeature from "../../hooks/useFeature";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    marginLeft: theme.spacing(1),
    flexShrink: 0,
  },
  chip: {
    height: 22,
    fontSize: "0.7rem",
  },
}));

const TicketAiAgentControls = ({ ticket, onTicketUpdate }) => {
  const classes = useStyles();
  const aiAgentFeatureEnabled = useFeature("automation.ai_agent");
  const [loading, setLoading] = useState(false);

  const whatsappMode =
    ticket?.aiAgentMode ||
    ticket?.whatsapp?.aiAgentMode ||
    (ticket?.whatsapp?.aiAgentEnabled ? "dry_run" : "disabled");

  const showControls =
    aiAgentFeatureEnabled &&
    ticket?.id &&
    (whatsappMode === "live" ||
      ticket?.automationType === "ai_agent" ||
      ticket?.aiAgentPaused === true);

  if (!showControls) {
    return null;
  }

  const paused = ticket.aiAgentPaused === true;
  const humanAssigned = ticket.userId != null;

  const handlePause = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/tickets/${ticket.id}/ai-agent/pause`);
      if (onTicketUpdate) {
        onTicketUpdate({ ...ticket, ...data });
      }
      toast.success(i18n.t("ticketAiAgent.paused"));
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/tickets/${ticket.id}/ai-agent/resume`);
      if (onTicketUpdate) {
        onTicketUpdate({ ...ticket, ...data });
      }
      toast.success(i18n.t("ticketAiAgent.resumed"));
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  let label = i18n.t("ticketAiAgent.activeAgent");
  let chipColor = "primary";
  if (humanAssigned) {
    label = i18n.t("ticketAiAgent.humanAssumed");
    chipColor = "default";
  } else if (paused) {
    label = i18n.t("ticketAiAgent.pausedInTicket");
    chipColor = "default";
  }

  return (
    <div className={classes.root}>
      <Chip
        size="small"
        label={label}
        color={chipColor}
        className={classes.chip}
      />
      {!humanAssigned && (
        <Tooltip
          title={
            paused
              ? i18n.t("ticketAiAgent.resumeAction")
              : i18n.t("ticketAiAgent.pauseAction")
          }
        >
          <span>
            <IconButton
              size="small"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                if (paused) handleResume();
                else handlePause();
              }}
            >
              {paused ? (
                <PlayCircleOutlineIcon fontSize="small" />
              ) : (
                <PauseCircleOutlineIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
      )}
    </div>
  );
};

export default TicketAiAgentControls;
