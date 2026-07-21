import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Tab,
  Tabs,
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
import TableRowSkeleton from "../../components/TableRowSkeleton";
import { AppEmptyState } from "../../ui";
import toastError from "../../errors/toastError";
import {
  getAutomationExecutionReplay,
  getAutomationOrchestratorDashboard,
  getAutomationOrchestratorSettings,
  listAutomationActions,
  listAutomationExecutions,
  listAutomationPlannerValidations,
  simulateAutomationPlan,
  updateAutomationOrchestratorSettings,
} from "../../services/automationOrchestratorApi";
import {
  getAutomationToolMetrics,
  getAutomationToolsCatalog,
} from "../../services/automationToolsApi";
import { getAiAgentShadowFcDashboard } from "../../services/aiAgentApi";
import { getEvidenceDashboard } from "../../services/automationEvidenceApi";

const CAPABILITY_KEYS = [
  "planner",
  "classification",
  "knowledge",
  "ai_generation",
  "chatbot",
  "flows",
  "handoff",
  "send_message",
  "integrations",
  "wait",
];

const CONTROL_MODES = [
  "disabled",
  "observe",
  "shadow_execute",
  "active_partial",
  "active",
];

const CAP_MODES = ["legacy", "observe", "shadow", "active"];

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  card: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    height: "100%",
  },
  filters: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
  },
  timelineItem: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "flex-start",
    marginBottom: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  mono: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  warn: {
    color: theme.palette.warning.dark,
    marginBottom: theme.spacing(1),
  },
}));

function MetricCard({ label, value }) {
  const classes = useStyles();
  return (
    <Paper className={classes.card} elevation={0}>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="h5">{value ?? "—"}</Typography>
    </Paper>
  );
}

