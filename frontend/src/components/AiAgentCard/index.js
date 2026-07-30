import React from "react";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import {
  AppPrimaryButton,
  AppSecondaryButton,
  MobileEntityCard,
} from "../../ui";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  metaLine: {
    color: theme.palette.text.secondary,
    wordBreak: "break-word",
  },
  attention: {
    color: theme.palette.error.main,
    fontWeight: 500,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
}));

function statusTone(status) {
  if (status === "active" || status === "ready_to_activate") return "primary";
  if (status === "attention_required" || status === "setup_incomplete") {
    return "default";
  }
  return "default";
}

/**
 * Card comercial de um agente no Hub multiagente (Fase 2.9B).
 * agentRef não é exibido ao usuário.
 */
export default function AiAgentCard({
  agent,
  onManage,
  onReview,
  canManage = true,
}) {
  const classes = useStyles();
  const name =
    String(agent?.name || "").trim() ||
    i18n.t("aiAgentProduct.meta.unnamed");
  const status = String(agent?.status || "setup_incomplete");
  const mode = String(agent?.operationMode || "off");
  const connectionCount = Number(agent?.connectionCount) || 0;
  const needsAttention =
    status === "attention_required" || status === "setup_incomplete";
  const providerModel = [agent?.provider, agent?.model]
    .filter(Boolean)
    .join(" · ");

  const badges = (
    <>
      <Chip
        size="small"
        color={statusTone(status)}
        label={i18n.t(`aiAgentProduct.status.${status}`, {
          defaultValue: status,
        })}
      />
      <Chip
        size="small"
        variant="outlined"
        label={i18n.t(`aiAgentProduct.mode.${mode}`, { defaultValue: mode })}
      />
      <Chip
        size="small"
        variant="outlined"
        label={
          agent?.enabled
            ? i18n.t("aiAgentProduct.hub.agentEnabled")
            : i18n.t("aiAgentProduct.hub.agentDisabled")
        }
      />
    </>
  );

  return (
    <MobileEntityCard
      title={name}
      subtitle={
        providerModel || i18n.t("aiAgentProduct.hub.providerUnset")
      }
      badges={badges}
      footer={
        <Box className={classes.actions}>
          {canManage ? (
            <AppPrimaryButton
              onClick={() => onManage?.(agent)}
              data-testid={`ai-agent-card-manage-${agent.agentRef}`}
              aria-label={i18n.t("aiAgentProduct.hub.manageAgentAria", {
                name,
              })}
            >
              {i18n.t("aiAgentProduct.hub.manageAgent")}
            </AppPrimaryButton>
          ) : null}
          {needsAttention && canManage ? (
            <AppSecondaryButton
              onClick={() => onReview?.(agent)}
              data-testid={`ai-agent-card-review-${agent.agentRef}`}
            >
              {i18n.t("aiAgentProduct.hub.reviewConfig")}
            </AppSecondaryButton>
          ) : null}
        </Box>
      }
    >
      <Box data-testid={`ai-agent-card-${agent.agentRef}`}>
        <Typography variant="body2" className={classes.metaLine}>
          {i18n.t("aiAgentProduct.hub.connectionCount", {
            count: connectionCount,
          })}
        </Typography>
        {needsAttention ? (
          <Typography
            variant="body2"
            className={classes.attention}
            role="status"
          >
            {i18n.t("aiAgentProduct.hub.needsAttention")}
          </Typography>
        ) : null}
        {agent?.ready === true ? (
          <Typography variant="body2" className={classes.metaLine}>
            {i18n.t("aiAgentProduct.meta.readyTrue")}
          </Typography>
        ) : null}
      </Box>
    </MobileEntityCard>
  );
}
