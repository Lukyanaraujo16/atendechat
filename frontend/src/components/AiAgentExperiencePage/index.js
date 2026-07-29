import React from "react";
import { useHistory } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Skeleton from "@material-ui/lab/Skeleton";
import { makeStyles } from "@material-ui/core/styles";
import {
  AppPageHeader,
  AppEmptyState,
  AppSecondaryButton,
  AppNeutralButton,
} from "../../ui";
import Title from "../Title";
import MainHeaderButtonsWrapper from "../MainHeaderButtonsWrapper";
import AiAgentStatusCard from "../AiAgentStatusCard";
import AiAgentReadinessChecklist from "../AiAgentReadinessChecklist";
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
  secondary: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  skeletonCard: {
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
  },
  supportHint: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  commandError: {
    color: theme.palette.error.main,
    marginBottom: theme.spacing(1),
  },
}));

function ExperienceSkeleton() {
  const classes = useStyles();
  return (
    <Box
      className={classes.stack}
      role="status"
      aria-busy="true"
      aria-label={i18n.t("aiAgentProduct.loading.aria")}
    >
      <Skeleton variant="rect" height={28} width="40%" className={classes.skeletonCard} />
      <Skeleton variant="rect" height={160} className={classes.skeletonCard} />
      <Skeleton variant="rect" height={120} className={classes.skeletonCard} />
    </Box>
  );
}

/**
 * Experience Layer — Product API leitura + comandos comerciais (Fase 2.2).
 */
export default function AiAgentExperiencePage({
  loading,
  error,
  accessDenied,
  summary,
  onRetry,
  onCommand,
  commandBusy = false,
  commandError = null,
  supportMode,
  companyLabel,
}) {
  const classes = useStyles();
  const history = useHistory();

  const showChecklist =
    summary &&
    summary.status !== "unavailable" &&
    summary.status !== "not_created" &&
    Array.isArray(summary.checks) &&
    summary.checks.length > 0;

  const showActivationActions =
    summary &&
    summary.availability?.enabledByPlan === true &&
    summary.status !== "unavailable" &&
    summary.agentScope?.type !== "ambiguous";

  return (
    <Box className={classes.root} data-testid="ai-agent-experience">
      <AppPageHeader
        title={<Title>{i18n.t("aiAgentProduct.page.title")}</Title>}
        subtitle={
          <Typography variant="body2" color="textSecondary">
            {i18n.t("aiAgentProduct.page.subtitle")}
          </Typography>
        }
        actions={
          <MainHeaderButtonsWrapper>
            <AppNeutralButton onClick={onRetry} disabled={loading || commandBusy}>
              {i18n.t("aiAgentProduct.actions.refresh")}
            </AppNeutralButton>
          </MainHeaderButtonsWrapper>
        }
      />

      {supportMode && companyLabel ? (
        <Typography variant="caption" className={classes.supportHint}>
          {i18n.t("aiAgentProduct.support.activeCompany", { name: companyLabel })}
        </Typography>
      ) : null}

      {loading ? <ExperienceSkeleton /> : null}

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
        >
          <AppSecondaryButton onClick={onRetry}>
            {i18n.t("aiAgentProduct.actions.retry")}
          </AppSecondaryButton>
        </AppEmptyState>
      ) : null}

      {!loading && !accessDenied && !error && summary ? (
        <Box className={classes.stack}>
          {summary.agentScope?.type === "ambiguous" ? (
            <Typography
              variant="body2"
              role="status"
              data-testid="ai-agent-ambiguous-notice"
              className={classes.supportHint}
            >
              {i18n.t("aiAgentProduct.ambiguous.description", {
                count: summary.agentScope.count,
              })}
            </Typography>
          ) : null}

          {commandError ? (
            <Typography
              variant="body2"
              className={classes.commandError}
              role="alert"
              data-testid="ai-agent-command-error"
            >
              {commandError}
            </Typography>
          ) : null}

          <AiAgentStatusCard
            summary={summary}
            onRefresh={onRetry}
            onCommand={showActivationActions ? onCommand : undefined}
            commandBusy={commandBusy}
          />

          {showChecklist ? (
            <AiAgentReadinessChecklist checks={summary.checks} />
          ) : null}

          {summary.status !== "unavailable" &&
          Array.isArray(summary.secondaryActions) &&
          summary.secondaryActions.length > 0 ? (
            <Box
              component="nav"
              className={classes.secondary}
              aria-label={i18n.t("aiAgentProduct.secondary.aria")}
            >
              {summary.secondaryActions.map((action) =>
                action.enabled && action.path ? (
                  <AppSecondaryButton
                    key={action.id}
                    onClick={() => history.push(action.path)}
                    disabled={commandBusy}
                    data-testid={`ai-agent-secondary-${action.id}`}
                  >
                    {i18n.t(action.labelKey)}
                  </AppSecondaryButton>
                ) : null
              )}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
