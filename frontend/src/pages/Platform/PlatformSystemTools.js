import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import LinearProgress from "@material-ui/core/LinearProgress";
import Paper from "@material-ui/core/Paper";
import Chip from "@material-ui/core/Chip";
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
import {
  AppPageHeader,
  AppSectionCard,
  AppActionBar,
  AppPrimaryButton,
  AppSecondaryButton,
  AppLoadingState,
} from "../../ui";

const REFRESH_MS = 8000;

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
  const socketManager = useContext(SocketContext);
  const [monitor, setMonitor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobRunning, setJobRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);
  const [backendRestarting, setBackendRestarting] = useState(false);
  const terminalRef = useRef(null);
  const autoScrollRef = useRef(true);
  const pendingRestartRef = useRef(false);

  const appendLog = useCallback((line, ts) => {
    setLogs((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, text: line, ts: ts || new Date().toISOString() },
    ]);
  }, []);

  const fetchMonitor = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const { data } = await api.get("/system/monitor");
      setMonitor(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitor();
    const id = setInterval(() => fetchMonitor(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchMonitor]);

  useEffect(() => {
    const socket = socketManager?.currentSocket;
    if (!socket) return undefined;

    const onStart = (payload) => {
      setJobRunning(true);
      if (payload?.restartsBackend || payload?.action === "backend_restart") {
        pendingRestartRef.current = true;
      }
      if (payload?.command) {
        appendLog(`[${formatTime()}] ${payload.command}`, new Date().toISOString());
      }
    };

    const onLog = (payload) => {
      if (payload?.line) appendLog(payload.line, payload.ts);
    };

    const onDone = (payload) => {
      setJobRunning(false);
      pendingRestartRef.current = false;
      setBackendRestarting(false);
      const status = payload?.status || "done";
      const msg =
        status === "success"
          ? i18n.t("platform.systemTools.terminal.success")
          : status === "timeout"
            ? i18n.t("platform.systemTools.terminal.timeout")
            : i18n.t("platform.systemTools.terminal.failed");
      appendLog(`[${formatTime()}] ${msg}`, new Date().toISOString());
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
    };
  }, [socketManager, appendLog]);

  useEffect(() => {
    if (!autoScrollRef.current || !terminalRef.current) return;
    terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  const runAction = async (action) => {
    if (jobRunning) {
      toast.info(i18n.t("platform.systemTools.jobRunning"));
      return;
    }
    try {
      await api.post(`/system/update/${action}`);
    } catch (err) {
      const code = err?.response?.data?.error;
      if (code === "SYSTEM_UPDATE_JOB_RUNNING") {
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
          <AppSecondaryButton
            startIcon={<RefreshIcon />}
            onClick={() => fetchMonitor()}
            disabled={refreshing}
          >
            {refreshing
              ? i18n.t("platform.systemTools.refreshing")
              : i18n.t("platform.systemTools.refreshNow")}
          </AppSecondaryButton>
          {monitor?.collectedAt && (
            <Typography variant="caption" color="textSecondary">
              {i18n.t("platform.systemTools.lastUpdate")}:{" "}
              {new Date(monitor.collectedAt).toLocaleString()}
            </Typography>
          )}
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
