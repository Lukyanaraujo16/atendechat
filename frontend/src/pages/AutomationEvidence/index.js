import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
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
import toastError from "../../errors/toastError";
import { toastAgentOsActionError } from "../../utils/agentOsActionError";
import { toast } from "react-toastify";
import {
  getEvidenceByShadowEvaluation,
  getEvidenceDashboard,
  getEvidenceReport,
  getEvidenceThresholds,
  updateEvidenceThresholds,
} from "../../services/automationEvidenceApi";

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

export default function AutomationEvidencePage() {
  const classes = useStyles();
  const { canManage, readOnlyManage } = useAgentOsConsolePermissions();
  const [dash, setDash] = useState(null);
  const [detail, setDetail] = useState(null);
  const [thresholdsJson, setThresholdsJson] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, thr] = await Promise.all([
        getEvidenceDashboard(),
        getEvidenceThresholds(),
      ]);
      setDash(data);
      setThresholdsJson(JSON.stringify(thr.data?.thresholds || {}, null, 2));
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveThresholds = async () => {
    try {
      const parsed = JSON.parse(thresholdsJson);
      await updateEvidenceThresholds(parsed);
      toast.success("Thresholds salvos (Live permanece OFF).");
      await load();
    } catch (err) {
      toastAgentOsActionError(err);
    }
  };

  const openReport = async (id) => {
    try {
      const { data } = await getEvidenceReport(id);
      setDetail(data?.report || null);
    } catch (err) {
      toastError(err);
    }
  };

  const openByShadow = async (shadowEvaluationId) => {
    try {
      const { data } = await getEvidenceByShadowEvaluation(shadowEvaluationId);
      setDetail(data?.report || null);
    } catch (err) {
      toastError(err);
    }
  };

  const r = dash?.rates || {};
  const readiness = dash?.readiness || {};

  return (
    <MainContainer>
      <MainHeader>
        <Title>Evidence Dashboard</Title>
      </MainHeader>

      <AgentOsReadOnlyBanner visible={readOnlyManage} />

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Fatos observáveis do Shadow FC. Sem CoT, sem IA-judge. Live Function
          Calling desabilitado. Write Tools bloqueadas.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {[
          ["Verification %", Math.round((r.verificationRate || 0) * 100)],
          ["Hallucination %", Math.round((r.hallucinationRate || 0) * 100)],
          ["Knowledge %", Math.round((r.knowledgeUtilizationRate || 0) * 100)],
          ["Tool usage %", Math.round((r.toolUtilizationRate || 0) * 100)],
          ["Readiness", readiness.level],
          ["Score", readiness.score],
          ["Samples", r.sampleCount],
          ["Latência média", r.averageLatency],
        ].map(([label, value]) => (
          <Grid item xs={6} md={3} key={label}>
            <Metric label={label} value={value} classes={classes} />
          </Grid>
        ))}
      </Grid>

      <Paper className={classes.paper} variant="outlined" style={{ marginTop: 16 }}>
        <Typography variant="subtitle2" gutterBottom>
          Providers / Top Problems / Recommendations
        </Typography>
        <pre className={classes.mono}>
          {JSON.stringify(
            {
              providers: dash?.providers,
              topProblems: dash?.topProblems,
              recommendations: dash?.recommendations,
              typeCounts: dash?.typeCounts,
            },
            null,
            2
          )}
        </pre>
      </Paper>

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="subtitle2" gutterBottom>
          Thresholds (configuráveis)
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={10}
          variant="outlined"
          value={thresholdsJson}
          onChange={(e) => setThresholdsJson(e.target.value)}
          disabled={loading || !canManage}
        />
        <Box mt={1}>
          <AgentOsIf when={canManage}>
            <Button
              variant="contained"
              color="primary"
              onClick={saveThresholds}
              disabled={loading}
            >
              Salvar thresholds
            </Button>
          </AgentOsIf>
        </Box>
      </Paper>

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="subtitle2" gutterBottom>
          Reports recentes (Replay Evidence)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Shadow Eval</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(dash?.recent || []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.primaryType}</TableCell>
                <TableCell>{row.provider}</TableCell>
                <TableCell>{row.shadowEvaluationId}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => openReport(row.id)}>
                    Evidence
                  </Button>
                  <Button
                    size="small"
                    onClick={() => openByShadow(row.shadowEvaluationId)}
                  >
                    Via Shadow
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!(dash?.recent || []).length && (
              <TableRow>
                <TableCell colSpan={5}>
                  Nenhuma evidência foi registrada para o contexto atual.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {detail && (
        <Paper className={classes.paper} variant="outlined">
          <Typography variant="subtitle2" gutterBottom>
            Replay Evidence #{detail.id}
          </Typography>
          <Button size="small" onClick={() => setDetail(null)}>
            Fechar
          </Button>
          <pre className={classes.mono}>
            {JSON.stringify(
              {
                primaryType: detail.primaryType,
                verified: detail.verified,
                hallucination: detail.hallucination,
                report: detail.report,
              },
              null,
              2
            )}
          </pre>
        </Paper>
      )}
    </MainContainer>
  );
}
