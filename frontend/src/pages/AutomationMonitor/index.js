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
  listAutomationExecutions,
  listAutomationPlannerValidations,
  simulateAutomationPlan,
  updateAutomationOrchestratorSettings,
} from "../../services/automationOrchestratorApi";

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

  useEffect(() => {
    if (tab === 0) loadDashboard();
    if (tab === 1) loadExecutions();
    if (tab === 2) loadValidations();
    if (tab === 3) loadSettings();
  }, [tab, loadDashboard, loadExecutions, loadValidations, loadSettings]);

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
          Ativação segura (2.0.1). Ownership padrão = legado. Observe e
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
                    Actions
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

          {tab === 3 && (
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
                  </Box>
                </div>
              ))}
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
