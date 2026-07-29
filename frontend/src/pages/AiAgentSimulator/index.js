import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import Alert from "@material-ui/lab/Alert";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import { toast } from "react-toastify";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import SimulatorHeader from "../../components/AiAgentSimulator/SimulatorHeader";
import SimulatorChat from "../../components/AiAgentSimulator/SimulatorChat";
import SimulatorComposer from "../../components/AiAgentSimulator/SimulatorComposer";
import SimulatorScenarioChips from "../../components/AiAgentSimulator/SimulatorScenarioChips";
import SimulatorSessionSummary from "../../components/AiAgentSimulator/SimulatorSessionSummary";
import SimulatorReviewDialog from "../../components/AiAgentSimulator/SimulatorReviewDialog";
import {
  getSimulationPrompts,
  mapSimulatorError,
} from "../../components/AiAgentSimulator/aiAgentSimulatorHelpers";
import {
  AI_AGENT_ROUTE_PATH,
  AI_AGENT_WIZARD_ROUTE_PATH,
} from "../../config/aiAgentFeature";
import { useAiAgentProductSimulator } from "../../hooks/useAiAgentProductSimulator";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(2),
    [theme.breakpoints.up("md")]: {
      gridTemplateColumns: "1fr 260px",
    },
  },
  mainPanel: {
    padding: theme.spacing(2),
    minHeight: "calc(100vh - 220px)",
    display: "flex",
    flexDirection: "column",
  },
  sidePanel: {
    [theme.breakpoints.down("sm")]: {
      order: -1,
    },
  },
  unavailableActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
}));

function unavailableReasonKey(reason) {
  const known = [
    "not_created",
    "ambiguous",
    "credential_not_selected",
    "credential_disabled",
    "provider_unsupported",
    "model_incompatible",
    "simulator_not_configured",
  ];
  if (known.includes(reason)) {
    return `aiAgentProduct.simulator.reasons.${reason}`;
  }
  return "aiAgentProduct.simulator.reasons.simulator_not_configured";
}

