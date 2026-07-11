import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import Alert from "@material-ui/lab/Alert";
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
import {
  checkAiAgentSimulatorCredential,
  createAiAgentSimulatorSession,
  endAiAgentSimulatorSession,
  getAiAgent,
  getAiAgentProfile,
  getAiAgentSimulatorSession,
  sendAiAgentSimulatorMessage,
  upsertAiAgentSimulatorMessageReview,
} from "../../services/aiAgentApi";
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
}));

export default function AiAgentSimulatorPage() {
  const classes = useStyles();
  const history = useHistory();
  const { agentId } = useParams();
  const numericAgentId = Number(agentId);

  const [agent, setAgent] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [credentialBlocked, setCredentialBlocked] = useState(false);
  const [reviewMessage, setReviewMessage] = useState(null);

  const segment = profile?.businessSegment || "other";
  const scenarioPrompts = useMemo(() => getSimulationPrompts(segment), [segment]);

  const bootstrapSession = useCallback(async () => {
    const { data: created } = await createAiAgentSimulatorSession(numericAgentId);
    const { data: full } = await getAiAgentSimulatorSession(numericAgentId, created.id);
    setSession(full);
    setMessages(full.messages || []);
  }, [numericAgentId]);

  useEffect(() => {
    const load = async () => {
      try {
        setBootLoading(true);
        const [{ data: agentData }, credentialResult] = await Promise.all([
          getAiAgent(numericAgentId),
          checkAiAgentSimulatorCredential(numericAgentId),
        ]);

        setAgent(agentData);
        if (!credentialResult.data?.canSimulate) {
          setCredentialBlocked(true);
          return;
        }

        try {
          const { data: profileData } = await getAiAgentProfile(numericAgentId);
          setProfile(profileData?.profile || null);
        } catch {
          setProfile(null);
        }

        await bootstrapSession();
      } catch (err) {
        toastError(err);
      } finally {
        setBootLoading(false);
      }
    };

    if (Number.isFinite(numericAgentId)) load();
  }, [numericAgentId, bootstrapSession]);

  const handleSend = async (textOverride) => {
    const content = String(textOverride ?? composer).trim();
    if (!content || !session?.id || loading || credentialBlocked) return;

    setLoading(true);
    setComposer("");
    try {
      const { data } = await sendAiAgentSimulatorMessage(numericAgentId, session.id, {
        content,
      });
      setMessages((prev) => [
        ...prev,
        data.userMessage,
        data.assistantMessage,
      ]);
      setSession((prev) => ({ ...prev, ...data.session }));
    } catch (err) {
      const mapped = mapSimulatorError(err);
      if (mapped === "missingCredential") {
        setCredentialBlocked(true);
      }
      toast.error(
        mapped === "custom"
          ? err?.response?.data?.message
          : i18n.t(`aiAgent.simulator.errors.${mapped}`)
      );
      if (composer === "" && textOverride) setComposer(textOverride);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    try {
      if (session?.id && session.status === "active") {
        await endAiAgentSimulatorSession(numericAgentId, session.id);
      }
      await bootstrapSession();
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
    if (!reviewMessage?.id || !session?.id) return;
    try {
      const { data } = await upsertAiAgentSimulatorMessageReview(
        numericAgentId,
        session.id,
        reviewMessage.id,
        body
      );
      setMessages((prev) =>
        prev.map((item) =>
          item.id === reviewMessage.id ? { ...item, review: data } : item
        )
      );
      setReviewMessage(null);
      toast.success(i18n.t("aiAgent.simulator.toasts.reviewSaved"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleRepeat = (assistantMessage) => {
    const index = messages.findIndex((item) => item.id === assistantMessage.id);
    if (index <= 0) return;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        setComposer(messages[i].content);
        break;
      }
    }
  };

  const handleEdit = () => {
    if (profile?.setupMode === "guided") {
      history.push(`${AI_AGENT_WIZARD_ROUTE_PATH}/${numericAgentId}`);
      return;
    }
    history.push(AI_AGENT_ROUTE_PATH);
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

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("aiAgent.simulator.title")}</Title>
      </MainHeader>
      <Container maxWidth="lg">
        <SimulatorHeader
          agentName={agent?.name || i18n.t("aiAgent.simulator.untitled")}
          provider={session?.provider}
          model={session?.model}
          onBack={() => history.push(AI_AGENT_ROUTE_PATH)}
          onRestart={handleRestart}
          onEdit={handleEdit}
        />

        <Alert severity="info" style={{ marginBottom: 16 }}>
          {i18n.t("aiAgent.simulator.warning")}
        </Alert>

        {credentialBlocked ? (
          <Alert severity="warning">{i18n.t("aiAgent.simulator.errors.missingCredential")}</Alert>
        ) : null}

        <div className={classes.layout}>
          <Paper className={classes.mainPanel} variant="outlined">
            <SimulatorScenarioChips
              prompts={scenarioPrompts}
              disabled={loading || credentialBlocked}
              onSelect={(text) => setComposer(text)}
            />
            <SimulatorChat
              messages={messages}
              loading={loading}
              onCopy={handleCopy}
              onReview={setReviewMessage}
              onRepeat={handleRepeat}
            />
            <SimulatorComposer
              value={composer}
              onChange={setComposer}
              onSend={() => handleSend()}
              disabled={loading || credentialBlocked || session?.status !== "active"}
            />
          </Paper>
          <div className={classes.sidePanel}>
            <SimulatorSessionSummary session={session} />
          </div>
        </div>
      </Container>

      <SimulatorReviewDialog
        open={Boolean(reviewMessage)}
        onClose={() => setReviewMessage(null)}
        onSubmit={handleReviewSubmit}
        initialReview={reviewMessage?.review}
      />
    </MainContainer>
  );
}
