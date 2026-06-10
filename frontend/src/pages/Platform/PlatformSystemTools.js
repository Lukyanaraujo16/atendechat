import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import LinearProgress from "@material-ui/core/LinearProgress";
import Paper from "@material-ui/core/Paper";
import Chip from "@material-ui/core/Chip";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import { makeStyles } from "@material-ui/core/styles";
import RefreshIcon from "@material-ui/icons/Refresh";
import FileCopyIcon from "@material-ui/icons/FileCopy";
import DeleteSweepIcon from "@material-ui/icons/DeleteSweep";
import CodeIcon from "@material-ui/icons/Code";
import CloudDownloadIcon from "@material-ui/icons/CloudDownload";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import BuildIcon from "@material-ui/icons/Build";
import StorageIcon from "@material-ui/icons/Storage";
import ReplayIcon from "@material-ui/icons/Replay";
import GetAppIcon from "@material-ui/icons/GetApp";
import Alert from "@material-ui/lab/Alert";

import MainContainer from "../../components/MainContainer";
import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { toast } from "react-toastify";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  AppPageHeader,
  AppSectionCard,
  AppActionBar,
  AppPrimaryButton,
  AppSecondaryButton,
  AppLoadingState,
} from "../../ui";

const DEFAULT_REFRESH_MS = 5000;
const JOB_MIN_REFRESH_MS = 10000;
const SOCKET_LOG_TIMEOUT_MS = 15000;
const JOB_POLL_MS = 2000;

function getSaasSocketKey(user) {
  if (!user?.id) return null;
  return user.companyId != null ? user.companyId : `saas-${user.id}`;
}

const ACTION_REQUEST_LABELS = {
  "git-status": "platform.systemTools.actions.gitStatus",
  "git-log": "platform.systemTools.actions.gitLog",
  "git-pull": "platform.systemTools.actions.gitPull",
  "backend-npm-install": "platform.systemTools.deploy.actions.backendNpmInstall",
  "backend-build": "platform.systemTools.deploy.actions.backendBuild",
  "backend-migrate": "platform.systemTools.deploy.actions.backendMigrate",
  "backend-restart": "platform.systemTools.deploy.actions.backendRestart",
  "frontend-npm-install": "platform.systemTools.deploy.actions.frontendNpmInstall",
  "frontend-build": "platform.systemTools.deploy.actions.frontendBuild",
};

const REFRESH_INTERVAL_OPTIONS = [
  { value: 0, labelKey: "platform.systemTools.refresh.paused" },
  { value: 2000, labelKey: "platform.systemTools.refresh.2s" },
  { value: 5000, labelKey: "platform.systemTools.refresh.5s" },
  { value: 10000, labelKey: "platform.systemTools.refresh.10s" },
  { value: 30000, labelKey: "platform.systemTools.refresh.30s" },
];

