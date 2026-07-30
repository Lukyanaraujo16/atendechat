import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import { makeStyles } from "@material-ui/core/styles";
import { AuthContext } from "../../context/Auth/AuthContext";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import AiAgentExperiencePage from "../../components/AiAgentExperiencePage";
import {
  AppEmptyState,
  AppSecondaryButton,
} from "../../ui";
import useAiAgentProductSummary from "../../hooks/useAiAgentProductSummary";
import { postAiAgentProductCommand } from "../../services/aiAgentProductApi";
import { AI_AGENT_ROUTE_PATH } from "../../config/aiAgentFeature";
import { notifyAiAgentProductAgentsChanged } from "../../utils/aiAgentProductAgentsCache";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  backButton: {
    marginRight: theme.spacing(1),
  },
  subtitle: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
}));

function mapCommandError(err) {
  const code = err?.response?.data?.error || err?.response?.data?.message;
  const status = err?.response?.status;
  if (status === 403 || code === "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED") {
    return i18n.t("aiAgentProduct.commandErrors.accessDenied");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE") {
    return i18n.t("aiAgentProduct.commandErrors.notAvailable");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_NOT_READY") {
    return i18n.t("aiAgentProduct.commandErrors.notReady");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_CONNECTION_UNAVAILABLE") {
    return i18n.t("aiAgentProduct.commandErrors.connectionUnavailable");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_COMMAND_NOT_ALLOWED") {
    return i18n.t("aiAgentProduct.commandErrors.notAllowed");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED") {
    return i18n.t("aiAgentProduct.commandErrors.agentRefRequired");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND") {
    return i18n.t("aiAgentProduct.hub.agentNotFoundDescription");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS") {
    return i18n.t("aiAgentProduct.commandErrors.ambiguous");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID") {
    return i18n.t("aiAgentProduct.commandErrors.contextInvalid");
  }
  return i18n.t("aiAgentProduct.commandErrors.generic");
}

/**
 * Visão agent-scoped — /ai-agent/:agentRef (Fases 2.9B–2.9C).
 */
export default function AiAgentDetailPage() {
  const classes = useStyles();
  const history = useHistory();
  const { agentRef: rawRef } = useParams();
  const agentRef = String(rawRef || "").trim();
  const { user } = useContext(AuthContext);
  const {
    loading,
    error,
    accessDenied,
    notFound,
    data,
    reload,
    applySummary,
  } = useAiAgentProductSummary({
    enabled: Boolean(agentRef),
    agentRef,
  });
  const [busyCommand, setBusyCommand] = useState(null);
  const [commandError, setCommandError] = useState(null);
  const agentRefLive = useRef(agentRef);
  agentRefLive.current = agentRef;

  useEffect(() => {
    setBusyCommand(null);
    setCommandError(null);
  }, [agentRef]);

  const canMutate =
    user?.profile === "admin" && user?.supportMode !== true;

  const handleCommand = useCallback(
    async (command) => {
      if (busyCommand || !agentRef || !canMutate) return;
      const startedAgentRef = agentRef;
      setBusyCommand(command);
      setCommandError(null);
      try {
        const { data: result } = await postAiAgentProductCommand(
          command,
          startedAgentRef
        );
        // Troca rápida de agente: ignore resposta stale do agente anterior.
        if (agentRefLive.current !== startedAgentRef) return;
        if (result?.summary) {
          applySummary(result.summary);
        } else {
          await reload();
        }
        if (agentRefLive.current !== startedAgentRef) return;
        notifyAiAgentProductAgentsChanged();
        toast.success(i18n.t(`aiAgentProduct.commandSuccess.${command}`));
      } catch (err) {
        if (agentRefLive.current !== startedAgentRef) return;
        const message = mapCommandError(err);
        setCommandError(message);
        toast.error(message);
        throw err;
      } finally {
        if (agentRefLive.current === startedAgentRef) {
          setBusyCommand(null);
        }
      }
    },
    [agentRef, applySummary, busyCommand, canMutate, reload]
  );

  const companyLabel =
    user?.company?.name ||
    user?.companyName ||
    (user?.companyId != null ? String(user.companyId) : "");

  const agentName =
    data?.agent?.name ||
    i18n.t("aiAgentProduct.meta.unnamed");

  if (!agentRef || notFound) {
    return (
      <MainContainer>
        <AppEmptyState
          title={i18n.t("aiAgentProduct.hub.agentNotFoundTitle")}
          description={i18n.t("aiAgentProduct.hub.agentNotFoundDescription")}
          data-testid="ai-agent-detail-not-found"
        >
          <AppSecondaryButton
            onClick={() => history.push(AI_AGENT_ROUTE_PATH)}
          >
            {i18n.t("aiAgentProduct.hub.backToAgents")}
          </AppSecondaryButton>
        </AppEmptyState>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <MainHeader>
        <Box display="flex" alignItems="center">
          <IconButton
            className={classes.backButton}
            onClick={() => history.push(AI_AGENT_ROUTE_PATH)}
            aria-label={i18n.t("aiAgentProduct.hub.backToAgents")}
            data-testid="ai-agent-detail-back"
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Title>
              {i18n.t("aiAgentProduct.hub.agentTitle", { name: agentName })}
            </Title>
            <Typography variant="body2" className={classes.subtitle}>
              {i18n.t("aiAgentProduct.hub.agentSubtitle")}
            </Typography>
          </Box>
        </Box>
      </MainHeader>

      <AiAgentExperiencePage
        loading={loading}
        error={error}
        accessDenied={accessDenied}
        summary={data}
        agentRef={agentRef}
        onRetry={reload}
        onCommand={handleCommand}
        commandBusy={busyCommand}
        commandError={commandError}
        supportMode={user?.supportMode === true}
        companyLabel={companyLabel}
        hidePageHeader
        canMutate={canMutate}
      />
    </MainContainer>
  );
}
