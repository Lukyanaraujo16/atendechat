import React, { useCallback } from "react";
import { useHistory } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Skeleton from "@material-ui/lab/Skeleton";
import { makeStyles } from "@material-ui/core/styles";
import {
  AppPageHeader,
  AppEmptyState,
  AppPrimaryButton,
  AppSecondaryButton,
  AppNeutralButton,
  MobileCardList,
} from "../../ui";
import Title from "../Title";
import MainHeaderButtonsWrapper from "../MainHeaderButtonsWrapper";
import AiAgentCard from "../AiAgentCard";
import AiAgentSupportBanner from "../AiAgentSupportBanner";
import ConfirmationModal from "../ConfirmationModal";
import {
  AI_AGENT_NEW_ROUTE_PATH,
  aiAgentPath,
  aiAgentWizardEditPath,
} from "../../config/aiAgentFeature";
import useAiAgentHubQuickToggle from "../../hooks/useAiAgentHubQuickToggle";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(2),
    [theme.breakpoints.up("sm")]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [theme.breakpoints.up("md")]: {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
  skeletonCard: {
    borderRadius: theme.shape.borderRadius,
  },
}));

function HubSkeleton() {
  const classes = useStyles();
  return (
    <Box
      className={classes.stack}
      role="status"
      aria-busy="true"
      aria-label={i18n.t("aiAgentProduct.loading.aria")}
      data-testid="ai-agent-hub-loading"
    >
      <Skeleton variant="rect" height={28} width="40%" className={classes.skeletonCard} />
      <Skeleton variant="rect" height={140} className={classes.skeletonCard} />
      <Skeleton variant="rect" height={140} className={classes.skeletonCard} />
    </Box>
  );
}

/**
 * Product Hub multiagente — listagem e CTA Novo agente (Fase 2.9B / 2.19).
 */
export default function AiAgentHubPage({
  loading,
  error,
  accessDenied,
  agents = [],
  onRetry,
  canCreate = true,
  canMutate = false,
  supportMode,
  companyLabel,
}) {
  const classes = useStyles();
  const history = useHistory();
  const list = Array.isArray(agents) ? agents : [];
  const mutateAllowed = canMutate === true;

  const goCreate = useCallback(() => {
    history.push(AI_AGENT_NEW_ROUTE_PATH);
  }, [history]);

  const goManage = useCallback(
    (agent) => {
      const ref = String(agent?.agentRef || "").trim();
      if (!ref) return;
      history.push(aiAgentPath(ref));
    },
    [history]
  );

  const goReview = useCallback(
    (agent) => {
      const ref = String(agent?.agentRef || "").trim();
      if (!ref) return;
      history.push(aiAgentWizardEditPath(ref));
    },
    [history]
  );

  const {
    busyAgentRef,
    deactivateTarget,
    notReadyTarget,
    handleToggleRequest,
    confirmDeactivate,
    cancelDeactivate,
    dismissNotReady,
    confirmNotReadyReview,
  } = useAiAgentHubQuickToggle({
    canMutate: mutateAllowed,
    onRetry,
    onReview: goReview,
  });

  return (
    <Box className={classes.root} data-testid="ai-agent-hub">
      <AppPageHeader
        title={<Title>{i18n.t("aiAgentProduct.hub.title")}</Title>}
        subtitle={
          <Typography variant="body2" color="textSecondary">
            {i18n.t("aiAgentProduct.hub.subtitle")}
          </Typography>
        }
        actions={
          <MainHeaderButtonsWrapper>
            <AppNeutralButton onClick={onRetry} disabled={loading}>
              {i18n.t("aiAgentProduct.actions.refresh")}
            </AppNeutralButton>
            {canCreate && !accessDenied ? (
              <AppPrimaryButton
                onClick={goCreate}
                disabled={loading}
                data-testid="ai-agent-hub-new-agent"
              >
                {list.length === 0
                  ? i18n.t("aiAgentProduct.hub.createFirst")
                  : i18n.t("aiAgentProduct.hub.newAgent")}
              </AppPrimaryButton>
            ) : null}
          </MainHeaderButtonsWrapper>
        }
      />

      {supportMode ? (
        <AiAgentSupportBanner
          supportMode={supportMode}
          companyLabel={companyLabel}
        />
      ) : null}

      {loading ? <HubSkeleton /> : null}

      {!loading && accessDenied ? (
        <AppEmptyState
          title={i18n.t("aiAgentProduct.accessDenied.title")}
          description={i18n.t("aiAgentProduct.accessDenied.description")}
        />
      ) : null}

      {!loading && !accessDenied && error ? (
        <AppEmptyState
          title={i18n.t("aiAgentProduct.error.title")}
          description={i18n.t("aiAgentProduct.error.description")}
          data-testid="ai-agent-hub-error"
        >
          <AppSecondaryButton onClick={onRetry}>
            {i18n.t("aiAgentProduct.actions.retry")}
          </AppSecondaryButton>
        </AppEmptyState>
      ) : null}

      {!loading && !accessDenied && !error && list.length === 0 ? (
        <AppEmptyState
          title={i18n.t("aiAgentProduct.hub.emptyTitle")}
          description={i18n.t("aiAgentProduct.hub.emptyDescription")}
          data-testid="ai-agent-hub-empty"
        >
          {canCreate ? (
            <AppPrimaryButton
              onClick={goCreate}
              data-testid="ai-agent-hub-create-first"
            >
              {i18n.t("aiAgentProduct.hub.createFirst")}
            </AppPrimaryButton>
          ) : null}
        </AppEmptyState>
      ) : null}

      {!loading && !accessDenied && !error && list.length > 0 ? (
        <Box className={classes.stack}>
          <Typography variant="body2" color="textSecondary" component="p">
            {i18n.t("aiAgentProduct.hub.countLabel", { count: list.length })}
          </Typography>
          <MobileCardList className={classes.grid}>
            {list.map((agent) => {
              const ref = String(agent.agentRef || "");
              return (
                <AiAgentCard
                  key={ref}
                  agent={agent}
                  onManage={goManage}
                  onReview={goReview}
                  canManage={canCreate}
                  canMutate={mutateAllowed}
                  busy={busyAgentRef === ref}
                  onToggleRequest={handleToggleRequest}
                />
              );
            })}
          </MobileCardList>
        </Box>
      ) : null}

      <ConfirmationModal
        title={i18n.t("aiAgentProduct.hub.quickToggle.deactivateTitle")}
        open={Boolean(deactivateTarget)}
        onClose={cancelDeactivate}
        onConfirm={confirmDeactivate}
        confirmText={i18n.t("aiAgentProduct.hub.quickToggle.deactivateConfirm")}
        destructive
        loading={
          Boolean(deactivateTarget) &&
          busyAgentRef === String(deactivateTarget?.agentRef || "")
        }
        asyncConfirm
      >
        {i18n.t("aiAgentProduct.hub.quickToggle.deactivateBody")}
      </ConfirmationModal>

      <ConfirmationModal
        title={i18n.t("aiAgentProduct.hub.quickToggle.notReadyTitle")}
        open={Boolean(notReadyTarget)}
        onClose={dismissNotReady}
        onConfirm={confirmNotReadyReview}
        confirmText={i18n.t("aiAgentProduct.hub.reviewConfig")}
      >
        {i18n.t("aiAgentProduct.hub.quickToggle.notReadyBody")}
      </ConfirmationModal>
    </Box>
  );
}
