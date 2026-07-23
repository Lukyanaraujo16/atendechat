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
import { getLiveRolloutDashboard } from "../../services/automationLiveRolloutApi";
import { getCognitivePlanningDashboard } from "../../services/automationCognitivePlanningApi";
import { getPlanEvaluationDashboard } from "../../services/automationCognitivePlanningApi";
import { getExecutionSessionsDashboard } from "../../services/automationExecutionOrchestratorApi";
import { getActionExecutionDashboard } from "../../services/automationActionExecutionApi";
import { getRuntimeIntegrationDashboard } from "../../services/automationRuntimeIntegrationApi";
import { getExecutionFeedbackDashboard } from "../../services/automationExecutionFeedbackApi";
import { getCognitiveMemoryDashboard } from "../../services/automationCognitiveMemoryApi";
import { getMcpDashboard } from "../../services/automationMcpApi";
import { getLearningDashboard } from "../../services/automationLearningApi";
import { getMultiAgentDashboard } from "../../services/automationMultiAgentApi";

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
  const [liveRollout, setLiveRollout] = useState(null);
  const [cognitivePlanning, setCognitivePlanning] = useState(null);
  const [planEvaluation, setPlanEvaluation] = useState(null);
  const [executionSessions, setExecutionSessions] = useState(null);
  const [actionExecution, setActionExecution] = useState(null);
  const [runtimeIntegration, setRuntimeIntegration] = useState(null);
  const [executionFeedback, setExecutionFeedback] = useState(null);
  const [cognitiveMemory, setCognitiveMemory] = useState(null);
  const [mcpRuntime, setMcpRuntime] = useState(null);
  const [learningEngine, setLearningEngine] = useState(null);
  const [multiAgent, setMultiAgent] = useState(null);

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

  const loadLiveRolloutTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getLiveRolloutDashboard();
      setLiveRollout(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCognitivePlanningTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getCognitivePlanningDashboard();
      setCognitivePlanning(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlanEvaluationTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getPlanEvaluationDashboard();
      setPlanEvaluation(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExecutionSessionsTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getExecutionSessionsDashboard();
      setExecutionSessions(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActionExecutionTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getActionExecutionDashboard();
      setActionExecution(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRuntimeIntegrationTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getRuntimeIntegrationDashboard();
      setRuntimeIntegration(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExecutionFeedbackTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getExecutionFeedbackDashboard();
      setExecutionFeedback(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCognitiveMemoryTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getCognitiveMemoryDashboard();
      setCognitiveMemory(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMcpRuntimeTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getMcpDashboard();
      setMcpRuntime(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLearningEngineTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getLearningDashboard();
      setLearningEngine(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMultiAgentTab = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getMultiAgentDashboard();
      setMultiAgent(data);
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
    if (tab === 7) loadLiveRolloutTab();
    if (tab === 8) loadCognitivePlanningTab();
    if (tab === 9) loadPlanEvaluationTab();
    if (tab === 10) loadExecutionSessionsTab();
    if (tab === 11) loadActionExecutionTab();
    if (tab === 12) loadRuntimeIntegrationTab();
    if (tab === 13) loadExecutionFeedbackTab();
    if (tab === 14) loadCognitiveMemoryTab();
    if (tab === 15) loadMcpRuntimeTab();
    if (tab === 16) loadLearningEngineTab();
    if (tab === 17) loadMultiAgentTab();
    if (tab === 18) loadSettings();
  }, [
    tab,
    loadDashboard,
    loadExecutions,
    loadValidations,
    loadActionsCatalog,
    loadToolsTab,
    loadShadowFcTab,
    loadEvidenceTab,
    loadLiveRolloutTab,
    loadCognitivePlanningTab,
    loadPlanEvaluationTab,
    loadExecutionSessionsTab,
    loadActionExecutionTab,
    loadRuntimeIntegrationTab,
    loadExecutionFeedbackTab,
    loadCognitiveMemoryTab,
    loadMcpRuntimeTab,
    loadLearningEngineTab,
    loadMultiAgentTab,
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
          <Tab label="Live FC" />
          <Tab label="Planner" />
          <Tab label="Evaluation" />
          <Tab label="Execution" />
          <Tab label="Action Exec" />
          <Tab label="Runtime" />
          <Tab label="Feedback" />
          <Tab label="Memory" />
          <Tab label="MCP" />
          <Tab label="Learning" />
          <Tab label="Multi-Agent" />
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

          {tab === 7 &&
            (loading && !liveRollout ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Live FC (2.2) — Eligibility, Canary, Kill Switch, Fallback,
                  Rollback. Write Tools OFF.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Stage"
                      value={liveRollout?.config?.stage}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Percent"
                      value={liveRollout?.config?.percent}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Live execs"
                      value={liveRollout?.metrics?.liveExecutions}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Fallbacks"
                      value={liveRollout?.metrics?.fallbacks}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Rollbacks"
                      value={liveRollout?.metrics?.rollbacks}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Canary %"
                      value={Math.round(
                        (liveRollout?.metrics?.canaryRate || 0) * 100
                      )}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        killSwitch: liveRollout?.killSwitch,
                        readiness: liveRollout?.readiness,
                        comparison: liveRollout?.comparison,
                        config: liveRollout?.config,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 8 &&
            (loading && !cognitivePlanning ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Cognitive Planner (V2.0) — Goal → Execution Plan. Não executa
                  Tools. Live/Shadow inalterados.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Plans"
                      value={cognitivePlanning?.metrics?.plansGenerated}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Avg steps"
                      value={cognitivePlanning?.metrics?.averageSteps}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Recovery rate"
                      value={cognitivePlanning?.metrics?.recoveryRate}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Validation fails"
                      value={cognitivePlanning?.metrics?.validationFailures}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        guarantees: cognitivePlanning?.guarantees,
                        recentGoals: cognitivePlanning?.recentGoals?.slice(0, 3),
                        recentPlans: cognitivePlanning?.recentPlans?.slice(0, 3),
                        recentRecoveries:
                          cognitivePlanning?.recentRecoveries?.slice(0, 3),
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 9 &&
            (loading && !planEvaluation ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Plan Evaluation (V2.1) — qualidade do plano antes do Executor.
                  Sem Tools. Live/Shadow inalterados.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Evaluated"
                      value={planEvaluation?.metrics?.plansEvaluated}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Approval %"
                      value={Math.round(
                        (planEvaluation?.metrics?.approvalRate || 0) * 100
                      )}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Avg quality"
                      value={planEvaluation?.metrics?.averageQuality}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Critical rate"
                      value={planEvaluation?.metrics?.criticalRate}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        guarantees: planEvaluation?.guarantees,
                        topValidators: planEvaluation?.topValidators,
                        topProblems: planEvaluation?.topProblems,
                        recent: planEvaluation?.recentEvaluations?.slice(0, 3),
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 10 &&
            (loading && !executionSessions ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Execution Orchestrator (V2.2) — sessão e state machine. Sem
                  Tools. Live/Shadow inalterados.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Running"
                      value={executionSessions?.counts?.running}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Completed"
                      value={executionSessions?.counts?.completed}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Failed"
                      value={executionSessions?.counts?.failed}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Waiting confirm"
                      value={executionSessions?.counts?.waitingConfirmation}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        guarantees: executionSessions?.guarantees,
                        metrics: executionSessions?.metrics,
                        recent: executionSessions?.recentSessions?.slice(0, 2),
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 11 &&
            (loading && !actionExecution ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Action Execution Engine (V2.3) — Strategy simulada por action.
                  Sem Tool Runtime. Live/Shadow inalterados.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Strategies"
                      value={actionExecution?.strategies}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Success rate"
                      value={
                        actionExecution?.successRate != null
                          ? `${Math.round(actionExecution.successRate * 100)}%`
                          : "—"
                      }
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Failures"
                      value={actionExecution?.failures}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Waiting"
                      value={actionExecution?.waiting}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Timeline recente (results)
                  </Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        validation: actionExecution?.validation,
                        metrics: actionExecution?.metrics,
                        usesToolRuntime: actionExecution?.usesToolRuntime,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 12 &&
            (loading && !runtimeIntegration ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Runtime Integration (V2.4) — Request, Dispatcher, Policy,
                  Adapter e Result. Reutiliza runtime existente.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Requests"
                      value={runtimeIntegration?.requests}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Latency"
                      value={
                        runtimeIntegration?.latency != null
                          ? `${Math.round(runtimeIntegration.latency)}ms`
                          : "—"
                      }
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Policy warnings"
                      value={runtimeIntegration?.policies?.warnings}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Failures"
                      value={runtimeIntegration?.failures}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        dispatcher: runtimeIntegration?.dispatcher,
                        metrics: runtimeIntegration?.metrics,
                        reusedExistingRuntime:
                          runtimeIntegration?.reusedExistingRuntime,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 13 &&
            (loading && !executionFeedback ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Execution Feedback (V2.5) — Runtime Result → Feedback → Goal
                  Progress → Session Update. Sem Tool/Planner.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Goal Progress"
                      value={
                        executionFeedback?.goalProgress != null
                          ? `${Math.round(executionFeedback.goalProgress)}%`
                          : "—"
                      }
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Recovery"
                      value={
                        executionFeedback?.recovery != null
                          ? `${Math.round(executionFeedback.recovery * 100)}%`
                          : "—"
                      }
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Replans"
                      value={
                        executionFeedback?.replans != null
                          ? `${Math.round(executionFeedback.replans * 100)}%`
                          : "—"
                      }
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label="Human"
                      value={
                        executionFeedback?.humanIntervention != null
                          ? `${Math.round(
                              executionFeedback.humanIntervention * 100
                            )}%`
                          : "—"
                      }
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        completion: executionFeedback?.completion,
                        metrics: executionFeedback?.metrics,
                        executesTools: executionFeedback?.executesTools,
                        callsPlanner: executionFeedback?.callsPlanner,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 14 &&
            (loading && !cognitiveMemory ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Cognitive Memory (V2.6) — Knowledge, Memory Type, Retrieval,
                  Score. SQL Provider. Sem Vector DB / embeddings.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={2}>
                    <MetricCard label="Working" value={cognitiveMemory?.working} />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Episodic"
                      value={cognitiveMemory?.episodic}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Semantic"
                      value={cognitiveMemory?.semantic}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Procedural"
                      value={cognitiveMemory?.procedural}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Reflection"
                      value={cognitiveMemory?.reflection}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Growth"
                      value={cognitiveMemory?.knowledgeGrowth}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        metrics: cognitiveMemory?.metrics,
                        storageProvider: cognitiveMemory?.storageProvider,
                        vectorEnabled: cognitiveMemory?.vectorEnabled,
                        usesEmbeddings: cognitiveMemory?.usesEmbeddings,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 15 &&
            (loading && !mcpRuntime ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  MCP Runtime (V2.7) — Request, Dispatch Decision, Server,
                  Tool, Policy, Result, Fallback. Sem Live.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={2}>
                    <MetricCard label="Servers" value={mcpRuntime?.servers} />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard label="Healthy" value={mcpRuntime?.healthy} />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard label="Tools" value={mcpRuntime?.tools} />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard label="Requests" value={mcpRuntime?.requests} />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Success"
                      value={
                        mcpRuntime?.successRate != null
                          ? `${Math.round(mcpRuntime.successRate * 100)}%`
                          : "—"
                      }
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Policy Denials"
                      value={mcpRuntime?.policyDenials}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        metrics: mcpRuntime?.metrics,
                        sdk: mcpRuntime?.sdk,
                        liveIntegrationEnabled:
                          mcpRuntime?.liveIntegrationEnabled,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 16 &&
            (loading && !learningEngine ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Learning Engine (V2.8) — Dataset, Patterns, Candidates,
                  Evaluation, Approval, Artifact, Shadow. Sem Live /
                  auto-promotion.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Analyses"
                      value={learningEngine?.analyses}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Patterns"
                      value={learningEngine?.patterns}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Candidates"
                      value={learningEngine?.candidates}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Ready"
                      value={learningEngine?.readyForReview}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Promoted"
                      value={learningEngine?.promoted}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Conflicts"
                      value={learningEngine?.conflicts}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        metrics: learningEngine?.metrics,
                        autoPromotionEnabled:
                          learningEngine?.autoPromotionEnabled,
                        liveIntegrationEnabled:
                          learningEngine?.liveIntegrationEnabled,
                        executesTools: learningEngine?.executesTools,
                        executesMcp: learningEngine?.executesMcp,
                        modifiesPlanner: learningEngine?.modifiesPlanner,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 17 &&
            (loading && !multiAgent ? (
              <TableRowSkeleton columns={4} />
            ) : (
              <>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Multi-Agent Runtime (V2.9) — Routing, Selection, Boundaries,
                  Delegation, Handoff, Coordinator. Kernel compartilhado. Sem
                  Live / autonomia contínua.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={2}>
                    <MetricCard label="Agents" value={multiAgent?.agents} />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard label="Active" value={multiAgent?.active} />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard label="Healthy" value={multiAgent?.healthy} />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Delegations"
                      value={multiAgent?.delegations}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard label="Handoffs" value={multiAgent?.handoffs} />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <MetricCard
                      label="Loops"
                      value={multiAgent?.loopsBlocked}
                    />
                  </Grid>
                </Grid>
                <Box mt={2}>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        metrics: multiAgent?.metrics,
                        liveIntegrationEnabled:
                          multiAgent?.liveIntegrationEnabled,
                        sharedKernel: multiAgent?.sharedKernel,
                        coordinatorSimulationOnly:
                          multiAgent?.coordinatorSimulationOnly,
                        duplicatesPlanner: multiAgent?.duplicatesPlanner,
                        duplicatesRuntime: multiAgent?.duplicatesRuntime,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              </>
            ))}

          {tab === 18 && (
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
