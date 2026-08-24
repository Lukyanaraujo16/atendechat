import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import Typography from "@material-ui/core/Typography";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import { makeStyles } from "@material-ui/core/styles";
import { AuthContext } from "../../context/Auth/AuthContext";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import AiAgentExperiencePage from "../../components/AiAgentExperiencePage";
import AiAgentConnectionsPanel from "../../components/AiAgentConnectionsPanel";
import AiAgentProductCredentialModal from "../../components/AiAgentProductCredentialModal";
import {
  AiAgentIdentityPanel,
  AiAgentIntelligencePanel,
  AiAgentKnowledgePanel,
  AiAgentSettingsPanel,
  AiAgentTestsPanel,
} from "../../components/AiAgentAdminPanels";
import {
  AppEmptyState,
  AppSecondaryButton,
} from "../../ui";
import useAiAgentProductSummary from "../../hooks/useAiAgentProductSummary";
import {
  getAiAgentProductConfiguration,
  postAiAgentProductCommand,
} from "../../services/aiAgentProductApi";
import {
  AI_AGENT_DETAIL_SECTIONS,
  AI_AGENT_ROUTE_PATH,
  aiAgentSectionPath,
  parseAiAgentDetailSection,
} from "../../config/aiAgentFeature";
import { notifyAiAgentProductAgentsChanged } from "../../utils/aiAgentProductAgentsCache";
import { canManageAiAgentProduct } from "../../utils/canManageAiAgentProduct";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  backButton: {
    marginRight: theme.spacing(1),
  },
  subtitle: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  tabs: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  panel: {
    marginTop: theme.spacing(1),
  },
}));

const TAB_KEYS = AI_AGENT_DETAIL_SECTIONS.filter((key) => key !== "tests");

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
 * Administração completa agent-scoped — /ai-agent/:agentRef(/:section)
 * Fase 2.10.
 */
export default function AiAgentDetailPage() {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();
  const { agentRef: rawRef, section: rawSection } = useParams();
  const parsed = parseAiAgentDetailSection(location.pathname);
  const agentRef = String(rawRef || parsed.agentRef || "").trim();
  const section =
    rawSection && TAB_KEYS.includes(rawSection)
      ? rawSection
      : parsed.section === "tests"
        ? "overview"
        : TAB_KEYS.includes(parsed.section)
          ? parsed.section
          : "overview";

  const { user } = useContext(AuthContext);
  const {
    loading,
    error,
    accessDenied,
    notFound,
    archived,
    data,
    reload,
    applySummary,
  } = useAiAgentProductSummary({
    enabled: Boolean(agentRef),
    agentRef,
  });
  const [busyCommand, setBusyCommand] = useState(null);
  const [commandError, setCommandError] = useState(null);
  const [editableWhileActive, setEditableWhileActive] = useState(null);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const agentRefLive = useRef(agentRef);
  agentRefLive.current = agentRef;

  useEffect(() => {
    setBusyCommand(null);
    setCommandError(null);
  }, [agentRef]);

  useEffect(() => {
    if (!archived) return undefined;
    toast.info(i18n.t("aiAgentProduct.archive.archivedToast"));
    history.replace(AI_AGENT_ROUTE_PATH);
    return undefined;
  }, [archived, history]);

  const canMutate = canManageAiAgentProduct(user);

  const loadEditableFlag = useCallback(async () => {
    if (!agentRef) return;
    const started = agentRef;
    try {
      const cfg = await getAiAgentProductConfiguration(started);
      if (agentRefLive.current !== started) return;
      setEditableWhileActive(cfg?.editableWhileActive !== false);
    } catch (_err) {
      if (agentRefLive.current === started) setEditableWhileActive(null);
    }
  }, [agentRef]);

  useEffect(() => {
    loadEditableFlag();
  }, [loadEditableFlag]);

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
        if (agentRefLive.current !== startedAgentRef) return;
        if (result?.summary) {
          applySummary(result.summary);
        } else {
          await reload();
        }
        if (agentRefLive.current !== startedAgentRef) return;
        notifyAiAgentProductAgentsChanged();
        toast.success(i18n.t(`aiAgentProduct.commandSuccess.${command}`));
        await loadEditableFlag();
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
    [agentRef, applySummary, busyCommand, canMutate, loadEditableFlag, reload]
  );

  const companyLabel =
    user?.company?.name ||
    user?.companyName ||
    (user?.companyId != null ? String(user.companyId) : "");

  const agentName =
    data?.agent?.name ||
    i18n.t("aiAgentProduct.meta.unnamed");

  const tabIndex = useMemo(() => {
    const idx = TAB_KEYS.indexOf(section);
    return idx >= 0 ? idx : 0;
  }, [section]);

  const handleTabChange = (_event, nextIndex) => {
    const next = TAB_KEYS[nextIndex] || "overview";
    history.push(aiAgentSectionPath(agentRef, next));
  };

  const handleSaved = async () => {
    await reload();
    await loadEditableFlag();
  };

  if (archived) {
    return null;
  }

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

      <Tabs
        className={classes.tabs}
        value={tabIndex}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        aria-label={i18n.t("aiAgentProduct.admin.tabsAria")}
        data-testid="ai-agent-admin-tabs"
      >
        {TAB_KEYS.map((key) => (
          <Tab
            key={key}
            label={i18n.t(`aiAgentProduct.admin.sections.${key}`)}
            data-testid={`ai-agent-tab-${key}`}
          />
        ))}
      </Tabs>

      <Box className={classes.panel}>
        {section === "overview" ? (
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
        ) : null}

        {section === "identity" ? (
          <AiAgentIdentityPanel
            agentRef={agentRef}
            canMutate={canMutate}
            editableWhileActive={editableWhileActive}
            onSaved={handleSaved}
          />
        ) : null}

        {section === "intelligence" ? (
          <AiAgentIntelligencePanel
            agentRef={agentRef}
            canMutate={canMutate}
            editableWhileActive={editableWhileActive}
            onDeactivate={() => handleCommand("deactivate")}
            commandBusy={busyCommand}
            onSaved={handleSaved}
            onOpenCredentials={() => setCredentialModalOpen(true)}
          />
        ) : null}

        {section === "knowledge" ? (
          <AiAgentKnowledgePanel
            agentRef={agentRef}
            canMutate={canMutate}
            editableWhileActive={editableWhileActive}
            onDeactivate={() => handleCommand("deactivate")}
            commandBusy={busyCommand}
          />
        ) : null}

        {section === "connections" ? (
          <AiAgentConnectionsPanel
            embedded
            open
            agentRef={agentRef}
            agentName={agentName}
            onChanged={handleSaved}
            canMutate={canMutate}
          />
        ) : null}

        {section === "settings" ? (
          <>
            <AiAgentTestsPanel agentRef={agentRef} />
            <Box mt={3}>
              <AiAgentSettingsPanel
                summary={data}
                canMutate={canMutate}
                onCommand={handleCommand}
                commandBusy={busyCommand}
                onOpenCredentials={() => setCredentialModalOpen(true)}
                supportMode={user?.supportMode === true}
                agentRef={agentRef}
              />
            </Box>
          </>
        ) : null}
      </Box>

      <AiAgentProductCredentialModal
        open={credentialModalOpen}
        onClose={() => setCredentialModalOpen(false)}
        onSuccess={handleSaved}
        mode="manage"
      />
    </MainContainer>
  );
}
