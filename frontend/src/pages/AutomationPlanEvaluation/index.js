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
import toastError from "../../errors/toastError";
import {
  diffCognitivePlans,
  evaluateCognitivePlan,
  getPlanEvaluationConfig,
  getPlanEvaluationDashboard,
  listPlanEvaluations,
  updatePlanEvaluationConfig,
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

export default function AutomationPlanEvaluationPage() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [dash, setDash] = useState(null);
  const [text, setText] = useState("Quero transferir para um atendente humano");
  const [nextText, setNextText] = useState("Como funciona o produto?");
  const [result, setResult] = useState(null);
  const [configJson, setConfigJson] = useState("");

  const load = useCallback(async () => {
    try {
      const [{ data }, cfg] = await Promise.all([
        getPlanEvaluationDashboard(),
        getPlanEvaluationConfig(),
      ]);
      setDash(data);
      setConfigJson(JSON.stringify(cfg.data?.config || {}, null, 2));
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const m = dash?.metrics || {};

  return (
    <MainContainer>
      <MainHeader>
        <Title>Plan Evaluation (V2.1)</Title>
      </MainHeader>

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Avalia qualidade do Execution Plan antes de qualquer Executor. Não
          executa Tools. Live/Shadow/Planner de geração permanecem isolados.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {[
          ["Evaluated", m.plansEvaluated],
          ["Approval %", Math.round((m.approvalRate || 0) * 100)],
          ["Rejection %", Math.round((m.rejectionRate || 0) * 100)],
          ["Avg quality", m.averageQuality],
          ["Avg complexity", m.averageComplexity],
          ["Avg risk", m.averageRisk],
          ["Avg cost", m.averageCost],
          ["Avg latency", m.averageLatency],
          ["Warning rate", m.warningRate],
          ["Critical rate", m.criticalRate],
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
          <Tab label="Plan Inspector" />
          <Tab label="Validator Runner" />
          <Tab label="Score / Approval" />
          <Tab label="Recommendations" />
          <Tab label="Diff" />
          <Tab label="Config" />
        </Tabs>

        <Box style={{ marginTop: 16 }}>
          {(tab === 1 || tab === 2 || tab === 3 || tab === 4) && (
            <TextField
              label="Mensagem / Goal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              fullWidth
              multiline
              rows={2}
              variant="outlined"
              size="small"
              style={{ marginBottom: 12 }}
            />
          )}

          {tab === 0 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                {
                  guarantees: dash?.guarantees,
                  topValidators: dash?.topValidators,
                  topProblems: dash?.topProblems,
                  recommendations: dash?.recommendations,
                  recent: dash?.recentEvaluations?.slice(0, 5),
                },
                null,
                2
              )}
            </pre>
          )}

          {tab === 1 && (
            <Button
              variant="contained"
              color="primary"
              onClick={async () => {
                try {
                  const { data } = await evaluateCognitivePlan({ text });
                  setResult(data);
                  toast.success("Plano inspecionado/avaliado");
                  await load();
                } catch (err) {
                  toastError(err);
                }
              }}
            >
              Inspecionar / Avaliar
            </Button>
          )}

          {tab === 2 && (
            <Button
              variant="contained"
              color="primary"
              onClick={async () => {
                try {
                  const { data } = await evaluateCognitivePlan({ text });
                  setResult({
                    validationSummary: data.evaluation?.validationSummary,
                    validatorResults: data.evaluation?.validatorResults,
                  });
                  toast.success("Validators executados");
                  await load();
                } catch (err) {
                  toastError(err);
                }
              }}
            >
              Rodar Validators
            </Button>
          )}

          {tab === 3 && (
            <Button
              variant="contained"
              color="primary"
              onClick={async () => {
                try {
                  const { data } = await evaluateCognitivePlan({ text });
                  setResult({
                    approval: data.evaluation?.approval,
                    score: data.evaluation?.score,
                    scoreBreakdown: data.evaluation?.scoreBreakdown,
                    quality: data.evaluation?.quality,
                    risk: data.evaluation?.risk,
                  });
                  toast.success("Score/Approval simulados");
                  await load();
                } catch (err) {
                  toastError(err);
                }
              }}
            >
              Simular Score / Approval
            </Button>
          )}

          {tab === 4 && (
            <Button
              variant="contained"
              color="primary"
              onClick={async () => {
                try {
                  const { data } = await evaluateCognitivePlan({ text });
                  setResult({
                    recommendations: data.evaluation?.recommendations,
                    issues: data.evaluation?.issues,
                    warnings: data.evaluation?.warnings,
                  });
                  toast.success("Recommendations geradas");
                  await load();
                } catch (err) {
                  toastError(err);
                }
              }}
            >
              Ver Recommendations
            </Button>
          )}

          {tab === 5 && (
            <Box>
              <TextField
                label="Plano anterior (texto)"
                value={text}
                onChange={(e) => setText(e.target.value)}
                fullWidth
                size="small"
                variant="outlined"
                style={{ marginBottom: 8 }}
              />
              <TextField
                label="Plano novo (texto)"
                value={nextText}
                onChange={(e) => setNextText(e.target.value)}
                fullWidth
                size="small"
                variant="outlined"
                style={{ marginBottom: 8 }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={async () => {
                  try {
                    const { data } = await diffCognitivePlans({
                      previousText: text,
                      nextText,
                    });
                    setResult(data);
                    toast.success("Plan Diff gerado");
                    await load();
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Comparar planos
              </Button>
            </Box>
          )}

          {tab === 6 && (
            <Box>
              <TextField
                label="Config JSON (weights / thresholds)"
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                fullWidth
                multiline
                rows={12}
                variant="outlined"
                className={classes.mono}
              />
              <Button
                style={{ marginTop: 8 }}
                variant="contained"
                color="primary"
                onClick={async () => {
                  try {
                    const parsed = JSON.parse(configJson);
                    await updatePlanEvaluationConfig(parsed);
                    toast.success("Config salva (sem hardcode no engine)");
                    await load();
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Salvar config
              </Button>
              <Button
                style={{ marginTop: 8, marginLeft: 8 }}
                variant="outlined"
                onClick={async () => {
                  try {
                    const { data } = await listPlanEvaluations({ limit: 10 });
                    setResult(data);
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Listar evaluations
              </Button>
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
