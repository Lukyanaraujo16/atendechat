import React, { useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import { makeStyles } from "@material-ui/core/styles";
import { AppSectionCard, AppSecondaryButton, AppNeutralButton } from "../../ui";
import AiAgentModeBadge from "../AiAgentModeBadge";
import AiAgentPrimaryAction from "../AiAgentPrimaryAction";
import ConfirmationModal from "../ConfirmationModal";
import { getAiAgentCommandConfirmKeys, getAiAgentCommandConfirmParams } from "../../utils/aiAgentProductMapper";
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

function CommercialCommandButton({
  action,
  commandBusy,
  onCommand,
  connectionScope,
}) {
  const [open, setOpen] = useState(false);
  const keys = getAiAgentCommandConfirmKeys(action.command);
  const params = getAiAgentCommandConfirmParams(connectionScope);
  const ButtonComp = action.destructive ? AppNeutralButton : AppSecondaryButton;
  const anyBusy = Boolean(commandBusy);
  const thisBusy = commandBusy === true || commandBusy === action.command;

  return (
    <>
      <ButtonComp
        onClick={() => setOpen(true)}
        disabled={anyBusy}
        data-testid={`ai-agent-command-${action.command}`}
      >
        {i18n.t(action.labelKey)}
      </ButtonComp>
      <ConfirmationModal
        title={i18n.t(keys.titleKey)}
        open={open}
        onClose={() => !thisBusy && setOpen(false)}
        onConfirm={async () => {
          try {
            await onCommand(action.command);
            setOpen(false);
          } catch (_err) {
            // erro no pai
          }
        }}
        confirmText={i18n.t(keys.confirmKey)}
        destructive={keys.destructive}
        loading={thisBusy}
        asyncConfirm
      >
        {i18n.t(keys.bodyKey, params)}
      </ConfirmationModal>
    </>
  );
}

export default function AiAgentStatusCard({
  summary,
  onRefresh,
  onCommand,
  onManageConnections,
  commandBusy = false,
}) {
  const classes = useStyles();
  if (!summary) return null;

  const tone = summary.statusMeta?.tone || "neutral";
  const toneClass = classes[TONE_CLASS[tone] || "toneNeutral"];
  const showAgent =
    summary.agent?.exists &&
    summary.agentScope?.type === "single" &&
    summary.status !== "unavailable" &&
    summary.status !== "not_created";
  const showConnection =
    summary.connection?.linked &&
    summary.agentScope?.type === "single" &&
    summary.status !== "unavailable" &&
    summary.status !== "not_created";
  const showChecklistStatuses = !["unavailable"].includes(summary.status);
  const commercialCommands = Array.isArray(summary.commercialCommands)
    ? summary.commercialCommands
    : [];

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
          {summary.connectionScope?.count > 0 ? (
            <Typography
              variant="body2"
              className={classes.metaLine}
              data-testid="ai-agent-connection-scope"
            >
              {i18n.t("aiAgentProduct.meta.connectionScope", {
                count: summary.connectionScope.count,
                connected: summary.connectionScope.connectedCount,
                disconnected: summary.connectionScope.disconnectedCount,
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
        <AiAgentPrimaryAction
          nextAction={summary.nextAction}
          onRefresh={onRefresh}
          onCommand={onCommand}
          onManageConnections={onManageConnections}
          commandBusy={commandBusy}
          connectionScope={summary.connectionScope}
        />
        {commercialCommands.map((action) =>
          action.enabled && action.command && typeof onCommand === "function" ? (
            <CommercialCommandButton
              key={action.id || action.command}
              action={action}
              commandBusy={commandBusy}
              onCommand={onCommand}
              connectionScope={summary.connectionScope}
            />
          ) : null
        )}
      </Box>
    </AppSectionCard>
  );
}
