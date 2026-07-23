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
import toastError from "../../errors/toastError";
import {
  executeAction,
  getActionExecutionConfig,
  getActionExecutionDashboard,
  inspectActionStrategy,
  listActionResults,
  listActionStrategies,
  replayActionExecution,
  simulateAction,
  updateActionExecutionConfig,
} from "../../services/automationActionExecutionApi";

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

export default function AutomationActionExecutionPage() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [dash, setDash] = useState(null);
  const [strategies, setStrategies] = useState([]);
  const [actionType, setActionType] = useState("SEARCH");
  const [objective, setObjective] = useState("Buscar informações do pedido");
  const [stepType, setStepType] = useState("search");
  const [result, setResult] = useState(null);
  const [configJson, setConfigJson] = useState("");
  const [replayText, setReplayText] = useState("Como funciona o produto?");

  const load = useCallback(async () => {
    try {
      const [d, s, cfg] = await Promise.all([
        getActionExecutionDashboard(),
        listActionStrategies(),
        getActionExecutionConfig(),
      ]);
      setDash(d.data);
      setStrategies(s.data?.strategies || []);
      setConfigJson(JSON.stringify(cfg.data?.config || {}, null, 2));
    } catch (err) {
      toastError(err);
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
        <Title>Action Execution (V2.3)</Title>
      </MainHeader>

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Action Execution Engine — executor genérico com Strategies simuladas.
          Sem Tool Runtime, sem Providers, sem Live/Shadow.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={6} md={3}>
          <Metric label="Strategies" value={dash?.strategies} classes={classes} />
        </Grid>
        <Grid item xs={6} md={3}>
          <Metric
            label="Success Rate"
            value={pct(dash?.successRate)}
            classes={classes}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <Metric label="Failures" value={dash?.failures} classes={classes} />
        </Grid>
        <Grid item xs={6} md={3}>
          <Metric label="Waiting" value={dash?.waiting} classes={classes} />
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
          <Tab label="Action Simulator" />
          <Tab label="Strategy Inspector" />
          <Tab label="Strategy Runner" />
          <Tab label="Result Viewer" />
          <Tab label="Validation Viewer" />
          <Tab label="Replay" />
          <Tab label="Config" />
        </Tabs>

        <Box style={{ marginTop: 16 }}>
          {tab === 0 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                {
                  validation: dash?.validation,
                  metrics: dash?.metrics,
                  strategies,
                  usesToolRuntime: dash?.usesToolRuntime,
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
              <Button
                variant="contained"
                color="primary"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    const { data } = await simulateAction({
                      actionType,
                      objective,
                    });
                    setResult(data);
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Simular Action
              </Button>
            </Box>
          )}

          {tab === 2 && (
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
              <Button
                variant="outlined"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    const { data } = await inspectActionStrategy({ actionType });
                    setResult(data);
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Inspecionar Strategy
              </Button>
            </Box>
          )}

          {tab === 3 && (
            <Box>
              <TextField
                fullWidth
                label="Step Type"
                value={stepType}
                onChange={(e) => setStepType(e.target.value)}
                margin="dense"
              />
              <TextField
                fullWidth
                label="Objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                margin="dense"
              />
              <Button
                variant="contained"
                color="primary"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    const { data } = await executeAction({
                      stepId: `run_${Date.now()}`,
                      stepType,
                      objective,
                    });
                    setResult(data);
                    load();
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Executar via Engine
              </Button>
            </Box>
          )}

          {tab === 4 && (
            <Box>
              <Button
                variant="outlined"
                onClick={async () => {
                  try {
                    const { data } = await listActionResults({ limit: 20 });
                    setResult(data);
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Carregar Results
              </Button>
            </Box>
          )}

          {tab === 5 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                {
                  validation: result?.result?.validation,
                  status: result?.result?.status,
                  validationRate: dash?.validation,
                },
                null,
                2
              )}
            </pre>
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
              <Button
                variant="contained"
                color="primary"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    const { data } = await replayActionExecution({
                      text: replayText,
                    });
                    setResult(data);
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Replay Goal→Action
              </Button>
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
              <Button
                variant="contained"
                color="primary"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    const parsed = JSON.parse(configJson);
                    await updateActionExecutionConfig(parsed);
                    load();
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Salvar Config
              </Button>
            </Box>
          )}

          {result && tab !== 5 && (
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
