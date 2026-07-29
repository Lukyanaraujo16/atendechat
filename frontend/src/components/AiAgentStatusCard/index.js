import React from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import { makeStyles } from "@material-ui/core/styles";
import { AppSectionCard } from "../../ui";
import AiAgentModeBadge from "../AiAgentModeBadge";
import AiAgentPrimaryAction from "../AiAgentPrimaryAction";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  card: {
    padding: theme.spacing(2),
    overflow: "hidden",
  },
  headerRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  title: {
    fontWeight: 700,
    wordBreak: "break-word",
  },
  description: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
    maxWidth: 720,
  },
  meta: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.75),
    marginBottom: theme.spacing(2),
  },
  metaLine: {
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
  toneInfo: {
    borderLeft: `4px solid ${theme.palette.info?.main || theme.palette.primary.main}`,
  },
  toneWarning: {
    borderLeft: `4px solid ${theme.palette.warning?.main || theme.palette.secondary.main}`,
  },
  toneSuccess: {
    borderLeft: `4px solid ${theme.palette.success?.main || theme.palette.primary.main}`,
  },
  toneDanger: {
    borderLeft: `4px solid ${theme.palette.error.main}`,
  },
  toneNeutral: {
    borderLeft: `4px solid ${theme.palette.divider}`,
  },
}));

const TONE_CLASS = {
  info: "toneInfo",
  warning: "toneWarning",
  success: "toneSuccess",
  danger: "toneDanger",
  neutral: "toneNeutral",
};

export default function AiAgentStatusCard({ summary, onRefresh }) {
  const classes = useStyles();
  if (!summary) return null;

  const tone = summary.statusMeta?.tone || "neutral";
  const toneClass = classes[TONE_CLASS[tone] || "toneNeutral"];
  const showAgent =
    summary.agent?.exists &&
    summary.status !== "unavailable" &&
    summary.status !== "not_created";
  const showConnection =
    summary.connection?.linked &&
    summary.status !== "unavailable" &&
    summary.status !== "not_created";
  const showChecklistStatuses = ![
    "unavailable",
  ].includes(summary.status);

  return (
    <AppSectionCard
      className={`${classes.card} ${toneClass}`}
      data-testid="ai-agent-status-card"
      aria-labelledby="ai-agent-status-title"
    >
      <Box className={classes.headerRow}>
        <Typography id="ai-agent-status-title" variant="h6" className={classes.title}>
          {i18n.t(summary.statusMeta.labelKey)}
        </Typography>
        <Chip
          size="small"
          label={i18n.t(summary.statusMeta.labelKey)}
          aria-label={i18n.t("aiAgentProduct.status.aria", {
            status: i18n.t(summary.statusMeta.labelKey),
          })}
        />
        <AiAgentModeBadge modeMeta={summary.modeMeta} />
      </Box>

      <Typography variant="body2" className={classes.description}>
        {i18n.t(summary.statusMeta.descriptionKey)}
      </Typography>

      {showAgent || showConnection ? (
        <Box className={classes.meta}>
          {showAgent ? (
            <Typography variant="body2" className={classes.metaLine}>
              {i18n.t("aiAgentProduct.meta.agent", {
                name: summary.agent.name || i18n.t("aiAgentProduct.meta.unnamed"),
              })}
            </Typography>
          ) : null}
          {showConnection ? (
            <Typography variant="body2" className={classes.metaLine}>
              {i18n.t("aiAgentProduct.meta.connection", {
                name:
                  summary.connection.name ||
                  i18n.t("aiAgentProduct.meta.unnamedConnection"),
                state: summary.connection.connected
                  ? i18n.t("aiAgentProduct.meta.connected")
                  : i18n.t("aiAgentProduct.meta.disconnected"),
              })}
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {showChecklistStatuses && summary.ready != null ? (
        <Typography variant="body2" className={classes.metaLine} style={{ marginBottom: 16 }}>
          {summary.ready
            ? i18n.t("aiAgentProduct.meta.readyTrue")
            : i18n.t("aiAgentProduct.meta.readyFalse")}
        </Typography>
      ) : null}

      <Box className={classes.actions}>
        <AiAgentPrimaryAction nextAction={summary.nextAction} onRefresh={onRefresh} />
      </Box>
    </AppSectionCard>
  );
}
