import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Grid,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import AgentOsReadOnlyBanner from "../../components/AgentOsReadOnlyBanner";
import AgentOsIf from "../../components/AgentOsIf";
import useAgentOsConsolePermissions from "../../hooks/useAgentOsConsolePermissions";
import { toastAgentOsActionError } from "../../utils/agentOsActionError";
import {
  abortExecutionSession,
  advanceExecutionSession,
  createExecutionSession,
  getExecutionOrchestratorConfig,
  getExecutionSessionsDashboard,
  inspectExecutionGraph,
  pauseExecutionSession,
  replayExecutionSession,
  resumeExecutionSession,
  simulateExecutionRecovery,
  simulateExecutionTransition,
  startExecutionSession,
  updateExecutionOrchestratorConfig,
} from "../../services/automationExecutionOrchestratorApi";

const useStyles = makeStyles((theme) => ({
  paper: { padding: theme.spacing(2), marginBottom: theme.spacing(2) },
  card: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    height: "100%",
  },
  mono: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
}));

function Metric({ label, value, classes }) {
  return (
    <Box className={classes.card}>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="h6">{value ?? "—"}</Typography>
    </Box>
  );
}

export default function AutomationExecutionSessionsPage() {
  const classes = useStyles();
  const { canManage, canReplay, readOnlyManage } = useAgentOsConsolePermissions();
  const [tab, setTab] = useState(0);
  const [dash, setDash] = useState(null);
  const [text, setText] = useState("Como funciona o produto?");
  const [sessionId, setSessionId] = useState("");
  const [result, setResult] = useState(null);
  const [configJson, setConfigJson] = useState("");
  const [fromState, setFromState] = useState("READY");
  const [toState, setToState] = useState("RUNNING");

  const load = useCallback(async () => {
    try {
      const [{ data }, cfg] = await Promise.all([
        getExecutionSessionsDashboard(),
        getExecutionOrchestratorConfig(),
      ]);
      setDash(data);
      setConfigJson(JSON.stringify(cfg.data?.config || {}, null, 2));
    } catch (err) {
      toastAgentOsActionError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const c = dash?.counts || {};
  const m = dash?.metrics || {};

  return (
    <MainContainer>
      <MainHeader>
        <Title>Execution Sessions (V2.2)</Title>
      </MainHeader>

      <AgentOsReadOnlyBanner visible={readOnlyManage} />

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Execution Orchestrator — controla ciclo de vida da sessão. Não executa
          Tools, não conhece Provider/Runtime. Live/Shadow isolados.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {[
          ["Running", c.running],
          ["Paused", c.paused],
          ["Recovering", c.recovering],
          ["Completed", c.completed],
          ["Failed", c.failed],
          ["Waiting Confirm", c.waitingConfirmation],
          ["Waiting Input", c.waitingInput],
          ["Created", m.sessionsCreated],
        ].map(([label, value]) => (
          <Grid item xs={6} md={3} key={label}>
            <Metric label={label} value={value} classes={classes} />
          </Grid>
        ))}
      </Grid>

      <Paper className={classes.paper} variant="outlined" style={{ marginTop: 16 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
        >
          <Tab label="Overview" />
          <Tab label="Session Simulator" />
          <Tab label="State Simulator" />
          <Tab label="Graph Viewer" />
          <Tab label="Next Step / Recovery" />
          <Tab label="Replay" />
          <Tab label="Config" />
        </Tabs>

        <Box style={{ marginTop: 16 }}>
          {tab === 0 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                {
                  guarantees: dash?.guarantees,
                  metrics: m,
                  recent: dash?.recentSessions?.slice(0, 5),
                },
                null,
                2
              )}
            </pre>
          )}

          {tab === 1 && (
            <Box>
              <TextField
                label="Mensagem"
                value={text}
                onChange={(e) => setText(e.target.value)}
                fullWidth
                size="small"
                variant="outlined"
                style={{ marginBottom: 8 }}
              />
              <TextField
                label="Session ID"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                fullWidth
                size="small"
                variant="outlined"
                style={{ marginBottom: 8 }}
              />
              <AgentOsIf when={canManage}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    try {
                      const { data } = await createExecutionSession({ text });
                      setSessionId(data.session?.id || "");
                      setResult(data);
                      toast.success("Sessão criada");
                      await load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Create
                </Button>
                <Button
                  style={{ marginLeft: 8 }}
                  variant="outlined"
                  onClick={async () => {
                    try {
                      const { data } = await startExecutionSession({ sessionId });
                      setResult(data);
                      await load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Start
                </Button>
                <Button
                  style={{ marginLeft: 8 }}
                  variant="outlined"
                  onClick={async () => {
                    try {
                      const { data } = await advanceExecutionSession({
                        sessionId,
                        action: "complete",
                      });
                      setResult(data);
                      await load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Advance complete
                </Button>
                <Button
                  style={{ marginLeft: 8 }}
                  variant="outlined"
                  onClick={async () => {
                    try {
                      const { data } = await pauseExecutionSession({ sessionId });
                      setResult(data);
                      await load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Pause
                </Button>
                <Button
                  style={{ marginLeft: 8 }}
                  variant="outlined"
                  onClick={async () => {
                    try {
                      const { data } = await resumeExecutionSession({ sessionId });
                      setResult(data);
                      await load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Resume
                </Button>
                <Button
                  style={{ marginLeft: 8 }}
                  variant="outlined"
                  color="secondary"
                  onClick={async () => {
                    try {
                      const { data } = await abortExecutionSession({ sessionId });
                      setResult(data);
                      await load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Abort
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {tab === 2 && (
            <Box>
              <TextField
                label="From"
                value={fromState}
                onChange={(e) => setFromState(e.target.value)}
                size="small"
                variant="outlined"
                style={{ marginRight: 8 }}
              />
              <TextField
                label="To"
                value={toState}
                onChange={(e) => setToState(e.target.value)}
                size="small"
                variant="outlined"
                style={{ marginRight: 8 }}
              />
              <AgentOsIf when={canManage}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    try {
                      const { data } = await simulateExecutionTransition({
                        from: fromState,
                        to: toState,
                      });
                      setResult(data);
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Validar transição
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {tab === 3 && (
            <Box>
              <TextField
                label="Texto"
                value={text}
                onChange={(e) => setText(e.target.value)}
                fullWidth
                size="small"
                variant="outlined"
                style={{ marginBottom: 8 }}
              />
              <AgentOsIf when={canManage}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    try {
                      const { data } = await inspectExecutionGraph({
                        text,
                        sessionId: sessionId || undefined,
                      });
                      setResult(data);
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Ver Graph
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {tab === 4 && (
            <Box>
              <AgentOsIf when={canManage}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    try {
                      const { data } = await simulateExecutionRecovery({
                        text,
                        sessionId: sessionId || undefined,
                      });
                      setResult(data);
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Recovery Simulator
                </Button>
                <Button
                  style={{ marginLeft: 8 }}
                  variant="outlined"
                  onClick={async () => {
                    try {
                      const { data } = await advanceExecutionSession({
                        sessionId,
                        action: "fail",
                      });
                      setResult(data);
                      await load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Fail step (recovery)
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {tab === 5 && (
            <AgentOsIf when={canReplay}>
              <Button
                variant="contained"
                color="primary"
                onClick={async () => {
                  try {
                    const { data } = await replayExecutionSession({
                      text,
                      sessionId: sessionId || undefined,
                    });
                    setResult(data);
                    await load();
                  } catch (err) {
                    toastAgentOsActionError(err);
                  }
                }}
              >
                Replay completo
              </Button>
            </AgentOsIf>
          )}

          {tab === 6 && (
            <Box>
              <TextField
                label="Config JSON"
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                fullWidth
                multiline
                rows={10}
                variant="outlined"
              />
              <AgentOsIf when={canManage}>
                <Button
                  style={{ marginTop: 8 }}
                  variant="contained"
                  color="primary"
                  onClick={async () => {
                    try {
                      await updateExecutionOrchestratorConfig(
                        JSON.parse(configJson)
                      );
                      toast.success("Config salva");
                      await load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Salvar config
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {result && (
            <Paper
              className={classes.paper}
              variant="outlined"
              style={{ marginTop: 16 }}
            >
              <pre className={classes.mono}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </Paper>
          )}
        </Box>
      </Paper>
    </MainContainer>
  );
}
