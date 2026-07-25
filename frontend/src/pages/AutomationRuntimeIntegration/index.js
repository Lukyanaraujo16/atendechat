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
  executeRuntimeIntegration,
  getRuntimeIntegrationConfig,
  getRuntimeIntegrationDashboard,
  inspectRuntimeDispatcher,
  listRuntimeRequests,
  previewRuntimeRequest,
  replayRuntimeIntegration,
  simulateRuntimePolicy,
  updateRuntimeIntegrationConfig,
} from "../../services/automationRuntimeIntegrationApi";

const ACTION_TYPES = [
  "SEARCH",
  "VALIDATE",
  "TRANSFER",
  "UPDATE",
  "SEND_MESSAGE",
  "WAIT_CONFIRMATION",
  "WAIT_INPUT",
  "CUSTOM",
];

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

function buildAction(actionType, objective) {
  return {
    id: `act_ui_${Date.now()}`,
    stepId: `step_ui_${Date.now()}`,
    actionType,
    objective,
    entities: [],
    constraints: [],
    expectedOutcome: "",
    requiresConfirmation: actionType === "WAIT_CONFIRMATION",
    retryable: true,
    metadata: {
      parameters: { query: objective, domain: "knowledge" },
    },
  };
}

export default function AutomationRuntimeIntegrationPage() {
  const classes = useStyles();
  const { canManage, canReplay, readOnlyManage } = useAgentOsConsolePermissions();
  const [tab, setTab] = useState(0);
  const [dash, setDash] = useState(null);
  const [actionType, setActionType] = useState("SEARCH");
  const [objective, setObjective] = useState("Como funciona o produto?");
  const [result, setResult] = useState(null);
  const [configJson, setConfigJson] = useState("");
  const [replayText, setReplayText] = useState("Como funciona o produto?");

  const load = useCallback(async () => {
    try {
      const [d, cfg] = await Promise.all([
        getRuntimeIntegrationDashboard(),
        getRuntimeIntegrationConfig(),
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

  return (
    <MainContainer>
      <MainHeader>
        <Title>Runtime Integration (V2.4)</Title>
      </MainHeader>

      <AgentOsReadOnlyBanner visible={readOnlyManage} />

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Runtime Integration Layer — conecta Core Cognitivo ao Runtime existente
          via contratos. Reutiliza Selection Engine, FC, Tool Runtime e
          Operation Runtime. Core permanece desacoplado.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={6} md={2}>
          <Metric label="Requests" value={dash?.requests} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric
            label="Dispatcher"
            value={Object.keys(dash?.dispatcher || {}).length}
            classes={classes}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric
            label="Policies"
            value={dash?.policies?.warnings}
            classes={classes}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric
            label="Latency"
            value={
              dash?.latency != null
                ? `${Math.round(dash.latency)}ms`
                : "—"
            }
            classes={classes}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric
            label="Cost"
            value={
              dash?.cost != null ? `$${Number(dash.cost).toFixed(4)}` : "—"
            }
            classes={classes}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric label="Failures" value={dash?.failures} classes={classes} />
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
          <Tab label="Request Builder" />
          <Tab label="Dispatcher Inspector" />
          <Tab label="Policy Simulator" />
          <Tab label="Adapter Inspector" />
          <Tab label="Result Viewer" />
          <Tab label="Replay" />
          <Tab label="Config" />
        </Tabs>

        <Box style={{ marginTop: 16 }}>
          {tab === 0 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                {
                  metrics: dash?.metrics,
                  reusedExistingRuntime: dash?.reusedExistingRuntime,
                  duplicateRuntimeCreated: dash?.duplicateRuntimeCreated,
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
                label="Action Type"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                margin="dense"
              >
                {ACTION_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
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
                  variant="outlined"
                  style={{ marginRight: 8, marginTop: 8 }}
                  onClick={async () => {
                    try {
                      const action = buildAction(actionType, objective);
                      const { data } = await previewRuntimeRequest({ action });
                      setResult(data);
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Preview Request
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  style={{ marginTop: 8 }}
                  onClick={async () => {
                    try {
                      const { data } = await executeRuntimeIntegration({
                        action: buildAction(actionType, objective),
                      });
                      setResult(data);
                      load();
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Execute Runtime
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {tab === 2 && (
            <Box>
              <AgentOsIf when={canManage}>
                <Button
                  variant="outlined"
                  onClick={async () => {
                    try {
                      const { data } = await inspectRuntimeDispatcher({
                        actionType,
                        operation: "search",
                      });
                      setResult(data);
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Inspecionar Dispatcher
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {tab === 3 && (
            <Box>
              <AgentOsIf when={canManage}>
                <Button
                  variant="outlined"
                  onClick={async () => {
                    try {
                      const { data } = await simulateRuntimePolicy({
                        action: buildAction(actionType, objective),
                      });
                      setResult(data);
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Simular Policy
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {tab === 4 && (
            <Box>
              <AgentOsIf when={canManage}>
                <Button
                  variant="outlined"
                  onClick={async () => {
                    try {
                      const action = buildAction("SEARCH", objective);
                      const { data } = await previewRuntimeRequest({ action });
                      setResult({
                        adapter: data?.adapter,
                        capability: data?.capability,
                        request: data?.request,
                      });
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Inspecionar Adapter
                </Button>
              </AgentOsIf>
            </Box>
          )}

          {tab === 5 && (
            <Box>
              <Button
                variant="outlined"
                onClick={async () => {
                  try {
                    const { data } = await listRuntimeRequests({ limit: 20 });
                    setResult(data);
                  } catch (err) {
                    toastAgentOsActionError(err);
                  }
                }}
              >
                Carregar Requests
              </Button>
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
                      const { data } = await replayRuntimeIntegration({
                        text: replayText,
                      });
                      setResult(data);
                    } catch (err) {
                      toastAgentOsActionError(err);
                    }
                  }}
                >
                  Replay Goal→Runtime
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
                      await updateRuntimeIntegrationConfig(parsed);
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

          {result && (
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
