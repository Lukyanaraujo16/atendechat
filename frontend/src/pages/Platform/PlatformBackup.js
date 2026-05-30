import React, { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TextField from "@material-ui/core/TextField";
import Chip from "@material-ui/core/Chip";
import FormControl from "@material-ui/core/FormControl";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import Switch from "@material-ui/core/Switch";
import IconButton from "@material-ui/core/IconButton";
import Paper from "@material-ui/core/Paper";
import Alert from "@material-ui/lab/Alert";
import { makeStyles, alpha } from "@material-ui/core/styles";
import GetAppIcon from "@material-ui/icons/GetApp";
import BackupIcon from "@material-ui/icons/Backup";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import {
  AppPageHeader,
  AppSectionCard,
  AppActionBar,
  AppPrimaryButton,
  AppSecondaryButton,
  AppLoadingState,
  AppEmptyState,
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import AppTableContainer from "../../ui/components/AppTableContainer";

const CONFIRM = "RESTAURAR";
const STRONG_CONFIRM_DEFAULT = "RESTAURAR E SUBSTITUIR";
const DELETE_PHRASE = "EXCLUIR";

const defaultAutoConfig = {
  backupAutoEnabled: false,
  backupAutoFrequency: "daily",
  backupAutoTime: "03:00",
  backupAutoWeekday: 0,
  backupAutoRetention: 7,
};

const useStyles = makeStyles((theme) => ({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    width: "100%",
  },
  tableHead: {
    fontWeight: 600,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },
  hint: {
    marginTop: theme.spacing(1),
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.5,
    maxWidth: 720,
  },
  restoreBox: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    maxWidth: 520,
  },
  confirmDanger: {
    color: theme.palette.error.contrastText,
    backgroundColor: theme.palette.error.main,
    "&:hover": {
      backgroundColor: theme.palette.error.dark,
    },
  },
  actionsCell: {
    whiteSpace: "nowrap",
  },
  autoLayout: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(3),
    alignItems: "flex-start",
  },
  autoSummary: {
    flex: "1 1 280px",
    maxWidth: 400,
  },
  autoForm: {
    flex: "1 1 280px",
    maxWidth: 480,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  summaryPaper: {
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.common.white, 0.04)
        : alpha(theme.palette.primary.main, 0.04),
  },
  summaryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.25),
    "&:last-child": {
      marginBottom: 0,
    },
  },
  summaryLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: theme.palette.text.secondary,
  },
  summaryValue: {
    fontSize: "0.9375rem",
    fontWeight: 500,
    color: theme.palette.text.primary,
    textAlign: "right",
    flex: 1,
  },
  nextBackupBox: {
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  tzHint: {
    marginTop: theme.spacing(1.5),
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.45,
  },
  insightRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  insightCard: {
    flex: "1 1 260px",
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  insightLabel: {
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.75),
  },
  insightValue: {
    fontSize: "0.9375rem",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  insightMuted: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  rowRecent: {
    backgroundColor: alpha(theme.palette.primary.main, 0.07),
    boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
  },
  recentPill: {
    display: "block",
    fontSize: "0.65rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.primary.main,
    marginBottom: 4,
  },
  chipManual: {
    backgroundColor: alpha(theme.palette.primary.main, 0.14),
    color: theme.palette.primary.dark,
    border: "none",
    fontWeight: 500,
  },
  chipAuto: {
    backgroundColor: alpha(theme.palette.secondary.main, 0.18),
    color: theme.palette.secondary.dark,
    border: "none",
    fontWeight: 500,
  },
  chipPre: {
    backgroundColor: alpha(theme.palette.warning.main, 0.2),
    color: theme.palette.warning.dark,
    border: "none",
    fontWeight: 500,
  },
}));

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(backupSource) {
  const k = `platform.backup.type.${backupSource || "manual"}`;
  const t = i18n.t(k);
  return t !== k ? t : backupSource || "—";
}

