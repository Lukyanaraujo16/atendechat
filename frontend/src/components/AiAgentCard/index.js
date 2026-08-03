import React from "react";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import Switch from "@material-ui/core/Switch";
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
  toggleWrap: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    minHeight: 44,
    marginLeft: theme.spacing(0.5),
  },
  toggleStatus: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
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
 * Card comercial de um agente no Hub multiagente (Fase 2.9B / 2.19).
 * agentRef não é exibido ao usuário.
 * Toggle controla enabled/disabled; não seleciona modo operacional.
 */
export default function AiAgentCard({
  agent,
  onManage,
  onReview,
  canManage = true,
  canMutate = false,
  busy = false,
  onToggleRequest,
}) {
  const classes = useStyles();
  const name =
    String(agent?.name || "").trim() ||
    i18n.t("aiAgentProduct.meta.unnamed");
  const status = String(agent?.status || "setup_incomplete");
  const mode = String(agent?.operationMode || "off");
  const connectionCount = Number(agent?.connectionCount) || 0;
  const enabled = agent?.enabled === true;
  const agentRef = String(agent?.agentRef || "").trim();
  const needsAttention =
    status === "attention_required" || status === "setup_incomplete";
  const providerModel = [agent?.provider, agent?.model]
    .filter(Boolean)
    .join(" · ");

  const toggleDisabled = !canMutate || busy || !agentRef;
  const toggleAria = enabled
    ? i18n.t("aiAgentProduct.hub.quickToggle.deactivateAria", { name })
    : i18n.t("aiAgentProduct.hub.quickToggle.activateAria", { name });

  const handleToggle = (event, checked) => {
    event.stopPropagation();
    if (toggleDisabled || typeof onToggleRequest !== "function") return;
    const next =
      typeof checked === "boolean" ? checked === true : event.target.checked === true;
    if (next === enabled) return;
    onToggleRequest(agent, next);
  };

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
          enabled
            ? i18n.t("aiAgentProduct.hub.agentEnabled")
            : i18n.t("aiAgentProduct.hub.agentDisabled")
        }
      />
    </>
  );

  const handleToggleKeyDown = (event) => {
    if (toggleDisabled || typeof onToggleRequest !== "function") return;
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    onToggleRequest(agent, !enabled);
  };

  const trailing =
    typeof onToggleRequest === "function" ? (
      <Box
        className={classes.toggleWrap}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleToggleKeyDown}
        tabIndex={toggleDisabled ? -1 : 0}
        role="group"
        aria-label={toggleAria}
        data-testid={`ai-agent-card-toggle-wrap-${agentRef}`}
      >
        {busy ? (
          <CircularProgress
            size={18}
            thickness={5}
            aria-label={i18n.t("aiAgentProduct.hub.quickToggle.loadingAria", {
              name,
            })}
            data-testid={`ai-agent-card-toggle-loading-${agentRef}`}
          />
        ) : null}
        <Typography
          component="span"
          className={classes.toggleStatus}
          aria-hidden="true"
        >
          {enabled
            ? i18n.t("aiAgentProduct.hub.quickToggle.activeLabel")
            : i18n.t("aiAgentProduct.hub.quickToggle.inactiveLabel")}
        </Typography>
        <Switch
          color="primary"
          checked={enabled}
          onChange={handleToggle}
          disabled={toggleDisabled}
          inputProps={{
            "aria-label": toggleAria,
            "aria-checked": enabled,
            "aria-busy": busy ? "true" : "false",
            "data-testid": `ai-agent-card-toggle-${agentRef}`,
          }}
        />
      </Box>
    ) : null;

  return (
    <MobileEntityCard
      title={name}
      subtitle={
        providerModel || i18n.t("aiAgentProduct.hub.providerUnset")
      }
      badges={badges}
      trailing={trailing}
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
