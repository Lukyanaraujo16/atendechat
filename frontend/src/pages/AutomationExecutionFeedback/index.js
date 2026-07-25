import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import AgentOsReadOnlyBanner from "../../components/AgentOsReadOnlyBanner";
import AgentOsIf from "../../components/AgentOsIf";
import useAgentOsConsolePermissions from "../../hooks/useAgentOsConsolePermissions";
import { toastAgentOsActionError } from "../../utils/agentOsActionError";
import {
  getExecutionFeedbackConfig,
  getExecutionFeedbackDashboard,
  listExecutionFeedback,
  processExecutionFeedback,
  replayExecutionFeedback,
  simulateExecutionFeedback,
  updateExecutionFeedbackConfig,
} from "../../services/automationExecutionFeedbackApi";

const RUNTIME_STATUSES = ["success", "failure", "waiting", "denied", "timeout"];

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

export default function AutomationExecutionFeedbackPage() {
  const classes = useStyles();
  const { canManage, canReplay, readOnlyManage } = useAgentOsConsolePermissions();
  const [tab, setTab] = useState(0);
  const [dash, setDash] = useState(null);
  const [runtimeStatus, setRuntimeStatus] = useState("success");
  const [objective, setObjective] = useState("Como funciona o produto?");
  const [result, setResult] = useState(null);
  const [configJson, setConfigJson] = useState("");
  const [replayText, setReplayText] = useState("Como funciona o produto?");

  const load = useCallback(async () => {
    try {
      const [d, cfg] = await Promise.all([
        getExecutionFeedbackDashboard(),
        getExecutionFeedbackConfig(),
      ]);
      setDash(d.data);
      setConfigJson(JSON.stringify(cfg.data?.config || {}, null, 2));
    } catch (err) {
      toastAgentOsActionError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pct = (v) =>
    v != null ? `${Math.round(Number(v) * 100)}%` : "—";

  return (
    <MainContainer>
      <MainHeader>
        <Title>Execution Feedback (V2.5)</Title>
      </MainHeader>

      <AgentOsReadOnlyBanner visible={readOnlyManage} />

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Execution Feedback Engine — interpreta Runtime Results sob ótica
          cognitiva. Regras determinísticas. Sem Tool, sem Planner, sem Provider.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={6} md={2}>
          <Metric
            label="Goal Progress"
            value={
              dash?.goalProgress != null
                ? `${Math.round(dash.goalProgress)}%`
                : "—"
            }
            classes={classes}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric
            label="Recovery"
            value={pct(dash?.recovery)}
            classes={classes}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric label="Replans" value={pct(dash?.replans)} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric
            label="Human Intervention"
            value={pct(dash?.humanIntervention)}
            classes={classes}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric
            label="Completion"
            value={pct(dash?.completion)}
            classes={classes}
          />
        </Grid>
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
          <Tab label="Feedback Simulator" />
          <Tab label="Recovery Viewer" />
          <Tab label="Goal Progress Viewer" />
          <Tab label="Session Update Viewer" />
          <Tab label="Knowledge Viewer" />
          <Tab label="Replay" />
          <Tab label="Config" />
        </Tabs>

        <Box style={{ marginTop: 16 }}>
          {tab === 0 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                {
                  metrics: dash?.metrics,
                  executesTools: dash?.executesTools,
                  callsPlanner: dash?.callsPlanner,
                },
                null,
                2
              )}
            </pre>
          )}

          {tab === 1 && (
            <Box>
              <TextField
                select
                fullWidth
                label="Runtime Status"
                value={runtimeStatus}
                onChange={(e) => setRuntimeStatus(e.target.value)}
                margin="dense"
              >
                {RUNTIME_STATUSES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                margin="dense"
              />
              <AgentOsIf when={canManage}>
                <Button
                  variant="contained"
                  color="primary"
                  style={{ marginTop: 8, marginRight: 8 }}
                  onClick={async () => {
                    try {
                      const { data } = await simulateExecutionFeedback({
                        runtimeStatus,
                        objective,
                      });
                      setResult(data);
                      load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Simular Feedback
                </Button>
                <Button
                  variant="outlined"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    try {
                      const { data } = await processExecutionFeedback({
                        runtimeResult: {
                          status: runtimeStatus,
                          errors: [],
                          warnings: [],
                          modelResult: { data: { query: objective } },
                        },
                        actionResult: {
                          status:
                            runtimeStatus === "success" ? "SUCCESS" : "FAILED",
                          validation:
                            runtimeStatus === "waiting" ? "WAITING" : "VALID",
                        },
                      });
                      setResult(data);
                      load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Processar Feedback
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {tab === 2 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                {
                  recoveryDecision: result?.record?.feedback?.recoveryDecision,
                  nextDecision: result?.record?.feedback?.nextDecision,
                  replanRequired: result?.record?.feedback?.replanRequired,
                },
                null,
                2
              )}
            </pre>
          )}

          {tab === 3 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                {
                  goalProgress: result?.record?.feedback?.goalProgress,
                  averageProgress: dash?.goalProgress,
                },
                null,
                2
              )}
            </pre>
          )}

          {tab === 4 && (
            <pre className={classes.mono}>
              {JSON.stringify(result?.record?.sessionUpdate || result?.updatedSession, null, 2)}
            </pre>
          )}

          {tab === 5 && (
            <Box>
              <Button
                variant="outlined"
                onClick={async () => {
                  try {
                    const { data } = await listExecutionFeedback({ limit: 10 });
                    setResult(data);
                  } catch (err) {
                    toastAgentOsActionError(err);
                  }
                }}
              >
                Carregar Feedbacks
              </Button>
              <pre className={classes.mono} style={{ marginTop: 8 }}>
                {JSON.stringify(
                  result?.record?.feedback?.knowledge ||
                    result?.feedbacks?.[0]?.feedback?.knowledge ||
                    result,
                  null,
                  2
                )}
              </pre>
            </Box>
          )}

          {tab === 6 && (
            <Box>
              <TextField
                fullWidth
                label="Texto para replay completo"
                value={replayText}
                onChange={(e) => setReplayText(e.target.value)}
                margin="dense"
              />
              <AgentOsIf when={canReplay}>
                <Button
                  variant="contained"
                  color="primary"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    try {
                      const { data } = await replayExecutionFeedback({
                        text: replayText,
                      });
                      setResult(data);
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Replay Goal→Feedback
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {tab === 7 && (
            <Box>
              <TextField
                fullWidth
                multiline
                minRows={12}
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                className={classes.mono}
              />
              <AgentOsIf when={canManage}>
                <Button
                  variant="contained"
                  color="primary"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    try {
                      const parsed = JSON.parse(configJson);
                      await updateExecutionFeedbackConfig(parsed);
                      load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Salvar Config
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {result && tab === 1 && (
            <Box mt={2}>
              <Typography variant="subtitle2">Último resultado</Typography>
              <pre className={classes.mono}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </Box>
          )}
        </Box>
      </Paper>
    </MainContainer>
  );
}