function parseTimeParts(timeStr) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(timeStr || "03:00").trim());
  if (!m) return { h: 3, min: 0 };
  return { h: parseInt(m[1], 10), min: parseInt(m[2], 10) };
}

/** Estimativa no relógio local do navegador; o backend usa o relógio do servidor (ver texto na UI). */
function getNextAutomaticRunDate(config) {
  if (!config?.backupAutoEnabled) return null;
  const { h, min } = parseTimeParts(config.backupAutoTime);
  const now = new Date();

  if (config.backupAutoFrequency === "weekly") {
    const wd = Number(config.backupAutoWeekday);
    const targetD = Number.isNaN(wd) ? 0 : Math.min(6, Math.max(0, wd));
    for (let add = 0; add <= 14; add++) {
      const d = new Date(now);
      d.setDate(now.getDate() + add);
      d.setHours(h, min, 0, 0);
      if (d.getDay() !== targetD) continue;
      if (d.getTime() > now.getTime()) return d;
    }
    return null;
  }

  const d = new Date(now);
  d.setHours(h, min, 0, 0);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatNextAutomaticLine(date, lang, translate) {
  const now = new Date();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
  const time = date.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return translate("platform.backup.nextLineToday", { time });
  if (diffDays === 1) return translate("platform.backup.nextLineTomorrow", { time });
  const weekday = date.toLocaleDateString(lang, { weekday: "long" });
  return translate("platform.backup.nextLineWeekday", { weekday, time });
}

function getTypeChipClass(backupSource, classes) {
  switch (backupSource) {
    case "automatic":
      return classes.chipAuto;
    case "pre_restore":
      return classes.chipPre;
    default:
      return classes.chipManual;
  }
}

export default function PlatformBackup() {
  const classes = useStyles();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [restoreToken, setRestoreToken] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreMeta, setRestoreMeta] = useState(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [restoreExecuting, setRestoreExecuting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [autoConfig, setAutoConfig] = useState(defaultAutoConfig);
  const [savingAuto, setSavingAuto] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, cfgRes] = await Promise.all([
        api.get("/platform/backups"),
        api.get("/platform/backup-config").catch(() => ({ data: null })),
      ]);
      setBackups(Array.isArray(listRes.data?.backups) ? listRes.data.backups : []);
      if (cfgRes.data && typeof cfgRes.data === "object") {
        setAutoConfig({
          ...defaultAutoConfig,
          ...cfgRes.data,
        });
      }
    } catch (e) {
      toastError(e);
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveAuto = async () => {
    setSavingAuto(true);
    try {
      const { data } = await api.put("/platform/backup-config", autoConfig);
      setAutoConfig({ ...defaultAutoConfig, ...data });
      toast.success(i18n.t("platform.backup.toasts.autoSaved"));
    } catch (e) {
      toastError(e);
    } finally {
      setSavingAuto(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post("/platform/backups/generate");
      toast.success(i18n.t("platform.backup.toasts.generated"));
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (fileName) => {
    try {
      const { data } = await api.get(`/platform/backups/download/${encodeURIComponent(fileName)}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toastError(e);
    }
  };

  const openDelete = (fileName) => {
    setDeleteTarget(fileName);
    setDeletePhrase("");
    setDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (deletePhrase.trim() !== DELETE_PHRASE) {
      toast.error(i18n.t("platform.backup.deletePhraseError"));
      return;
    }
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/platform/backups/${encodeURIComponent(deleteTarget)}`);
      toast.success(i18n.t("platform.backup.toasts.deleted"));
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDeletePhrase("");
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setDeleting(false);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setRestoreToken(null);
    setRestorePreview(null);
    setRestoreMeta(null);
    setConfirmPhrase("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/platform/backups/prepare-restore", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setRestoreToken(data.restoreToken);
      setRestorePreview(data.preview);
      setRestoreMeta({
        databaseLooksEmpty: Boolean(data.databaseLooksEmpty),
        existingTablesCount: data.existingTablesCount ?? 0,
        existingCriticalTables: Array.isArray(data.existingCriticalTables)
          ? data.existingCriticalTables
          : [],
        hasPublicDirectoryInZip: Boolean(data.hasPublicDirectoryInZip),
        requiresStrongConfirmation: Boolean(data.requiresStrongConfirmation),
        strongConfirmationPhrases: Array.isArray(data.strongConfirmationPhrases)
          ? data.strongConfirmationPhrases
          : [STRONG_CONFIRM_DEFAULT],
      });
      toast.success(i18n.t("platform.backup.toasts.uploadValidated"));
    } catch (err) {
      toastError(err);
    } finally {
      setUploading(false);
    }
  };

  const requiresStrongConfirmation = Boolean(restoreMeta?.requiresStrongConfirmation);

  const isRestorePhraseValid = () => {
    const trimmed = confirmPhrase.trim();
    if (requiresStrongConfirmation) {
      const allowed = restoreMeta?.strongConfirmationPhrases?.length
        ? restoreMeta.strongConfirmationPhrases
        : [STRONG_CONFIRM_DEFAULT];
      return allowed.includes(trimmed);
    }
    return trimmed === CONFIRM;
  };

  const openRestoreConfirm = () => {
    if (!restoreToken) return;
    if (!isRestorePhraseValid()) {
      toast.error(
        requiresStrongConfirmation
          ? i18n.t("platform.backup.restoreStrongConfirmError")
          : i18n.t("platform.backup.restoreConfirmError")
      );
      return;
    }
    setConfirmOpen(true);
  };

  const executeRestore = async () => {
    setRestoreExecuting(true);
    try {
      const trimmed = confirmPhrase.trim();
      const body = { restoreToken };
      if (requiresStrongConfirmation) {
        body.confirmation = trimmed;
        body.confirmPhrase = trimmed;
      } else {
        body.confirmPhrase = trimmed;
      }
      const { data } = await api.post("/platform/backups/execute-restore", body);
      toast.success(data?.message || i18n.t("platform.backup.toasts.restored"));
      setConfirmOpen(false);
      setRestoreToken(null);
      setRestorePreview(null);
      setRestoreMeta(null);
      setConfirmPhrase("");
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setRestoreExecuting(false);
    }
  };

  const browserTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  }, []);

  const nextAutoDate = useMemo(() => getNextAutomaticRunDate(autoConfig), [autoConfig]);

  const nextAutomaticText = useMemo(() => {
    if (!autoConfig.backupAutoEnabled) {
      return i18n.t("platform.backup.nextDisabled");
    }
    if (!nextAutoDate) {
      return i18n.t("platform.backup.nextUnknown");
    }
    return formatNextAutomaticLine(nextAutoDate, i18n.language, i18n.t.bind(i18n));
  }, [autoConfig.backupAutoEnabled, nextAutoDate, i18n.language]);

  const lastBackup = useMemo(() => (backups.length > 0 ? backups[0] : null), [backups]);

  const hasAutomaticBackup = useMemo(
    () => backups.some((b) => b.backupSource === "automatic"),
    [backups]
  );

  const header = (
    <>
      <Typography variant="overline" color="textSecondary" display="block" style={{ letterSpacing: "0.06em", marginBottom: 4 }}>
        {i18n.t("platform.shell.eyebrow")}
      </Typography>
      <Typography variant="h5" component="h1" color="primary" style={{ fontWeight: 600 }}>
        {i18n.t("platform.backup.title")}
      </Typography>
    </>
  );

  const subtitle = (
    <Typography variant="body2" color="textSecondary" component="p" style={{ margin: 0, maxWidth: 800 }}>
      {i18n.t("platform.backup.subtitle")}
    </Typography>
  );

  return (
    <MainContainer>
      <Box className={classes.page}>
        <AppPageHeader title={header} subtitle={subtitle} />

        <Typography style={{ fontWeight: 600, fontSize: "1.0625rem" }}>
          {i18n.t("platform.backup.sectionGenerate")}
        </Typography>
        <Typography className={classes.hint} style={{ marginBottom: 12 }}>
          {i18n.t("platform.backup.sectionGenerateHint")}
        </Typography>

        <AppSectionCard>
          <AppActionBar style={{ marginBottom: 8 }}>
            <AppPrimaryButton
              startIcon={<BackupIcon />}
              onClick={handleGenerate}
              disabled={generating}
              loading={generating}
            >
              {i18n.t("platform.backup.generate")}
            </AppPrimaryButton>
          </AppActionBar>
          <Typography className={classes.hint}>{i18n.t("platform.backup.generateHint")}</Typography>
        </AppSectionCard>

        <Typography style={{ fontWeight: 600, fontSize: "1.0625rem" }}>
          {i18n.t("platform.backup.sectionAuto")}
        </Typography>
        <Typography className={classes.hint} style={{ marginBottom: 12 }}>
          {i18n.t("platform.backup.sectionAutoHint")}
        </Typography>

        <AppSectionCard>
          <Box className={classes.autoLayout}>
            <Paper className={classes.summaryPaper} elevation={0}>
              <Typography className={classes.summaryLabel} style={{ marginBottom: 10 }}>
                {i18n.t("platform.backup.summaryTitle")}
              </Typography>
              <Box className={classes.summaryRow}>
                <Typography component="span" className={classes.summaryLabel}>
                  {i18n.t("platform.backup.summaryStatus")}
                </Typography>
                <Chip
                  size="small"
                  label={
                    autoConfig.backupAutoEnabled
                      ? i18n.t("platform.backup.statusActive")
                      : i18n.t("platform.backup.statusInactive")
                  }
                  color={autoConfig.backupAutoEnabled ? "primary" : "default"}
                />
              </Box>
              <Box className={classes.summaryRow}>
                <Typography component="span" className={classes.summaryLabel}>
                  {i18n.t("platform.backup.summarySchedule")}
                </Typography>
                <Typography className={classes.summaryValue}>
                  {autoConfig.backupAutoFrequency === "weekly"
                    ? `${i18n.t("platform.backup.freqWeekly")} · ${i18n.t(
                        `platform.backup.weekdays.${autoConfig.backupAutoWeekday}`
                      )} · ${autoConfig.backupAutoTime || "03:00"}`
                    : `${i18n.t("platform.backup.freqDaily")} · ${autoConfig.backupAutoTime || "03:00"}`}
                </Typography>
              </Box>
              <Box className={classes.summaryRow}>
                <Typography component="span" className={classes.summaryLabel}>
                  {i18n.t("platform.backup.summaryRetentionShort")}
                </Typography>
                <Typography className={classes.summaryValue}>
                  {i18n.t("platform.backup.retentionValue", { n: autoConfig.backupAutoRetention ?? 7 })}
                </Typography>
              </Box>
              <Box className={classes.nextBackupBox}>
                <Typography className={classes.summaryLabel} style={{ marginBottom: 6 }}>
                  {i18n.t("platform.backup.nextTitle")}
                </Typography>
                <Typography variant="body2" style={{ fontWeight: 500, lineHeight: 1.45 }}>
                  {nextAutomaticText}
                </Typography>
                {autoConfig.backupAutoEnabled ? (
                  <Typography className={classes.tzHint}>{i18n.t("platform.backup.nextEstimateHint")}</Typography>
                ) : null}
              </Box>
              <Typography className={classes.tzHint}>{i18n.t("platform.backup.timezoneNote")}</Typography>
              {browserTimeZone ? (
                <Typography className={classes.tzHint}>{i18n.t("platform.backup.browserTz", { tz: browserTimeZone })}</Typography>
              ) : null}
            </Paper>

            <Box className={classes.autoForm}>
              <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 4 }}>
                {i18n.t("platform.backup.formTitle")}
              </Typography>
              <Typography className={classes.tzHint} style={{ marginBottom: 8 }}>
                {i18n.t("platform.backup.formSubtitle")}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={Boolean(autoConfig.backupAutoEnabled)}
                    onChange={(e) => setAutoConfig((c) => ({ ...c, backupAutoEnabled: e.target.checked }))}
                  />
                }
                label={i18n.t("platform.backup.autoEnabled")}
              />
              <FormControl variant="outlined" size="small">
                <InputLabel id="backup-freq-label">{i18n.t("platform.backup.autoFrequency")}</InputLabel>
                <Select
                  labelId="backup-freq-label"
                  label={i18n.t("platform.backup.autoFrequency")}
                  value={autoConfig.backupAutoFrequency || "daily"}
                  onChange={(e) => setAutoConfig((c) => ({ ...c, backupAutoFrequency: e.target.value }))}
                >
                  <MenuItem value="daily">{i18n.t("platform.backup.freqDaily")}</MenuItem>
                  <MenuItem value="weekly">{i18n.t("platform.backup.freqWeekly")}</MenuItem>
                </Select>
              </FormControl>
              <TextField
                variant="outlined"
                size="small"
                label={i18n.t("platform.backup.autoTime")}
                type="time"
                InputLabelProps={{ shrink: true }}
                value={autoConfig.backupAutoTime || "03:00"}
                onChange={(e) => setAutoConfig((c) => ({ ...c, backupAutoTime: e.target.value }))}
              />
              {autoConfig.backupAutoFrequency === "weekly" ? (
                <FormControl variant="outlined" size="small">
                  <InputLabel id="backup-wd-label">{i18n.t("platform.backup.autoWeekday")}</InputLabel>
                  <Select
                    labelId="backup-wd-label"
                    label={i18n.t("platform.backup.autoWeekday")}
                    value={autoConfig.backupAutoWeekday}
                    onChange={(e) => setAutoConfig((c) => ({ ...c, backupAutoWeekday: Number(e.target.value) }))}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                      <MenuItem key={d} value={d}>
                        {i18n.t(`platform.backup.weekdays.${d}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
              <TextField
                variant="outlined"
                size="small"
                type="number"
                inputProps={{ min: 1, max: 365 }}
                label={i18n.t("platform.backup.autoRetention")}
                value={autoConfig.backupAutoRetention}
                onChange={(e) => setAutoConfig((c) => ({ ...c, backupAutoRetention: Number(e.target.value) }))}
                helperText={i18n.t("platform.backup.autoRetentionHint")}
              />
              <AppPrimaryButton onClick={handleSaveAuto} loading={savingAuto} disabled={savingAuto}>
                {i18n.t("platform.backup.saveAuto")}
              </AppPrimaryButton>
            </Box>
          </Box>
        </AppSectionCard>

        <Typography style={{ fontWeight: 600, fontSize: "1.0625rem" }}>
          {i18n.t("platform.backup.sectionList")}
        </Typography>
        <Typography className={classes.hint} style={{ marginBottom: 8 }}>
          {i18n.t("platform.backup.sectionListHint")}
        </Typography>

        {!loading && backups.length > 0 ? (
          <Box className={classes.insightRow}>
            <Paper className={classes.insightCard} elevation={0}>
              <Typography className={classes.insightLabel}>{i18n.t("platform.backup.lastTitle")}</Typography>
              <Typography className={classes.insightValue}>
                {lastBackup?.createdAt
                  ? new Date(lastBackup.createdAt).toLocaleString(i18n.language)
                  : "—"}
              </Typography>
              <Typography className={classes.insightMuted}>
                {typeLabel(lastBackup?.backupSource)} · {formatBytes(lastBackup?.sizeBytes)}
              </Typography>
            </Paper>
            <Paper className={classes.insightCard} elevation={0}>
              <Typography className={classes.insightLabel}>{i18n.t("platform.backup.nextCardTitle")}</Typography>
              <Typography className={classes.insightValue}>{nextAutomaticText}</Typography>
              {autoConfig.backupAutoEnabled ? (
                <Typography className={classes.insightMuted}>{i18n.t("platform.backup.nextCardHint")}</Typography>
              ) : (
                <Typography className={classes.insightMuted}>{i18n.t("platform.backup.nextCardOff")}</Typography>
              )}
            </Paper>
          </Box>
        ) : null}

        {autoConfig.backupAutoEnabled && !hasAutomaticBackup && !loading && backups.length > 0 ? (
          <Box style={{ marginBottom: 16 }}>
            <Typography variant="body2" color="textSecondary" style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}>
              {i18n.t("platform.backup.autoPendingHint")}
            </Typography>
          </Box>
        ) : null}

        {loading ? (
          <AppLoadingState message={i18n.t("platform.backup.loading")} />
        ) : backups.length === 0 ? (
          <AppEmptyState
            title={i18n.t("platform.backup.empty")}
            description={
              autoConfig.backupAutoEnabled
                ? i18n.t("platform.backup.emptyHintAutoOn")
                : i18n.t("platform.backup.emptyHint")
            }
          />
        ) : (
          <AppTableContainer nested>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell className={classes.tableHead}>{i18n.t("platform.backup.colDate")}</TableCell>
                  <TableCell className={classes.tableHead}>{i18n.t("platform.backup.colFile")}</TableCell>
                  <TableCell className={classes.tableHead} align="right">
                    {i18n.t("platform.backup.colSize")}
                  </TableCell>
                  <TableCell className={classes.tableHead}>{i18n.t("platform.backup.colType")}</TableCell>
                  <TableCell className={classes.tableHead}>{i18n.t("platform.backup.colStatus")}</TableCell>
                  <TableCell className={classes.tableHead} align="right">
                    {i18n.t("platform.backup.colActions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.map((b, index) => (
                  <TableRow key={b.fileName} className={index === 0 ? classes.rowRecent : undefined}>
                    <TableCell>
                      {index === 0 ? (
                        <span className={classes.recentPill}>{i18n.t("platform.backup.badgeRecent")}</span>
                      ) : null}
                      {b.createdAt ? new Date(b.createdAt).toLocaleString(i18n.language) : "—"}
                    </TableCell>
                    <TableCell style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{b.fileName}</TableCell>
                    <TableCell align="right">{formatBytes(b.sizeBytes)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={typeLabel(b.backupSource)}
                        className={getTypeChipClass(b.backupSource, classes)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          b.status === "ok"
                            ? i18n.t("platform.backup.statusOk")
                            : i18n.t("platform.backup.statusInvalid")
                        }
                        color={b.status === "ok" ? "primary" : "default"}
                        variant={b.status === "ok" ? "default" : "outlined"}
                      />
                    </TableCell>
                    <TableCell align="right" className={classes.actionsCell}>
                      <AppSecondaryButton
                        size="small"
                        startIcon={<GetAppIcon />}
                        onClick={() => handleDownload(b.fileName)}
                        disabled={b.status !== "ok"}
                        style={{ marginRight: 4 }}
                      >
                        {i18n.t("platform.backup.download")}
                      </AppSecondaryButton>
                      <IconButton
                        size="small"
                        aria-label={i18n.t("platform.backup.delete")}
                        onClick={() => openDelete(b.fileName)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AppTableContainer>
        )}

        <Typography style={{ fontWeight: 600, fontSize: "1.0625rem", marginTop: 8 }}>
          {i18n.t("platform.backup.sectionRestore")}
        </Typography>
        <Typography className={classes.hint} style={{ marginBottom: 16 }}>
          {i18n.t("platform.backup.restoreIntro")}
        </Typography>

        <AppSectionCard>
          <Box className={classes.restoreBox}>
            <input
              accept=".zip,application/zip"
              style={{ display: "none" }}
              id="backup-restore-upload"
              type="file"
              onChange={handleFile}
            />
            <label htmlFor="backup-restore-upload">
              <Button variant="outlined" component="span" startIcon={<CloudUploadIcon />} disabled={uploading}>
                {i18n.t("platform.backup.selectFile")}
              </Button>
            </label>
            {restorePreview ? (
              <Box>
                <Typography variant="subtitle2">{i18n.t("platform.backup.previewTitle")}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {i18n.t("platform.backup.previewDb", { name: restorePreview.dbName || "—" })}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {i18n.t("platform.backup.previewDialect", { d: restorePreview.dbDialect || "—" })}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {i18n.t("platform.backup.previewVersion", { v: restorePreview.appVersion || "—" })}
                </Typography>
                {restoreMeta ? (
                  <>
                    <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
                      {i18n.t("platform.backup.previewPublic", {
                        ok: restoreMeta.hasPublicDirectoryInZip
                          ? i18n.t("platform.backup.previewPublicYes")
                          : i18n.t("platform.backup.previewPublicNo"),
                      })}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {i18n.t("platform.backup.previewTables", {
                        count: restoreMeta.existingTablesCount ?? 0,
                      })}
                    </Typography>
                  </>
                ) : null}
              </Box>
            ) : null}
            {restoreMeta?.requiresStrongConfirmation ? (
              <Alert severity="warning">
                <Typography variant="body2" component="div">
                  {i18n.t("platform.backup.restoreDbNotEmptyWarning")}
                </Typography>
                {restoreMeta.existingCriticalTables
                  ?.filter((t) => t.exists && t.rowCount > 0)
                  .map((t) => (
                    <Typography key={t.name} variant="caption" display="block" color="inherit">
                      {t.name}: {t.rowCount} {i18n.t("platform.backup.restoreRowsLabel")}
                    </Typography>
                  ))}
              </Alert>
            ) : restoreMeta && restoreMeta.databaseLooksEmpty ? (
              <Alert severity="info">
                <Typography variant="body2">{i18n.t("platform.backup.restoreDbEmptyInfo")}</Typography>
              </Alert>
            ) : null}
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              label={i18n.t("platform.backup.confirmLabel")}
              placeholder={
                requiresStrongConfirmation ? STRONG_CONFIRM_DEFAULT : CONFIRM
              }
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              helperText={
                requiresStrongConfirmation
                  ? i18n.t("platform.backup.confirmStrongHelper")
                  : i18n.t("platform.backup.confirmHelper")
              }
            />
            <AppPrimaryButton
              onClick={openRestoreConfirm}
              disabled={!restoreToken || restoreExecuting || uploading}
              loading={restoreExecuting}
            >
              {i18n.t("platform.backup.restoreButton")}
            </AppPrimaryButton>
          </Box>
        </AppSectionCard>

        <Typography className={classes.hint}>{i18n.t("platform.backup.futureHint")}</Typography>
      </Box>

      <ConfirmationModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeRestore}
        title={i18n.t("platform.backup.modalTitle")}
        confirmText={i18n.t("platform.backup.modalConfirm")}
        destructive
      >
        {requiresStrongConfirmation
          ? i18n.t("platform.backup.modalBodyStrong")
          : i18n.t("platform.backup.modalBody")}
      </ConfirmationModal>

      <AppDialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <AppDialogTitle>{i18n.t("platform.backup.deleteTitle")}</AppDialogTitle>
        <AppDialogContent dividers>
          <Typography variant="body2" gutterBottom>
            {i18n.t("platform.backup.deleteBody")}
          </Typography>
          <Typography variant="body2" color="textSecondary" style={{ fontFamily: "monospace", marginBottom: 16 }}>
            {deleteTarget}
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label={i18n.t("platform.backup.deleteConfirmLabel")}
            placeholder={DELETE_PHRASE}
            value={deletePhrase}
            onChange={(e) => setDeletePhrase(e.target.value)}
            helperText={i18n.t("platform.backup.deleteConfirmHelper")}
          />
        </AppDialogContent>
        <AppDialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            {i18n.t("confirmationModal.buttons.cancel")}
          </Button>
          <Button
            variant="contained"
            className={classes.confirmDanger}
            onClick={executeDelete}
            disabled={deleting || deletePhrase.trim() !== DELETE_PHRASE}
          >
            {i18n.t("platform.backup.deleteConfirmButton")}
          </Button>
        </AppDialogActions>
      </AppDialog>
    </MainContainer>
  );
}