const AutomationMonitorPage = () => {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [validations, setValidations] = useState([]);
  const [replay, setReplay] = useState(null);
  const [settings, setSettings] = useState(null);
  const [controlMode, setControlMode] = useState("observe");
  const [capabilities, setCapabilities] = useState({});
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionCatalog, setActionCatalog] = useState(null);
  const [toolCatalog, setToolCatalog] = useState(null);
  const [toolMetrics, setToolMetrics] = useState(null);
  const [shadowFc, setShadowFc] = useState(null);
  const [evidenceDash, setEvidenceDash] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAutomationOrchestratorDashboard();
      setDashboard(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExecutions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listAutomationExecutions({
        status: status || undefined,
        pageNumber: 1,
      });
      setExecutions(data?.records || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  const loadValidations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listAutomationPlannerValidations({
        pageNumber: 1,
      });
      setValidations(data?.records || data?.rows || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAutomationOrchestratorSettings();
      const s = data?.settings || data;
      setSettings(s);
      setControlMode(s?.controlMode || "observe");
      setCapabilities(s?.capabilities || {});
      setEnabled(s?.enabled !== false);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActionsCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listAutomationActions();
      setActionCatalog(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadToolsTab = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogRes, metricsRes] = await Promise.all([
        getAutomationToolsCatalog().catch(() => ({ data: null })),
        getAutomationToolMetrics().catch(() => ({ data: null })),
      ]);
      setToolCatalog(catalogRes.data);
      setToolMetrics(metricsRes.data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadShadowFcTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAiAgentShadowFcDashboard();
      setShadowFc(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvidenceTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getEvidenceDashboard();
      setEvidenceDash(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 0) loadDashboard();
    if (tab === 1) loadExecutions();
    if (tab === 2) loadValidations();
    if (tab === 3) loadActionsCatalog();
    if (tab === 4) loadToolsTab();
    if (tab === 5) loadShadowFcTab();
    if (tab === 6) loadEvidenceTab();
    if (tab === 7) loadSettings();
  }, [
    tab,
    loadDashboard,
    loadExecutions,
    loadValidations,
    loadActionsCatalog,
    loadToolsTab,
    loadShadowFcTab,
    loadEvidenceTab,
    loadSettings,
  ]);

  const openReplay = async (id) => {
    try {
      const { data } = await getAutomationExecutionReplay(id);
      setReplay(data?.replay || null);
    } catch (err) {
      toastError(err);
    }
  };

  const runSimulate = async () => {
    try {
      const { data } = await simulateAutomationPlan({
        body: "Olá, preciso de ajuda",
        runtimeMode: "live",
        aiAgentId: 1,
      });
      toast.success(`Execução #${data?.execution?.id || "?"} criada`);
      setTab(1);
      loadExecutions();
    } catch (err) {
      toastError(err);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data } = await updateAutomationOrchestratorSettings({
        controlMode,
        capabilities,
        enabled,
      });
      setSettings(data?.settings || data);
      toast.success("Configuração salva (sem deploy)");
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const act = dashboard?.activation || {};

  return (
    <MainContainer>
      <MainHeader>
        <Title>Automation Monitor</Title>
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined">
        <Typography variant="body2" color="textSecondary" paragraph>
          Action Runtime (2.0.2). Ownership padrão = legado. Observe e
          shadow_execute nunca enviam mensagem. Active exige capabilities
          consistentes e circuit breaker fechado.
        </Typography>

        <div className={classes.filters}>
          <Button variant="outlined" color="primary" onClick={runSimulate}>
            Simular plano
          </Button>
        </div>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
        >
          <Tab label="Dashboard" />
          <Tab label="Execuções" />
          <Tab label="Planner Accuracy" />
          <Tab label="Actions" />
          <Tab label="Tools" />
          <Tab label="Shadow FC" />
          <Tab label="Evidence" />
          <Tab label="Configuração" />
        </Tabs>

        <Box mt={2}>
          {tab === 0 &&
            (loading ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <MetricCard label="Execuções" value={dashboard?.total} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <MetricCard
                    label="Planner matches"
                    value={act.plannerMatches ?? dashboard?.plannerMatches}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <MetricCard
                    label="Divergências"
                    value={
                      act.plannerDivergences ?? dashboard?.plannerDivergences
                    }
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <MetricCard
                    label="Críticas"
                    value={
                      act.criticalDivergences ?? dashboard?.criticalDivergences
                    }
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <MetricCard
                    label="Shadow"
                    value={act.shadowExecutions ?? dashboard?.shadowExecutions}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <MetricCard
                    label="Fallbacks"
                    value={
                      act.fallbackExecutions ?? dashboard?.fallbackExecutions
                    }
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <MetricCard
                    label="Circuit trips"
                    value={
                      act.circuitBreakerTrips ?? dashboard?.circuitBreakerTrips
                    }
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <MetricCard
                    label="Ownership orch"
                    value={
                      act.ownershipTransfers ?? dashboard?.ownershipTransfers
                    }
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <MetricCard
                    label="Actions instaladas"
                    value={dashboard?.actionCatalog?.installed}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <MetricCard
                    label="Capabilities"
                    value={dashboard?.actionCatalog?.capabilities}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Por intent
                  </Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(dashboard?.byIntent || {}, null, 2)}
                  </pre>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Uso por Action
                  </Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(dashboard?.actionUsage || {}, null, 2)}
                  </pre>
                </Grid>
              </Grid>
            ))}

          {tab === 1 && (
            <>
              <div className={classes.filters}>
                <FormControl
                  variant="outlined"
                  size="small"
                  style={{ minWidth: 160 }}
                >
                  <InputLabel>Status</InputLabel>
                  <Select
                    label="Status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="completed">completed</MenuItem>
                    <MenuItem value="waiting">waiting</MenuItem>
                    <MenuItem value="failed">failed</MenuItem>
                    <MenuItem value="handoff">handoff</MenuItem>
                  </Select>
                </FormControl>
                <Button variant="outlined" onClick={loadExecutions}>
                  Atualizar
                </Button>
              </div>
              {loading ? (
                <TableRowSkeleton columns={7} />
              ) : executions.length === 0 ? (
                <AppEmptyState title="Nenhuma execução" />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Ownership</TableCell>
                      <TableCell>Mode</TableCell>
                      <TableCell>Intent</TableCell>
                      <TableCell>Fallback</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {executions.map((ex) => (
                      <TableRow key={ex.id}>
                        <TableCell>{ex.id}</TableCell>
                        <TableCell>
                          <Chip size="small" label={ex.status} />
                        </TableCell>
                        <TableCell>{ex.ownership || "legacy"}</TableCell>
                        <TableCell>{ex.controlMode}</TableCell>
                        <TableCell>{ex.intent || "—"}</TableCell>
                        <TableCell>
                          {ex.fallbackToLegacy ? "sim" : "não"}
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => openReplay(ex.id)}>
                            Replay
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}

          {tab === 2 &&
            (loading ? (
              <TableRowSkeleton columns={5} />
            ) : validations.length === 0 ? (
              <AppEmptyState title="Nenhuma validação planner×legado" />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Planned</TableCell>
                    <TableCell>Legacy</TableCell>
                    <TableCell>Match</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {validations.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{v.id}</TableCell>
                      <TableCell>{v.plannedIntent}</TableCell>
                      <TableCell>
                        {v.legacyIntent} / {v.legacyHandler}
                      </TableCell>
                      <TableCell>{v.matched ? "yes" : "no"}</TableCell>
                      <TableCell>
                        <Chip size="small" label={v.divergenceSeverity} />
                      </TableCell>
                      <TableCell>{v.divergenceReason || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}

          {tab === 3 &&
            (loading && !actionCatalog ? (
              <TableRowSkeleton columns={6} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Runtime {actionCatalog?.runtimeVersion || "—"} ·{" "}
                  {(actionCatalog?.actions || []).length} actions ·{" "}
                  {(actionCatalog?.capabilities || []).length} capabilities
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Action</TableCell>
                      <TableCell>Versão</TableCell>
                      <TableCell>Categoria</TableCell>
                      <TableCell>Capabilities</TableCell>
                      <TableCell>Timeout</TableCell>
                      <TableCell>Flags</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(actionCatalog?.actions || []).map((a) => (
                      <TableRow key={a.id || a.name}>
                        <TableCell>
                          <strong>{a.name}</strong>
                          <Typography variant="caption" display="block">
                            {a.description}
                          </Typography>
                        </TableCell>
                        <TableCell>{a.version}</TableCell>
                        <TableCell>{a.category}</TableCell>
                        <TableCell>
                          {(a.capabilities || []).join(", ")}
                        </TableCell>
                        <TableCell>{a.timeoutMs}ms</TableCell>
                        <TableCell>
                          {a.sideEffects ? "sideEffects " : ""}
                          {a.experimental ? "experimental " : ""}
                          {a.deprecated ? "deprecated" : ""}
                          {!a.sideEffects &&
                          !a.experimental &&
                          !a.deprecated
                            ? "—"
                            : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Capabilities (incl. future)
                  </Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      (actionCatalog?.capabilities || []).map((c) => ({
                        id: c.id,
                        future: c.future,
                        experimental: c.experimental,
                      })),
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 4 &&
            (loading && !toolCatalog ? (
              <TableRowSkeleton columns={6} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Tools 2.1D — Read Tools + Function Calling (Simulador). Write
                  Tools não expostas ao modelo.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Execuções Tool"
                      value={toolMetrics?.metrics?.toolExecutions}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Empty results"
                      value={toolMetrics?.metrics?.emptyResults}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="FC tool calls"
                      value={toolMetrics?.functionCalling?.toolCalls}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="FC denials / invalid"
                      value={
                        (toolMetrics?.functionCalling?.toolDenials || 0) +
                        (toolMetrics?.functionCalling?.invalidCalls || 0)
                      }
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="FC loops stopped"
                      value={toolMetrics?.functionCalling?.loopStops}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="FC avg tool latency"
                      value={toolMetrics?.functionCalling?.averageToolLatencyMs}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Cache hits"
                      value={toolMetrics?.metrics?.cacheHits}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Duração média"
                      value={toolMetrics?.metrics?.averageToolDuration}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    FC — Top Tools / nunca usadas
                  </Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        topTools: toolMetrics?.functionCalling?.topTools || [],
                        neverUsed:
                          toolMetrics?.functionCalling?.neverUsedTools || [],
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Mais utilizadas
                  </Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      toolMetrics?.metrics?.topToolsByUsage || [],
                      null,
                      2
                    )}
                  </pre>
                  <Typography variant="subtitle2" gutterBottom>
                    Latência média por Tool
                  </Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      toolMetrics?.metrics?.averageLatencyByTool || {},
                      null,
                      2
                    )}
                  </pre>
                </Box>
                <Box mt={2}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Versão</TableCell>
                        <TableCell>Risco</TableCell>
                        <TableCell>Side effect</TableCell>
                        <TableCell>Capabilities</TableCell>
                        <TableCell>Circuit</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(toolCatalog?.tools || []).map((t) => {
                        const circ = (toolMetrics?.catalog || []).find(
                          (c) => c.id === t.id
                        )?.circuit;
                        return (
                          <TableRow key={`${t.id}@${t.version}`}>
                            <TableCell>{t.id}</TableCell>
                            <TableCell>{t.version}</TableCell>
                            <TableCell>{t.riskLevel}</TableCell>
                            <TableCell>{t.sideEffectType}</TableCell>
                            <TableCell>
                              {(t.capabilities || []).join(", ")}
                            </TableCell>
                            <TableCell>
                              {circ?.open ? "open" : "ok"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!(toolCatalog?.tools || []).length && (
                        <TableRow>
                          <TableCell colSpan={6}>
                            Feature automation.ai_tools desabilitada ou sem
                            Tools.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Box>
              </>
            ))}

          {tab === 5 &&
            (loading && !shadowFc ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Function Calling Shadow (2.1E) — observacional. Sem envio de
                  mensagem, sem Write Tools, sem Operation Runtime.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Execuções Shadow FC"
                      value={shadowFc?.metrics?.shadowExecutions}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Tool usage %"
                      value={Math.round(
                        (shadowFc?.metrics?.toolUsageRate || 0) * 100
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Knowledge %"
                      value={Math.round(
                        (shadowFc?.metrics?.knowledgeUsageRate || 0) * 100
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Latência média"
                      value={shadowFc?.metrics?.averageLatencyMs}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Tokens médios"
                      value={shadowFc?.metrics?.averageTokens}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Custo médio USD"
                      value={shadowFc?.metrics?.averageCostUsd}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Loop stops"
                      value={shadowFc?.metrics?.loopStops}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Denial rate %"
                      value={Math.round(
                        (shadowFc?.metrics?.toolDeniedRate || 0) * 100
                      )}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Top Tools / Failures / Denials / Providers
                  </Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        topTools: shadowFc?.metrics?.topTools,
                        topFailures: shadowFc?.metrics?.topFailures,
                        topDenials: shadowFc?.metrics?.topDenials,
                        neverUsed: shadowFc?.metrics?.neverUsedTools,
                        byProvider: shadowFc?.metrics?.byProvider,
                        config: shadowFc?.config,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 6 &&
            (loading && !evidenceDash ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Evidence Engine (2.1F) — fatos observáveis. Live FC OFF.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Verification %"
                      value={Math.round(
                        (evidenceDash?.rates?.verificationRate || 0) * 100
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Hallucination %"
                      value={Math.round(
                        (evidenceDash?.rates?.hallucinationRate || 0) * 100
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Readiness"
                      value={evidenceDash?.readiness?.level}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Score"
                      value={evidenceDash?.readiness?.score}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        typeCounts: evidenceDash?.typeCounts,
                        recommendations: evidenceDash?.recommendations,
                        providers: evidenceDash?.providers,
                        thresholds: evidenceDash?.thresholds,
                        topProblems: evidenceDash?.topProblems,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 7 && (
            <>
              <Typography className={classes.warn} variant="body2">
                send_message=active exige planner ativo. Config inconsistente é
                bloqueada no backend. Legado continua como fallback padrão.
              </Typography>
              {loading && !settings ? (
                <TableRowSkeleton columns={3} />
              ) : (
                <>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Settings enabled"
                  />
                  <div className={classes.filters}>
                    <FormControl
                      variant="outlined"
                      size="small"
                      style={{ minWidth: 200 }}
                    >
                      <InputLabel>Control Mode</InputLabel>
                      <Select
                        label="Control Mode"
                        value={controlMode}
                        onChange={(e) => setControlMode(e.target.value)}
                      >
                        {CONTROL_MODES.map((m) => (
                          <MenuItem key={m} value={m}>
                            {m}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </div>
                  <Typography variant="subtitle2" gutterBottom>
                    Capabilities
                  </Typography>
                  <Grid container spacing={1}>
                    {CAPABILITY_KEYS.map((key) => (
                      <Grid item xs={12} sm={6} md={4} key={key}>
                        <FormControl
                          variant="outlined"
                          size="small"
                          fullWidth
                        >
                          <InputLabel>{key}</InputLabel>
                          <Select
                            label={key}
                            value={capabilities[key] || "legacy"}
                            onChange={(e) =>
                              setCapabilities((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                          >
                            {CAP_MODES.map((m) => (
                              <MenuItem key={m} value={m}>
                                {m}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    ))}
                  </Grid>
                  <Box mt={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={saving}
                      onClick={saveSettings}
                    >
                      Salvar configuração
                    </Button>
                  </Box>
                  {settings?.circuitBreakerOpenUntil && (
                    <Typography variant="caption" color="error" display="block">
                      Circuit breaker aberto até{" "}
                      {new Date(
                        settings.circuitBreakerOpenUntil
                      ).toLocaleString()}
                    </Typography>
                  )}
                </>
              )}
            </>
          )}
        </Box>
      </Paper>

      <Dialog
        open={Boolean(replay)}
        onClose={() => setReplay(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Replay #{replay?.id} — {replay?.controlMode} / {replay?.ownership}
        </DialogTitle>
        <DialogContent>
          {replay && (
            <>
              <Typography variant="body2" gutterBottom>
                Fallback legado: {replay.fallbackToLegacy ? "sim" : "não"} ·
                Circuit: {replay.circuitBreakerTripped ? "trip" : "ok"}
              </Typography>
              {replay.plannerValidation && (
                <pre className={classes.mono}>
                  {JSON.stringify(
                    {
                      planned: replay.plannerValidation.plannedIntent,
                      legacy: replay.plannerValidation.legacyIntent,
                      matched: replay.plannerValidation.matched,
                      severity: replay.plannerValidation.divergenceSeverity,
                      reason: replay.plannerValidation.divergenceReason,
                    },
                    null,
                    2
                  )}
                </pre>
              )}
              <Typography variant="subtitle2" gutterBottom>
                Timeline
              </Typography>
              {(replay.timeline || []).map((item, idx) => (
                <div key={idx} className={classes.timelineItem}>
                  <Chip size="small" label={item.result || "—"} />
                  <Box>
                    <Typography variant="body2">
                      <strong>{item.action}</strong>
                      {item.durationMs != null ? ` · ${item.durationMs}ms` : ""}
                    </Typography>
                    {(item.manifest || item.runtime) && (
                      <Typography variant="caption" color="textSecondary">
                        v{item.manifest?.version || item.runtime?.actionVersion || "—"}
                        {item.manifest?.category
                          ? ` · ${item.manifest.category}`
                          : ""}
                        {item.runtime?.timeoutMs != null
                          ? ` · timeout ${item.runtime.timeoutMs}ms`
                          : ""}
                        {item.manifest?.capabilities
                          ? ` · caps [${(item.manifest.capabilities || []).join(
                              ", "
                            )}]`
                          : ""}
                      </Typography>
                    )}
                    {(item.tools || []).length > 0 && (
                      <Typography variant="caption" display="block">
                        Tools:{" "}
                        {(item.tools || [])
                          .map(
                            (t) =>
                              `${t.toolId}@${t.toolVersion} (${t.status}/${t.riskLevel})`
                          )
                          .join("; ")}
                      </Typography>
                    )}
                  </Box>
                </div>
              ))}
              {(replay.tools || []).length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Tools invocadas (interno → modelo)
                  </Typography>
                  {(replay.tools || []).map((t, i) => (
                    <Box key={i} mb={1}>
                      <Typography variant="caption" display="block">
                        {t.toolId}@{t.toolVersion} · {t.status} · risco{" "}
                        {t.riskLevel} · {t.durationMs ?? "—"}ms · source{" "}
                        {t.source || "—"}
                      </Typography>
                      {t.outputSnapshot && (
                        <pre className={classes.mono}>
                          {JSON.stringify(
                            {
                              operationStatus:
                                t.outputSnapshot?.data?.operationStatus || null,
                              preview: t.outputSnapshot?.data?.preview || null,
                              before: t.outputSnapshot?.data?.before || null,
                              after: t.outputSnapshot?.data?.after || null,
                              changedFields:
                                t.outputSnapshot?.data?.changedFields || null,
                              dryRun: t.outputSnapshot?.data?.dryRun ?? null,
                              transaction:
                                t.outputSnapshot?.data?.transaction || null,
                              rollback: t.outputSnapshot?.data?.rollback || null,
                              model:
                                t.outputSnapshot?.modelResult ||
                                t.outputSnapshot?.data?.modelResult ||
                                null,
                              diff: t.outputSnapshot?.resultDiff || null,
                            },
                            null,
                            2
                          )}
                        </pre>
                      )}
                    </Box>
                  ))}
                  {(replay.messages || [])
                    .filter((m) => m?.metadata?.functionCalling)
                    .map((m, i) => (
                      <Box key={`fc-${i}`} mb={1}>
                        <Typography variant="subtitle2">
                          Function Calling (mensagem {m.id})
                        </Typography>
                        <pre className={classes.mono}>
                          {JSON.stringify(m.metadata.functionCalling, null, 2)}
                        </pre>
                      </Box>
                    ))}
                  <pre className={classes.mono}>
                    {JSON.stringify(replay.tools, null, 2)}
                  </pre>
                </>
              )}
              <pre className={classes.mono}>
                {JSON.stringify(
                  {
                    capabilities: replay.capabilitiesSnapshot,
                    plan: replay.plan,
                    graph: replay.graph,
                  },
                  null,
                  2
                )}
              </pre>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplay(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default AutomationMonitorPage;