function formatBytes(n) {
  const b = Number(n);
  if (!Number.isFinite(b) || b < 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUptime(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(ts) {
  try {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "--:--:--";
  }
}

const useStyles = makeStyles((theme) => ({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    width: "100%",
  },
  sectionHeading: {
    fontWeight: 600,
    fontSize: "1.0625rem",
    marginBottom: theme.spacing(2),
    color: theme.palette.text.primary,
  },
  metricCard: {
    height: "100%",
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  metricValue: {
    fontSize: "1.5rem",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  metricSub: {
    marginTop: theme.spacing(0.5),
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
  },
  progress: {
    marginTop: theme.spacing(1.5),
    height: 8,
    borderRadius: 4,
  },
  terminal: {
    backgroundColor: theme.palette.type === "dark" ? "#0d1117" : "#1e1e1e",
    color: "#c9d1d9",
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontSize: "0.8125rem",
    lineHeight: 1.5,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    minHeight: 240,
    maxHeight: 420,
    overflowY: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  terminalLine: {
    margin: 0,
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
  },
  metaGrid: {
    marginTop: theme.spacing(1),
  },
  terminalActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  orderList: {
    margin: 0,
    paddingLeft: theme.spacing(2.5),
    color: theme.palette.text.secondary,
    fontSize: "0.875rem",
    lineHeight: 1.6,
  },
  deployHint: {
    marginBottom: theme.spacing(2),
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.5,
  },
  refreshBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(2),
  },
  refreshStatus: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    minWidth: 160,
  },
  intervalSelect: {
    minWidth: 160,
  },
}));

const DEPLOY_ACTIONS = [
  {
    key: "backend-npm-install",
    labelKey: "platform.systemTools.deploy.actions.backendNpmInstall",
    confirmTitleKey: "platform.systemTools.deploy.confirm.backendNpmInstall.title",
    confirmBodyKey: "platform.systemTools.deploy.confirm.backendNpmInstall.body",
    icon: GetAppIcon,
    destructive: false,
  },
  {
    key: "backend-build",
    labelKey: "platform.systemTools.deploy.actions.backendBuild",
    confirmTitleKey: "platform.systemTools.deploy.confirm.backendBuild.title",
    confirmBodyKey: "platform.systemTools.deploy.confirm.backendBuild.body",
    icon: BuildIcon,
    destructive: false,
  },
  {
    key: "backend-migrate",
    labelKey: "platform.systemTools.deploy.actions.backendMigrate",
    confirmTitleKey: "platform.systemTools.deploy.confirm.backendMigrate.title",
    confirmBodyKey: "platform.systemTools.deploy.confirm.backendMigrate.body",
    icon: StorageIcon,
    destructive: false,
  },
  {
    key: "backend-restart",
    labelKey: "platform.systemTools.deploy.actions.backendRestart",
    confirmTitleKey: "platform.systemTools.deploy.confirm.backendRestart.title",
    confirmBodyKey: "platform.systemTools.deploy.confirm.backendRestart.body",
    icon: ReplayIcon,
    destructive: true,
  },
  {
    key: "frontend-npm-install",
    labelKey: "platform.systemTools.deploy.actions.frontendNpmInstall",
    confirmTitleKey: "platform.systemTools.deploy.confirm.frontendNpmInstall.title",
    confirmBodyKey: "platform.systemTools.deploy.confirm.frontendNpmInstall.body",
    icon: GetAppIcon,
    destructive: false,
  },
  {
    key: "frontend-build",
    labelKey: "platform.systemTools.deploy.actions.frontendBuild",
    confirmTitleKey: "platform.systemTools.deploy.confirm.frontendBuild.title",
    confirmBodyKey: "platform.systemTools.deploy.confirm.frontendBuild.body",
    icon: BuildIcon,
    destructive: false,
  },
];

function MetricCard({ title, value, sub, percent }) {
  const classes = useStyles();
  return (
    <Paper className={classes.metricCard} elevation={0}>
      <Typography variant="caption" color="textSecondary">
        {title}
      </Typography>
      <Typography className={classes.metricValue}>{value}</Typography>
      {sub && <Typography className={classes.metricSub}>{sub}</Typography>}
      {typeof percent === "number" && (
        <LinearProgress
          className={classes.progress}
          variant="determinate"
          value={Math.min(100, Math.max(0, percent))}
        />
      )}
    </Paper>
  );
}

export default function PlatformSystemTools() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const socketManager = useContext(SocketContext);
  const [monitor, setMonitor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobRunning, setJobRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);
  const [backendRestarting, setBackendRestarting] = useState(false);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_MS);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const [tabVisible, setTabVisible] = useState(
    () => typeof document !== "undefined" && !document.hidden
  );
  const terminalRef = useRef(null);
  const autoScrollRef = useRef(true);
  const pendingRestartRef = useRef(false);
  const monitorInFlightRef = useRef(false);
  const activeJobIdRef = useRef(null);
  const lastServerLogSeqRef = useRef(0);
  const seenServerLogKeysRef = useRef(new Set());
  const socketEventReceivedRef = useRef(false);
  const socketWatchdogRef = useRef(null);
  const jobRunningRef = useRef(false);

  const effectiveRefreshMs = useMemo(() => {
    if (refreshIntervalMs === 0) return 0;
    if (jobRunning && refreshIntervalMs < JOB_MIN_REFRESH_MS) {
      return JOB_MIN_REFRESH_MS;
    }
    return refreshIntervalMs;
  }, [refreshIntervalMs, jobRunning]);

  const appendLog = useCallback((line, ts) => {
    setLogs((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, text: line, ts: ts || new Date().toISOString() },
    ]);
  }, []);

  const resetServerLogTracking = useCallback((jobId, { force = false } = {}) => {
    if (!force && jobId != null && activeJobIdRef.current === jobId) {
      return;
    }
    activeJobIdRef.current = jobId ?? null;
    lastServerLogSeqRef.current = 0;
    seenServerLogKeysRef.current = new Set();
  }, []);

  const ingestServerLog = useCallback(
    (jobId, entry) => {
      if (!entry?.line) return false;
      if (jobId && activeJobIdRef.current && jobId !== activeJobIdRef.current) {
        return false;
      }
      if (jobId && !activeJobIdRef.current) {
        activeJobIdRef.current = jobId;
      }

      const seq = Number(entry.seq);
      if (Number.isFinite(seq) && seq > 0) {
        if (seq <= lastServerLogSeqRef.current) return false;
        lastServerLogSeqRef.current = seq;
        appendLog(entry.line, entry.ts);
        return true;
      }

      const dedupeKey = `${jobId || activeJobIdRef.current || "job"}|${entry.ts}|${entry.line}`;
      if (seenServerLogKeysRef.current.has(dedupeKey)) return false;
      seenServerLogKeysRef.current.add(dedupeKey);
      appendLog(entry.line, entry.ts);
      return true;
    },
    [appendLog]
  );

  const clearSocketWatchdog = useCallback(() => {
    if (socketWatchdogRef.current) {
      clearTimeout(socketWatchdogRef.current);
      socketWatchdogRef.current = null;
    }
  }, []);

  const syncJobLogsFromSnapshot = useCallback(
    (job, { reset = false } = {}) => {
      if (!job?.logs?.length) return;
      if (reset || activeJobIdRef.current !== job.jobId) {
        resetServerLogTracking(job.jobId);
      }
      let ingested = false;
      job.logs.forEach((entry) => {
        if (ingestServerLog(job.jobId, entry)) {
          ingested = true;
        }
      });
      if (ingested) {
        socketEventReceivedRef.current = true;
      }
    },
    [ingestServerLog, resetServerLogTracking]
  );

  const applyJobSnapshot = useCallback(
    (snapshot) => {
      if (!snapshot?.job) return;
      const { job, active } = snapshot;
      if (active) {
        setJobRunning(true);
      } else if (job.status && job.status !== "running") {
        setJobRunning(false);
        clearSocketWatchdog();
      }
      syncJobLogsFromSnapshot(job);
    },
    [syncJobLogsFromSnapshot, clearSocketWatchdog]
  );

  const fetchCurrentJob = useCallback(async () => {
    try {
      const { data } = await api.get("/system/update/current");
      applyJobSnapshot(data);
    } catch {
      /* polling silencioso */
    }
  }, [applyJobSnapshot]);

  useEffect(() => {
    jobRunningRef.current = jobRunning;
  }, [jobRunning]);

  const fetchMonitor = useCallback(async ({ silent = false, force = false } = {}) => {
    if (monitorInFlightRef.current && !force) return;
    monitorInFlightRef.current = true;
    if (!silent) setRefreshing(true);
    try {
      const { data } = await api.get("/system/monitor");
      setMonitor(data);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      if (!silent) toastError(err);
    } finally {
      monitorInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitor({ silent: true });
  }, [fetchMonitor]);

  useEffect(() => {
    if (!tabVisible || effectiveRefreshMs === 0) return undefined;
    const id = setInterval(() => {
      fetchMonitor({ silent: true });
    }, effectiveRefreshMs);
    return () => clearInterval(id);
  }, [tabVisible, effectiveRefreshMs, fetchMonitor]);

  useEffect(() => {
    const onVisibilityChange = () => {
      const visible = !document.hidden;
      setTabVisible(visible);
      if (visible) {
        fetchMonitor({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [fetchMonitor]);

  useEffect(() => {
    if (!lastUpdatedAt) return undefined;
    const tick = () => {
      setSecondsSinceUpdate(Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  useEffect(() => {
    fetchCurrentJob();
  }, [fetchCurrentJob]);

  useEffect(() => {
    if (!jobRunning) return undefined;
    const id = setInterval(() => {
      fetchCurrentJob();
    }, JOB_POLL_MS);
    return () => clearInterval(id);
  }, [jobRunning, fetchCurrentJob]);

  useEffect(() => {
    const socketKey = getSaasSocketKey(user);
    if (!socketKey) return undefined;

    const socket = socketManager.getSocket(socketKey);

    const onStart = (payload) => {
      socketEventReceivedRef.current = true;
      clearSocketWatchdog();
      setJobRunning(true);
      if (payload?.jobId) {
        resetServerLogTracking(payload.jobId);
      }
      if (payload?.restartsBackend || payload?.action === "backend_restart") {
        pendingRestartRef.current = true;
      }
    };

    const onLog = (payload) => {
      clearSocketWatchdog();
      if (ingestServerLog(payload?.jobId, payload)) {
        socketEventReceivedRef.current = true;
      }
    };

    const onDone = (payload) => {
      socketEventReceivedRef.current = true;
      clearSocketWatchdog();
      setJobRunning(false);
      pendingRestartRef.current = false;
      setBackendRestarting(false);
      fetchCurrentJob();
    };

    const onDisconnect = () => {
      if (pendingRestartRef.current) {
        setBackendRestarting(true);
        setJobRunning(false);
        appendLog(
          `[${formatTime()}] ${i18n.t("platform.systemTools.deploy.backendRestarting")}`,
          new Date().toISOString()
        );
        pendingRestartRef.current = false;
      }
    };

    socket.on("system-update:start", onStart);
    socket.on("system-update:log", onLog);
    socket.on("system-update:done", onDone);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("system-update:start", onStart);
      socket.off("system-update:log", onLog);
      socket.off("system-update:done", onDone);
      socket.off("disconnect", onDisconnect);
      clearSocketWatchdog();
    };
  }, [
    socketManager,
    user?.id,
    user?.companyId,
    clearSocketWatchdog,
    fetchCurrentJob,
    ingestServerLog,
    resetServerLogTracking,
  ]);

  useEffect(() => {
    if (!autoScrollRef.current || !terminalRef.current) return;
    terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  const runAction = async (action) => {
    if (jobRunning) {
      toast.info(i18n.t("platform.systemTools.jobRunning"));
      return;
    }

    const labelKey = ACTION_REQUEST_LABELS[action];
    const actionLabel = labelKey ? i18n.t(labelKey) : action;
    appendLog(
      `[${formatTime()}] ${i18n.t("platform.systemTools.terminal.requesting", { action: actionLabel })}`,
      new Date().toISOString()
    );

    setJobRunning(true);
    socketEventReceivedRef.current = false;
    resetServerLogTracking(null, { force: true });
    clearSocketWatchdog();
    socketWatchdogRef.current = setTimeout(() => {
      if (!socketEventReceivedRef.current && jobRunningRef.current) {
        appendLog(
          `[${formatTime()}] ${i18n.t("platform.systemTools.terminal.socketTimeout")}`,
          new Date().toISOString()
        );
        fetchCurrentJob();
      }
    }, SOCKET_LOG_TIMEOUT_MS);

    try {
      const { data } = await api.post(`/system/update/${action}`);
      if (data?.jobId) {
        if (!activeJobIdRef.current) {
          activeJobIdRef.current = data.jobId;
        }
        appendLog(
          `[${formatTime()}] ${i18n.t("platform.systemTools.terminal.accepted", { jobId: data.jobId })}`,
          new Date().toISOString()
        );
      }
      fetchCurrentJob();
    } catch (err) {
      setJobRunning(false);
      clearSocketWatchdog();
      const code = err?.response?.data?.error;
      if (code === "SYSTEM_UPDATE_JOB_RUNNING") {
        appendLog(
          `[${formatTime()}] ${i18n.t("platform.systemTools.jobRunning")}`,
          new Date().toISOString()
        );
        toast.info(i18n.t("platform.systemTools.jobRunning"));
        return;
      }
      toastError(err);
    }
  };

  const requestAction = (actionKey, needsConfirm = false) => {
    if (jobRunning) {
      toast.info(i18n.t("platform.systemTools.jobRunning"));
      return;
    }
    if (needsConfirm) {
      const deploy = DEPLOY_ACTIONS.find((a) => a.key === actionKey);
      if (deploy) {
        setConfirmAction(deploy);
        return;
      }
    }
    runAction(actionKey);
  };

  const handleConfirmDeploy = () => {
    if (confirmAction?.key) {
      runAction(confirmAction.key);
    }
    setConfirmAction(null);
  };

  const copyLogs = async () => {
    const text = logs.map((l) => l.text).join("\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(i18n.t("platform.systemTools.terminal.copied"));
    } catch {
      toast.error(i18n.t("platform.systemTools.terminal.copyFailed"));
    }
  };

  const clearLogs = () => setLogs([]);

  if (loading && !monitor) {
    return (
      <MainContainer>
        <AppLoadingState message={i18n.t("platform.systemTools.loading")} />
      </MainContainer>
    );
  }

  const loadAvg = monitor?.loadAverage || [];
  const loadStr =
    loadAvg.length >= 3
      ? loadAvg.map((n) => Number(n).toFixed(2)).join(" / ")
      : "—";

  return (
    <MainContainer>
      <Box className={classes.page}>
        <AppPageHeader
          title={i18n.t("platform.systemTools.title")}
          subtitle={i18n.t("platform.systemTools.subtitle")}
        />

        <AppActionBar>
          <Box className={classes.refreshBar}>
            <AppSecondaryButton
              startIcon={<RefreshIcon />}
              onClick={() => fetchMonitor({ silent: false, force: false })}
              disabled={refreshing}
            >
              {refreshing
                ? i18n.t("platform.systemTools.refreshing")
                : i18n.t("platform.systemTools.refreshNow")}
            </AppSecondaryButton>
            <FormControl
              variant="outlined"
              size="small"
              className={classes.intervalSelect}
            >
              <InputLabel id="monitor-refresh-interval">
                {i18n.t("platform.systemTools.refresh.intervalLabel")}
              </InputLabel>
              <Select
                labelId="monitor-refresh-interval"
                value={refreshIntervalMs}
                onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
                label={i18n.t("platform.systemTools.refresh.intervalLabel")}
              >
                {REFRESH_INTERVAL_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {i18n.t(opt.labelKey)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography className={classes.refreshStatus} component="span">
              {refreshIntervalMs === 0
                ? i18n.t("platform.systemTools.refresh.pausedHint")
                : secondsSinceUpdate <= 1
                  ? i18n.t("platform.systemTools.refresh.updatedJustNow")
                  : i18n.t("platform.systemTools.refresh.updatedAgo", {
                      seconds: secondsSinceUpdate,
                    })}
              {lastUpdatedAt ? (
                <>
                  {" · "}
                  {new Date(lastUpdatedAt).toLocaleTimeString()}
                </>
              ) : null}
            </Typography>
            {jobRunning &&
              refreshIntervalMs > 0 &&
              refreshIntervalMs < JOB_MIN_REFRESH_MS && (
                <Typography variant="caption" color="textSecondary">
                  {i18n.t("platform.systemTools.refresh.jobThrottleHint")}
                </Typography>
              )}
          </Box>
        </AppActionBar>

        <AppSectionCard>
          <Typography className={classes.sectionHeading}>
            {i18n.t("platform.systemTools.monitorSection")}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <MetricCard
                title={i18n.t("platform.systemTools.cpu")}
                value={`${monitor?.cpu?.usagePercent ?? "—"}%`}
                sub={i18n.t("platform.systemTools.cpuCores", {
                  count: monitor?.cpu?.cores ?? "—",
                })}
                percent={monitor?.cpu?.usagePercent}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <MetricCard
                title={i18n.t("platform.systemTools.ram")}
                value={`${monitor?.memory?.usedPercent ?? "—"}%`}
                sub={`${formatBytes(monitor?.memory?.usedBytes)} / ${formatBytes(monitor?.memory?.totalBytes)}`}
                percent={monitor?.memory?.usedPercent}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <MetricCard
                title={i18n.t("platform.systemTools.disk")}
                value={`${monitor?.disk?.usedPercent ?? "—"}%`}
                sub={`${formatBytes(monitor?.disk?.usedBytes)} / ${formatBytes(monitor?.disk?.totalBytes)}`}
                percent={monitor?.disk?.usedPercent}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} className={classes.metaGrid}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="textSecondary">
                {i18n.t("platform.systemTools.uptime")}
              </Typography>
              <Typography variant="body2">
                {formatUptime(monitor?.uptime?.systemSeconds)}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="textSecondary">
                {i18n.t("platform.systemTools.load")}
              </Typography>
              <Typography variant="body2">{loadStr}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="textSecondary">
                Node
              </Typography>
              <Typography variant="body2">
                {monitor?.node?.version} ({monitor?.env?.nodeEnv})
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="textSecondary">
                {i18n.t("platform.systemTools.backend")}
              </Typography>
              <Chip
                size="small"
                label={monitor?.backend?.status || "—"}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="caption" color="textSecondary">
                Git
              </Typography>
              <Typography variant="body2">
                {monitor?.git?.branch || "—"}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {monitor?.git?.lastCommit || "—"}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="caption" color="textSecondary">
                {i18n.t("platform.systemTools.gitStatus")}
              </Typography>
              <Typography variant="body2">
                {monitor?.git?.statusSummary || "—"}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="caption" color="textSecondary">
                {i18n.t("platform.systemTools.projectSize")}
              </Typography>
              <Typography variant="body2">
                {monitor?.project?.sizeBytes != null
                  ? formatBytes(monitor.project.sizeBytes)
                  : "—"}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {monitor?.appRoot?.path} ({monitor?.appRoot?.strategy})
              </Typography>
            </Grid>
          </Grid>
        </AppSectionCard>

        <AppSectionCard>
          <Typography className={classes.sectionHeading}>
            {i18n.t("platform.systemTools.updatesSection")}
          </Typography>
          <Box className={classes.actionRow}>
            <AppPrimaryButton
              startIcon={<InfoOutlinedIcon />}
              disabled={jobRunning}
              onClick={() => runAction("git-status")}
            >
              {i18n.t("platform.systemTools.actions.gitStatus")}
            </AppPrimaryButton>
            <AppPrimaryButton
              startIcon={<CodeIcon />}
              disabled={jobRunning}
              onClick={() => runAction("git-log")}
            >
              {i18n.t("platform.systemTools.actions.gitLog")}
            </AppPrimaryButton>
            <AppPrimaryButton
              startIcon={<CloudDownloadIcon />}
              disabled={jobRunning}
              onClick={() => runAction("git-pull")}
            >
              {i18n.t("platform.systemTools.actions.gitPull")}
            </AppPrimaryButton>
          </Box>
          {jobRunning && (
            <Box mt={2}>
              <LinearProgress />
              <Typography variant="caption" color="textSecondary">
                {i18n.t("platform.systemTools.jobRunning")}
              </Typography>
            </Box>
          )}
        </AppSectionCard>

        <AppSectionCard>
          <Typography className={classes.sectionHeading}>
            {i18n.t("platform.systemTools.deploy.section")}
          </Typography>
          <Typography className={classes.deployHint}>
            {i18n.t("platform.systemTools.deploy.hint")}
          </Typography>
          <Box mb={2}>
            <Typography variant="subtitle2" gutterBottom>
              {i18n.t("platform.systemTools.deploy.recommendedOrder")}
            </Typography>
            <ol className={classes.orderList}>
              <li>{i18n.t("platform.systemTools.deploy.steps.gitPull")}</li>
              <li>{i18n.t("platform.systemTools.deploy.steps.backendNpm")}</li>
              <li>{i18n.t("platform.systemTools.deploy.steps.backendBuild")}</li>
              <li>{i18n.t("platform.systemTools.deploy.steps.migrate")}</li>
              <li>{i18n.t("platform.systemTools.deploy.steps.restart")}</li>
              <li>{i18n.t("platform.systemTools.deploy.steps.frontendNpm")}</li>
              <li>{i18n.t("platform.systemTools.deploy.steps.frontendBuild")}</li>
            </ol>
          </Box>
          <Box className={classes.actionRow}>
            {DEPLOY_ACTIONS.map((item) => {
              const Icon = item.icon;
              const ButtonComponent = item.destructive ? AppSecondaryButton : AppPrimaryButton;
              return (
                <ButtonComponent
                  key={item.key}
                  startIcon={<Icon />}
                  disabled={jobRunning}
                  onClick={() => requestAction(item.key, true)}
                >
                  {i18n.t(item.labelKey)}
                </ButtonComponent>
              );
            })}
          </Box>
          {backendRestarting && (
            <Box mt={2}>
              <Alert severity="info">
                {i18n.t("platform.systemTools.deploy.backendRestarting")}
              </Alert>
            </Box>
          )}
        </AppSectionCard>

        <AppSectionCard>
          <Typography className={classes.sectionHeading}>
            {i18n.t("platform.systemTools.terminal.title")}
          </Typography>
          <Box className={classes.terminalActions}>
            <AppSecondaryButton size="small" startIcon={<FileCopyIcon />} onClick={copyLogs}>
              {i18n.t("platform.systemTools.terminal.copy")}
            </AppSecondaryButton>
            <AppSecondaryButton size="small" startIcon={<DeleteSweepIcon />} onClick={clearLogs}>
              {i18n.t("platform.systemTools.terminal.clear")}
            </AppSecondaryButton>
          </Box>
          <Paper elevation={0} className={classes.terminal} ref={terminalRef}>
            {logs.length === 0 ? (
              <Typography variant="body2" style={{ color: "#8b949e" }}>
                {i18n.t("platform.systemTools.terminal.empty")}
              </Typography>
            ) : (
              logs.map((l) => (
                <div key={l.id} className={classes.terminalLine}>
                  {l.text}
                </div>
              ))
            )}
          </Paper>
        </AppSectionCard>
      </Box>

      <ConfirmationModal
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmDeploy}
        title={
          confirmAction
            ? i18n.t(confirmAction.confirmTitleKey)
            : ""
        }
        destructive={confirmAction?.destructive}
      >
        {confirmAction ? i18n.t(confirmAction.confirmBodyKey) : null}
      </ConfirmationModal>
    </MainContainer>
  );
}
