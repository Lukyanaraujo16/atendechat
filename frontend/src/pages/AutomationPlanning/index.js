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
  analyzeCognitiveGoal,
  generateCognitivePlan,
  getCognitivePlanningDashboard,
  inspectCognitiveDependencies,
  evaluateCognitivePlan,
  replayCognitivePlan,
  simulateCognitiveRecovery,
  simulateCognitiveValidation,
} from "../../services/automationCognitivePlanningApi";

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
  filters: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
    alignItems: "flex-start",
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

export default function AutomationPlanningPage() {
  const classes = useStyles();
  const { canManage, canReplay, readOnlyManage } = useAgentOsConsolePermissions();
  const [tab, setTab] = useState(0);
  const [dash, setDash] = useState(null);
  const [text, setText] = useState(
    "Quero transferir para um atendente e saber o status do pedido 12345"
  );
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await getCognitivePlanningDashboard();
      setDash(data);
    } catch (err) {
      toastAgentOsActionError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, okMsg) => {
    try {
      const { data } = await fn({ text });
      setResult(data);
      toast.success(okMsg);
      await load();
    } catch (err) {
      toastAgentOsActionError(err);
    }
  };

  const m = dash?.metrics || {};

  return (
    <MainContainer>
      <MainHeader>
        <Title>Planning (Cognitive V2)</Title>
      </MainHeader>

      <AgentOsReadOnlyBanner visible={readOnlyManage} />

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Cognitive Planning Engine — gera Goals e Execution Plans. Não executa
          Tools, não altera Live/Shadow/Runtime. Recovery apenas sugerido
          (autoExecute=false).
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {[
          ["Plans", m.plansGenerated],
          ["Avg steps", m.averageSteps],
          ["Avg complexity", m.averageComplexity],
          ["Avg risk", m.averageRisk],
          ["Avg latency", m.averageLatency],
          ["Recovery rate", m.recoveryRate],
          ["Validation fails", m.validationFailures],
          ["Version", dash?.version],
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
          <Tab label="Goal Inspector" />
          <Tab label="Plan Generator" />
          <Tab label="Dependency Viewer" />
          <Tab label="Recovery Simulator" />
          <Tab label="Replay" />
          <Tab label="Evaluation" />
        </Tabs>

        <Box className={classes.filters} style={{ marginTop: 16 }}>
          <TextField
            label="Mensagem / Goal text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            size="small"
          />
        </Box>

        {tab === 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Goals / Plans / Recoveries recentes
            </Typography>
            <pre className={classes.mono}>
              {JSON.stringify(
                {
                  guarantees: dash?.guarantees,
                  recentGoals: dash?.recentGoals?.slice(0, 5),
                  recentPlans: dash?.recentPlans?.slice(0, 5),
                  recentRecoveries: dash?.recentRecoveries?.slice(0, 5),
                  recentValidations: dash?.recentValidations?.slice(0, 8),
                },
                null,
                2
              )}
            </pre>
          </Box>
        )}

        {tab === 1 && (
          <AgentOsIf when={canManage}>
            <Box>
              <Button
                variant="contained"
                color="primary"
                onClick={() => run(analyzeCognitiveGoal, "Goal analisado")}
              >
                Analisar Goal
              </Button>
            </Box>
          </AgentOsIf>
        )}

        {tab === 2 && (
          <AgentOsIf when={canManage}>
            <Box>
              <Button
                variant="contained"
                color="primary"
                onClick={() => run(generateCognitivePlan, "Plan gerado")}
              >
                Gerar Execution Plan
              </Button>
            </Box>
          </AgentOsIf>
        )}

        {tab === 3 && (
          <AgentOsIf when={canManage}>
            <Box>
              <Button
                variant="contained"
                color="primary"
                onClick={() =>
                  run(inspectCognitiveDependencies, "Dependências resolvidas")
                }
              >
                Ver dependências
              </Button>
            </Box>
          </AgentOsIf>
        )}

        {tab === 4 && (
          <AgentOsIf when={canManage}>
            <Box>
              <Button
                variant="contained"
                color="primary"
                onClick={() =>
                  run(simulateCognitiveRecovery, "Recovery simulado")
                }
              >
                Simular Recovery
              </Button>
              <Button
                style={{ marginLeft: 8 }}
                variant="outlined"
                onClick={() =>
                  run(simulateCognitiveValidation, "Validação simulada")
                }
              >
                Simular Validation
              </Button>
            </Box>
          </AgentOsIf>
        )}

        {tab === 5 && (
          <AgentOsIf when={canReplay}>
            <Box>
              <Button
                variant="contained"
                color="primary"
                onClick={() => run(replayCognitivePlan, "Replay completo")}
              >
                Replay completo
              </Button>
            </Box>
          </AgentOsIf>
        )}

        {tab === 6 && (
          <AgentOsIf when={canManage}>
            <Box>
              <Button
                variant="contained"
                color="primary"
                onClick={() => run(evaluateCognitivePlan, "Plan Evaluation")}
              >
                Avaliar plano (V2.1)
              </Button>
            </Box>
          </AgentOsIf>
        )}

        {result && (
          <Paper className={classes.paper} variant="outlined" style={{ marginTop: 16 }}>
            <Typography variant="subtitle2" gutterBottom>
              Resultado
            </Typography>
            <pre className={classes.mono}>{JSON.stringify(result, null, 2)}</pre>
          </Paper>
        )}
      </Paper>
    </MainContainer>
  );
}
