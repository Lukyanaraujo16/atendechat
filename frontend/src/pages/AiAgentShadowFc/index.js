import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  FormControlLabel,
  Grid,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import {
  getAiAgentShadowEvaluation,
  getAiAgentShadowFcDashboard,
  updateShadowFcAgentSetting,
  updateShadowFcCompanySetting,
  updateShadowFcConnectionSetting,
} from "../../services/aiAgentApi";
import { getEvidenceByShadowEvaluation } from "../../services/automationEvidenceApi";

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  mono: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  card: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    height: "100%",
  },
}));

function MetricCard({ label, value, classes }) {
  return (
    <Box className={classes.card}>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="h6">{value ?? "—"}</Typography>
    </Box>
  );
}

export default function AiAgentShadowFcDashboardPage() {
  const classes = useStyles();
  const [dashboard, setDashboard] = useState(null);
  const [detail, setDetail] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAiAgentShadowFcDashboard();
      setDashboard(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCompany = async (enabled) => {
    setSaving(true);
    try {
      await updateShadowFcCompanySetting({ enabled });
      toast.success("Configuração da empresa salva.");
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleAgent = async (agentId, enabled) => {
    setSaving(true);
    try {
      await updateShadowFcAgentSetting(agentId, { enabled });
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleConnection = async (whatsappId, enabled) => {
    setSaving(true);
    try {
      await updateShadowFcConnectionSetting(whatsappId, { enabled });
      await load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id) => {
    try {
      const { data } = await getAiAgentShadowEvaluation(id);
      setDetail(data?.evaluation || null);
      try {
        const ev = await getEvidenceByShadowEvaluation(id);
        setEvidence(ev.data?.report || null);
      } catch {
        setEvidence(null);
      }
    } catch (err) {
      toastError(err);
    }
  };

  const m = dashboard?.metrics || {};
  const cfg = dashboard?.config || {};

  return (
    <MainContainer>
      <MainHeader>
        <Title>Function Calling Shadow</Title>
      </MainHeader>

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary" paragraph>
          Avaliações observacionais. Nenhuma mensagem enviada. Nenhuma Write
          Tool. Rollout: empresa ∧ conexão ∧ agente (OFF por padrão).
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={cfg.companyEnabled === true}
              onChange={(e) => toggleCompany(e.target.checked)}
              disabled={saving || loading}
              color="primary"
            />
          }
          label="Empresa — Function Calling Shadow"
        />
        <Typography variant="caption" display="block" gutterBottom>
          Agentes ON: {cfg.agentsEnabled ?? 0} · Conexões ON:{" "}
          {cfg.connectionsEnabled ?? 0}
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Agentes
            </Typography>
            {(cfg.agents || []).map((a) => (
              <FormControlLabel
                key={a.id}
                control={
                  <Switch
                    checked={a.functionCallingShadow === true}
                    onChange={(e) => toggleAgent(a.id, e.target.checked)}
                    disabled={saving}
                    color="primary"
                    size="small"
                  />
                }
                label={`${a.name} (#${a.id})`}
              />
            ))}
            {!(cfg.agents || []).length && (
              <Typography variant="caption">Nenhum agente.</Typography>
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Conexões
            </Typography>
            {(cfg.connections || []).map((c) => (
              <FormControlLabel
                key={c.id}
                control={
                  <Switch
                    checked={c.functionCallingShadow === true}
                    onChange={(e) => toggleConnection(c.id, e.target.checked)}
                    disabled={saving}
                    color="primary"
                    size="small"
                  />
                }
                label={`${c.name} (#${c.id})`}
              />
            ))}
            {!(cfg.connections || []).length && (
              <Typography variant="caption">Nenhuma conexão.</Typography>
            )}
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2}>
        {[
          ["Execuções", m.shadowExecutions],
          ["Com Tools", m.shadowWithTools],
          ["Sem Tools", m.shadowWithoutTools],
          ["Tool usage %", Math.round((m.toolUsageRate || 0) * 100)],
          ["Knowledge %", Math.round((m.knowledgeUsageRate || 0) * 100)],
          ["Latência média", m.averageLatencyMs],
          ["Tokens médios", m.averageTokens],
          ["Custo médio USD", m.averageCostUsd],
          ["Loop stops", m.loopStops],
          ["Negações %", Math.round((m.toolDeniedRate || 0) * 100)],
        ].map(([label, value]) => (
          <Grid item xs={6} md={3} key={label}>
            <MetricCard label={label} value={value} classes={classes} />
          </Grid>
        ))}
      </Grid>

      <Paper className={classes.paper} variant="outlined" style={{ marginTop: 16 }}>
        <Typography variant="subtitle2" gutterBottom>
          Top Tools / Failures / Denials / Nunca usadas / Providers
        </Typography>
        <pre className={classes.mono}>
          {JSON.stringify(
            {
              topTools: m.topTools,
              topFailures: m.topFailures,
              topDenials: m.topDenials,
              neverUsed: m.neverUsedTools,
              byProvider: m.byProvider,
            },
            null,
            2
          )}
        </pre>
      </Paper>

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="subtitle2" gutterBottom>
          Avaliações recentes — Replay Shadow Function Calling
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Tools</TableCell>
              <TableCell>Latência</TableCell>
              <TableCell>Tokens</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(dashboard?.recent || []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>
                  {row.provider}/{row.model}
                </TableCell>
                <TableCell>
                  {row.usedTools ? row.toolCallCount : 0}
                </TableCell>
                <TableCell>
                  {row.latencyMs != null ? `${row.latencyMs}ms` : "—"}
                </TableCell>
                <TableCell>{row.totalTokens ?? "—"}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => openDetail(row.id)}>
                    Replay
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!(dashboard?.recent || []).length && (
              <TableRow>
                <TableCell colSpan={7}>Nenhuma avaliação ainda.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {detail && (
        <Paper className={classes.paper} variant="outlined">
          <Typography variant="subtitle2" gutterBottom>
            Replay Shadow FC #{detail.id}
          </Typography>
          <Button size="small" onClick={() => { setDetail(null); setEvidence(null); }}>
            Fechar
          </Button>
          <pre className={classes.mono}>
            {JSON.stringify(
              {
                prompt: detail.systemPrompt,
                selection: detail.trace?.selectedTools,
                allowlist: detail.trace?.allowlist,
                toolCalls: (detail.trace?.iterations || []).flatMap((it) =>
                  (it.toolCalls || []).map((c) => ({
                    loop: it.index,
                    ...c,
                  }))
                ),
                resolutions: (detail.trace?.iterations || []).flatMap(
                  (it) => it.resolutions || []
                ),
                shadowReply: detail.shadowReply,
                officialReply: detail.officialReply,
                comparison: detail.comparison,
                evidence: evidence
                  ? {
                      primaryType: evidence.primaryType,
                      verified: evidence.verified,
                      hallucination: evidence.hallucination,
                      findings: evidence.report?.findings,
                      justification: evidence.report?.findings?.[0]?.justification,
                    }
                  : null,
                toolAnalytics: detail.toolAnalytics,
                knowledge: detail.knowledgeMeta,
                tokens: {
                  prompt: detail.promptTokens,
                  completion: detail.completionTokens,
                  total: detail.totalTokens,
                  cost: detail.estimatedCostUsd,
                },
                latency: {
                  total: detail.latencyMs,
                  provider: detail.providerLatencyMs,
                  tools: detail.toolLatencyMs,
                },
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