export default function AiAgentSimulatorPage() {
  const classes = useStyles();
  const history = useHistory();
  const {
    bootstrap,
    session,
    messages,
    loading,
    bootLoading,
    loadBootstrap,
    startSession,
    sendMessage,
    restartSession,
    reviewMessage,
  } = useAiAgentProductSimulator();

  const [composer, setComposer] = useState("");
  const [reviewMessageItem, setReviewMessageItem] = useState(null);
  const [blocked, setBlocked] = useState(false);

  const available = bootstrap?.available === true;
  const canSimulate = bootstrap?.capabilities?.canSimulate === true;
  const segment = bootstrap?.scenarioSegment || "other";
  const scenarioPrompts = useMemo(() => getSimulationPrompts(segment), [segment]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await loadBootstrap();
        if (data?.available && data?.capabilities?.canSimulate) {
          setBlocked(false);
          await startSession();
        } else {
          setBlocked(true);
        }
      } catch (err) {
        toastError(err);
        setBlocked(true);
      }
    };
    load();
  }, [loadBootstrap, startSession]);

  const handleSend = async (textOverride) => {
    const content = String(textOverride ?? composer).trim();
    if (!content || !session?.ref || loading || blocked || !canSimulate) return;

    setComposer("");
    try {
      await sendMessage(session.ref, content);
    } catch (err) {
      const mapped = mapSimulatorError(err);
      const productCode = err?.response?.data?.error;
      if (
        mapped === "missingCredential" ||
        productCode === "ERR_AI_AGENT_PRODUCT_SIMULATOR_UNAVAILABLE"
      ) {
        setBlocked(true);
      }
      toast.error(
        mapped === "custom"
          ? err?.response?.data?.message || err?.response?.data?.clientMessage
          : i18n.t(`aiAgent.simulator.errors.${mapped}`)
      );
      if (composer === "" && textOverride) setComposer(textOverride);
    }
  };

  const handleRestart = async () => {
    try {
      await restartSession(session);
      setComposer("");
      toast.success(i18n.t("aiAgent.simulator.toasts.restarted"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(i18n.t("aiAgent.simulator.toasts.copied"));
    } catch {
      toast.error(i18n.t("aiAgent.simulator.toasts.copyError"));
    }
  };

  const handleReviewSubmit = async (body) => {
    if (!reviewMessageItem?.ref) return;
    try {
      await reviewMessage(reviewMessageItem.ref, body);
      setReviewMessageItem(null);
      toast.success(i18n.t("aiAgent.simulator.toasts.reviewSaved"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleRepeat = (assistantMessage) => {
    const key = assistantMessage.ref || assistantMessage.id;
    const index = messages.findIndex(
      (item) => (item.ref || item.id) === key
    );
    if (index <= 0) return;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        setComposer(messages[i].content);
        break;
      }
    }
  };

  const handleEdit = () => {
    history.push(AI_AGENT_WIZARD_ROUTE_PATH);
  };

  if (bootLoading) {
    return (
      <MainContainer>
        <MainHeader>
          <Title>{i18n.t("aiAgent.simulator.title")}</Title>
        </MainHeader>
      </MainContainer>
    );
  }

  if (!available || blocked) {
    return (
      <MainContainer>
        <MainHeader>
          <Title>{i18n.t("aiAgent.simulator.title")}</Title>
        </MainHeader>
        <Container maxWidth="md">
          <Alert severity="warning">
            {i18n.t(unavailableReasonKey(bootstrap?.reason))}
          </Alert>
          <div className={classes.unavailableActions}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => history.push(AI_AGENT_WIZARD_ROUTE_PATH)}
            >
              {i18n.t("aiAgentProduct.simulator.cta.configure")}
            </Button>
            <Button
              variant="outlined"
              onClick={() => history.push(AI_AGENT_ROUTE_PATH)}
            >
              {i18n.t("aiAgentProduct.simulator.cta.hub")}
            </Button>
          </div>
        </Container>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("aiAgent.simulator.title")}</Title>
      </MainHeader>
      <Container maxWidth="lg">
        <SimulatorHeader
          agentName={
            bootstrap?.agent?.name || i18n.t("aiAgent.simulator.untitled")
          }
          provider={
            session?.providerLabel || bootstrap?.provider?.label || null
          }
          model={
            session?.modelLabel || bootstrap?.provider?.modelLabel || null
          }
          onBack={() => history.push(AI_AGENT_ROUTE_PATH)}
          onRestart={handleRestart}
          onEdit={handleEdit}
        />

        <Alert severity="info" style={{ marginBottom: 16 }}>
          {i18n.t("aiAgent.simulator.warning")}
        </Alert>

        <div className={classes.layout}>
          <Paper className={classes.mainPanel} variant="outlined">
            <SimulatorScenarioChips
              prompts={scenarioPrompts}
              disabled={loading || blocked}
              onSelect={(text) => setComposer(text)}
            />
            <SimulatorChat
              messages={messages}
              loading={loading}
              onCopy={handleCopy}
              onReview={setReviewMessageItem}
              onRepeat={handleRepeat}
            />
            <SimulatorComposer
              value={composer}
              onChange={setComposer}
              onSend={() => handleSend()}
              disabled={
                loading || blocked || session?.status !== "active"
              }
            />
          </Paper>
          <div className={classes.sidePanel}>
            <SimulatorSessionSummary
              session={{
                ...(session || {}),
                averageLatencyMs: session?.averageResponseTimeMs,
                totalTokens: 0,
              }}
            />
          </div>
        </div>
      </Container>

      <SimulatorReviewDialog
        open={Boolean(reviewMessageItem)}
        onClose={() => setReviewMessageItem(null)}
        onSubmit={handleReviewSubmit}
        initialReview={reviewMessageItem?.review}
      />
    </MainContainer>
  );
}
