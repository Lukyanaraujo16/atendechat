import React, { useCallback, useEffect, useRef, useState } from "react";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContentText from "@material-ui/core/DialogContentText";
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import FormHelperText from "@material-ui/core/FormHelperText";
import CircularProgress from "@material-ui/core/CircularProgress";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffOutlinedIcon from "@material-ui/icons/HighlightOffOutlined";
import VisibilityOutlinedIcon from "@material-ui/icons/VisibilityOutlined";
import MailOutlineIcon from "@material-ui/icons/MailOutline";
import SearchIcon from "@material-ui/icons/Search";
import { makeStyles, alpha, useTheme } from "@material-ui/core/styles";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { AppSectionCard, AppPrimaryButton, AppSecondaryButton } from "../../ui";
import AppTableContainer from "../../ui/components/AppTableContainer";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import PlatformPageHeader from "./PlatformPageHeader";
import {
  notifySignupSummaryStale,
  SIGNUP_REALTIME_EVENT,
} from "../../helpers/signupSummaryBus";

function dateLocale() {
  const lang = (i18n.language || "pt").split("-")[0];
  if (lang === "en") return "en-GB";
  if (lang === "es") return "es-ES";
  return "pt-PT";
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(dateLocale(), {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function signupOnboardingStageKey(row) {
  if (!row) return "stagePending";
  if (row.status === "rejected") return "stageRejected";
  if (row.status === "activated") return "stageActivated";
  if (row.status === "pending") return "stagePending";
  if (row.status === "approved" && !row.invitationSentAt) return "stageApprovedNoInvite";
  return "stageInvited";
}

function alertTranslationKey(code) {
  return `platform.signupRequests.alert${code}`;
}

function rowHasUrgentAlert(row) {
  return Array.isArray(row?.alerts) && row.alerts.some((a) => a.severity === "error");
}

function canResendInvite(row) {
  if (!row?.createdCompanyId) return false;
  if (row.status !== "approved" && row.status !== "invited") return false;
  return true;
}

const FILTER_OPTIONS = [
  { value: "new", labelKey: "platform.signupRequests.filterNew" },
  { value: "critical", labelKey: "platform.signupRequests.filterCritical" },
  { value: "pending", labelKey: "platform.signupRequests.filterPending" },
  { value: "invited", labelKey: "platform.signupRequests.filterInvited" },
  { value: "not_activated", labelKey: "platform.signupRequests.filterNotActivated" },
  { value: "activated", labelKey: "platform.signupRequests.filterActivated" },
  { value: "rejected", labelKey: "platform.signupRequests.filterRejected" },
  { value: "all", labelKey: "platform.signupRequests.filterAll" },
];

/** Contadores: `palette` define fundo suave; filtro = valor enviado à API. */
const SUMMARY_CARD_DEFS = [
  { filter: "new", countKey: "newCount", labelKey: "platform.signupRequests.summaryNew", palette: "info" },
  {
    filter: "critical",
    countKey: "criticalCount",
    labelKey: "platform.signupRequests.summaryCritical",
    palette: "error",
  },
  {
    filter: "pending",
    countKey: "pendingCount",
    labelKey: "platform.signupRequests.summaryPending",
    palette: "warning",
  },
  {
    filter: "not_activated",
    countKey: "awaitingActivationCount",
    labelKey: "platform.signupRequests.summaryAwaiting",
    palette: "warning",
  },
  {
    filter: "rejected",
    countKey: "rejectedCount",
    labelKey: "platform.signupRequests.summaryRejected",
    palette: "neutral",
  },
];

function summaryCardTint(theme, paletteKey) {
  if (paletteKey === "info") return alpha(theme.palette.info.main, 0.1);
  if (paletteKey === "warning") return alpha(theme.palette.warning.main, 0.12);
  if (paletteKey === "error") return alpha(theme.palette.error.main, 0.1);
  return alpha(theme.palette.grey[500], 0.08);
}

const useStyles = makeStyles((theme) => ({
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    alignItems: "center",
  },
  filterChip: {
    fontWeight: 600,
    fontSize: "0.8125rem",
  },
  filterChipSelected: {
    boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.35)}`,
  },
  searchField: {
    minWidth: 260,
    flex: "1 1 220px",
    maxWidth: 400,
  },
  tableHead: {
    fontWeight: 600,
    fontSize: "0.6875rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: theme.palette.text.secondary,
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.common.white, 0.04)
        : alpha(theme.palette.common.black, 0.03),
  },
  tableRow: {
    transition: theme.transitions.create(["background-color", "box-shadow"], { duration: 160 }),
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? alpha(theme.palette.common.white, 0.06)
          : alpha(theme.palette.primary.main, 0.06),
      boxShadow:
        theme.palette.type === "dark"
          ? `inset 0 0 0 1px ${alpha(theme.palette.common.white, 0.08)}`
          : `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.12)}`,
    },
  },
  tableRowUrgent: {
    backgroundColor: alpha(theme.palette.error.main, theme.palette.type === "dark" ? 0.1 : 0.06),
    boxShadow: `inset 3px 0 0 ${theme.palette.error.main}`,
  },
  alertChip: {
    maxWidth: "100%",
    fontSize: "0.7rem",
    fontWeight: 600,
    height: 22,
  },
  summaryStrip: {
    marginBottom: theme.spacing(2),
  },
  summaryCardsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1),
  },
  summaryCard: {
    flex: "1 1 108px",
    maxWidth: 200,
    minWidth: 96,
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    cursor: "pointer",
    transition: theme.transitions.create(["box-shadow", "border-color", "background-color"], {
      duration: 160,
    }),
  },
  summaryCardLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: theme.palette.text.secondary,
    lineHeight: 1.2,
  },
  summaryCardCount: {
    fontSize: "1.5rem",
    fontWeight: 700,
    lineHeight: 1.2,
    marginTop: 4,
  },
  cellMuted: {
    color: theme.palette.text.secondary,
    fontSize: "0.8125rem",
  },
  actionsCell: {
    whiteSpace: "nowrap",
    textAlign: "right",
  },
  detailLabel: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: "0.9375rem",
    marginBottom: theme.spacing(1.5),
    wordBreak: "break-word",
  },
  approveList: {
    margin: theme.spacing(1, 0, 0, 0),
    paddingLeft: theme.spacing(2.5),
    "& li": { marginBottom: theme.spacing(0.75) },
  },
}));

function StatusBadge({ status }) {
  const labelKey = `platform.signupRequests.status${status.charAt(0).toUpperCase() + status.slice(1)}`;
  const raw = i18n.t(labelKey);
  const label = raw !== labelKey ? raw : status;
  const theme = useTheme();
  const palette = (() => {
    if (status === "pending") {
      return {
        bg: alpha(theme.palette.primary.main, 0.14),
        color: theme.palette.primary.main,
      };
    }
    if (status === "approved") {
      return {
        bg: alpha(theme.palette.warning.main, 0.18),
        color: theme.palette.warning.dark,
      };
    }
    if (status === "invited") {
      return {
        bg: alpha(theme.palette.info.main, 0.16),
        color: theme.palette.info.dark,
      };
    }
    if (status === "activated") {
      return {
        bg: alpha(theme.palette.success.main, 0.18),
        color: theme.palette.success.dark,
      };
    }
    if (status === "rejected") {
      return {
        bg: alpha(theme.palette.error.main, 0.12),
        color: theme.palette.error.dark,
      };
    }
    return { bg: alpha(theme.palette.grey[500], 0.15), color: theme.palette.text.secondary };
  })();
  return (
    <Chip
      size="small"
      label={label}
      style={{ backgroundColor: palette.bg, color: palette.color, fontWeight: 600 }}
    />
  );
}

function AlertChips({ alerts, className }) {
  const theme = useTheme();
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return (
      <Typography variant="caption" color="textSecondary">
        —
      </Typography>
    );
  }
  return (
    <Box display="flex" flexWrap="wrap" style={{ gap: 4 }}>
      {alerts.map((a) => {
        const key = alertTranslationKey(a.code);
        const raw = i18n.t(key);
        const label = raw !== key ? raw : a.code;
        const palette =
          a.severity === "error"
            ? { bg: alpha(theme.palette.error.main, 0.15), fg: theme.palette.error.dark }
            : a.severity === "warning"
              ? { bg: alpha(theme.palette.warning.main, 0.2), fg: theme.palette.warning.dark }
              : { bg: alpha(theme.palette.info.main, 0.16), fg: theme.palette.info.dark };
        return (
          <Tooltip key={a.code} title={label}>
            <Chip
              size="small"
              className={className || undefined}
              label={label.length > 42 ? `${label.slice(0, 40)}…` : label}
              style={{
                backgroundColor: palette.bg,
                color: palette.fg,
                fontWeight: 600,
                maxWidth: 220,
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

const EMPTY_SUMMARY = {
  newCount: 0,
  pendingCount: 0,
  awaitingActivationCount: 0,
  criticalCount: 0,
  rejectedCount: 0,
};

export default function PlatformSignupRequests() {
  const classes = useStyles();
  const theme = useTheme();
  const [filter, setFilter] = useState("pending");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState(null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveRow, setApproveRow] = useState(null);
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRow, setRejectRow] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [resendOpen, setResendOpen] = useState(false);
  const [resendRow, setResendRow] = useState(null);
  const [resendSubmitting, setResendSubmitting] = useState(false);

  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [credentialsPayload, setCredentialsPayload] = useState(null);

  const realtimeReloadTimerRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 320);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: filter };
      if (debouncedSearch.length >= 2) {
        params.search = debouncedSearch;
      }
      const { data } = await api.get("/platform/signup-requests", { params });
      if (data && Array.isArray(data.requests)) {
        setRows(data.requests);
        setSummary({ ...EMPTY_SUMMARY, ...(data.summary || {}) });
      } else {
        setRows([]);
        setSummary(EMPTY_SUMMARY);
      }
    } catch (e) {
      toastError(e);
      setRows([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onRealtime = (e) => {
      const p = e.detail;
      if (p && p.summary && typeof p.summary === "object") {
        setSummary((prev) => ({ ...EMPTY_SUMMARY, ...prev, ...p.summary }));
      }
      if (realtimeReloadTimerRef.current) {
        clearTimeout(realtimeReloadTimerRef.current);
      }
      realtimeReloadTimerRef.current = setTimeout(() => {
        realtimeReloadTimerRef.current = null;
        load();
      }, 450);
    };
    window.addEventListener(SIGNUP_REALTIME_EVENT, onRealtime);
    return () => {
      window.removeEventListener(SIGNUP_REALTIME_EVENT, onRealtime);
      if (realtimeReloadTimerRef.current) {
        clearTimeout(realtimeReloadTimerRef.current);
      }
    };
  }, [load]);

  const openDetails = (row) => {
    setDetailsRow(row);
    setDetailsOpen(true);
  };

  const openApprove = (row) => {
    setApproveRow(row);
    setApproveOpen(true);
  };

  const confirmApprove = async () => {
    if (!approveRow) return;
    setApproveSubmitting(true);
    try {
      const { data } = await api.post(`/platform/signup-requests/${approveRow.id}/approve`);
      if (data?.status === "invited") {
        toast.success(i18n.t("platform.signupRequests.toastApprovedInviteSent"));
      } else if (data?.status === "approved") {
        toast.info(i18n.t("platform.signupRequests.toastApprovedInvitePending"));
      } else {
        toast.success(i18n.t("platform.signupRequests.toastApproved"));
      }
      if (data?.primaryAdminCredentials) {
        setCredentialsPayload(data.primaryAdminCredentials);
        setCredentialsOpen(true);
      }
      setApproveOpen(false);
      setApproveRow(null);
      await load();
      notifySignupSummaryStale();
    } catch (e) {
      toastError(e);
    } finally {
      setApproveSubmitting(false);
    }
  };

  const openReject = (row) => {
    setRejectRow(row);
    setRejectReason("");
    setRejectOpen(true);
  };

  const openResendConfirm = (row) => {
    setResendRow(row);
    setResendOpen(true);
  };

  const confirmResendInvite = async () => {
    if (!resendRow) return;
    setResendSubmitting(true);
    try {
      const { data } = await api.post(`/platform/signup-requests/${resendRow.id}/resend-invite`);
      toast.success(i18n.t("platform.signupRequests.toastResendInviteOk"));
      setResendOpen(false);
      const updated = data;
      setResendRow(null);
      if (detailsOpen && detailsRow && updated?.id === detailsRow.id) {
        setDetailsRow(updated);
      }
      await load();
      notifySignupSummaryStale();
    } catch (e) {
      toastError(e);
    } finally {
      setResendSubmitting(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectRow) return;
    const reason = rejectReason.trim();
    if (!reason) {
      const ok = window.confirm(i18n.t("platform.signupRequests.rejectWithoutReasonConfirm"));
      if (!ok) return;
    }
    setRejectSubmitting(true);
    try {
      await api.post(`/platform/signup-requests/${rejectRow.id}/reject`, {
        reason: reason || null,
      });
      toast.success(i18n.t("platform.signupRequests.toastRejected"));
      setRejectOpen(false);
      setRejectRow(null);
      await load();
      notifySignupSummaryStale();
    } catch (e) {
      toastError(e);
    } finally {
      setRejectSubmitting(false);
    }
  };

  return (
    <MainContainer>
      <Box display="flex" flexDirection="column" style={{ gap: 20 }}>
        <PlatformPageHeader
          titleKey="platform.signupRequests.title"
          subtitleKey="platform.signupRequests.subtitle"
        />
        <AppSectionCard>
          <div className={classes.summaryStrip}>
            <Typography variant="caption" color="textSecondary" display="block">
              {i18n.t("platform.signupRequests.summaryIntro")}
            </Typography>
            <div className={classes.summaryCardsRow}>
              {SUMMARY_CARD_DEFS.map((def) => {
                const selected = filter === def.filter;
                const count = summary[def.countKey] ?? 0;
                return (
                  <Paper
                    key={def.filter}
                    elevation={0}
                    className={classes.summaryCard}
                    onClick={() => setFilter(def.filter)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setFilter(def.filter);
                      }
                    }}
                    style={{
                      backgroundColor: summaryCardTint(theme, def.palette),
                      border: selected
                        ? `2px solid ${theme.palette.primary.main}`
                        : `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <div className={classes.summaryCardLabel}>{i18n.t(def.labelKey)}</div>
                    <div className={classes.summaryCardCount}>{count}</div>
                  </Paper>
                );
              })}
            </div>
          </div>
          <div className={classes.toolbar}>
            <div className={classes.chipRow}>
              {FILTER_OPTIONS.map((opt) => {
                const selected = filter === opt.value;
                return (
                  <Chip
                    key={opt.value}
                    label={i18n.t(opt.labelKey)}
                    clickable
                    color={selected ? "primary" : "default"}
                    variant={selected ? "default" : "outlined"}
                    className={`${classes.filterChip} ${selected ? classes.filterChipSelected : ""}`}
                    onClick={() => setFilter(opt.value)}
                  />
                );
              })}
            </div>
            <TextField
              className={classes.searchField}
              size="small"
              variant="outlined"
              placeholder={i18n.t("platform.signupRequests.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </div>
          <FormHelperText style={{ marginTop: -8, marginBottom: 16 }}>
            {i18n.t("platform.signupRequests.searchHint")}
          </FormHelperText>

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={36} />
            </Box>
          ) : rows.length === 0 ? (
            <Typography color="textSecondary" component="p" style={{ margin: "16px 0" }}>
              {i18n.t("platform.signupRequests.empty")}
            </Typography>
          ) : (
            <AppTableContainer nested>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell className={classes.tableHead}>
                      {i18n.t("platform.signupRequests.colCompany")}
                    </TableCell>
                    <TableCell className={classes.tableHead}>
                      {i18n.t("platform.signupRequests.colAdmin")}
                    </TableCell>
                    <TableCell className={classes.tableHead}>
                      {i18n.t("platform.signupRequests.colEmail")}
                    </TableCell>
                    <TableCell className={classes.tableHead}>
                      {i18n.t("platform.signupRequests.colPhone")}
                    </TableCell>
                    <TableCell className={classes.tableHead}>
                      {i18n.t("platform.signupRequests.colDate")}
                    </TableCell>
                    <TableCell className={classes.tableHead}>
                      {i18n.t("platform.signupRequests.colStatus")}
                    </TableCell>
                    <TableCell className={classes.tableHead}>
                      {i18n.t("platform.signupRequests.colAlerts")}
                    </TableCell>
                    <TableCell className={classes.tableHead} align="right">
                      {i18n.t("platform.signupRequests.colActions")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={`${classes.tableRow} ${rowHasUrgentAlert(row) ? classes.tableRowUrgent : ""}`}
                      hover
                    >
                      <TableCell>
                        <Typography variant="body2" style={{ fontWeight: 600 }}>
                          {row.companyName}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.adminName}</TableCell>
                      <TableCell className={classes.cellMuted}>{row.email}</TableCell>
                      <TableCell className={classes.cellMuted}>{row.phone || "—"}</TableCell>
                      <TableCell className={classes.cellMuted}>
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" flexDirection="column" alignItems="flex-start" style={{ gap: 6 }}>
                          <Box display="flex" flexWrap="wrap" alignItems="center" style={{ gap: 6 }}>
                            <StatusBadge status={row.status} />
                            {row.isNewPendingHighlight ? (
                              <Chip
                                size="small"
                                label={i18n.t("platform.signupRequests.badgeNew")}
                                style={{ fontWeight: 700, height: 22 }}
                                color="secondary"
                              />
                            ) : null}
                          </Box>
                          {row.status === "pending" &&
                          row.pendingDays != null &&
                          row.pendingDays > 0 ? (
                            <Typography variant="caption" color="textSecondary" component="span">
                              {i18n.t("platform.signupRequests.pendingSince", { days: row.pendingDays })}
                            </Typography>
                          ) : null}
                        </Box>
                      </TableCell>
                      <TableCell style={{ maxWidth: 280 }}>
                        <AlertChips alerts={row.alerts} className={classes.alertChip} />
                      </TableCell>
                      <TableCell className={classes.actionsCell}>
                        <Tooltip title={i18n.t("platform.signupRequests.tooltipDetails")}>
                          <IconButton
                            size="small"
                            aria-label={i18n.t("platform.signupRequests.tooltipDetails")}
                            onClick={() => openDetails(row)}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {canResendInvite(row) ? (
                          <Tooltip title={i18n.t("platform.signupRequests.resendInviteTooltip")}>
                            <IconButton
                              size="small"
                              color="primary"
                              aria-label={i18n.t("platform.signupRequests.resendInviteTooltip")}
                              onClick={() => openResendConfirm(row)}
                            >
                              <MailOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                        {row.status === "pending" ? (
                          <>
                            <Tooltip title={i18n.t("platform.signupRequests.tooltipApprove")}>
                              <IconButton
                                size="small"
                                color="primary"
                                aria-label={i18n.t("platform.signupRequests.tooltipApprove")}
                                onClick={() => openApprove(row)}
                              >
                                <CheckCircleOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={i18n.t("platform.signupRequests.tooltipReject")}>
                              <IconButton
                                size="small"
                                aria-label={i18n.t("platform.signupRequests.tooltipReject")}
                                onClick={() => openReject(row)}
                              >
                                <HighlightOffOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AppTableContainer>
          )}
        </AppSectionCard>
      </Box>

      {/* Detalhes */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{i18n.t("platform.signupRequests.detailsTitle")}</DialogTitle>
        <DialogContent dividers>
          {detailsRow ? (
            <>
              <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.colCompany")}</div>
              <div className={classes.detailValue}>{detailsRow.companyName}</div>
              <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.colAdmin")}</div>
              <div className={classes.detailValue}>{detailsRow.adminName}</div>
              <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.colEmail")}</div>
              <div className={classes.detailValue}>{detailsRow.email}</div>
              <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.colPhone")}</div>
              <div className={classes.detailValue}>{detailsRow.phone || "—"}</div>
              <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.detailPlan")}</div>
              <div className={classes.detailValue}>{detailsRow.plan?.name || "—"}</div>
              <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.detailNotes")}</div>
              <div className={classes.detailValue}>{detailsRow.notes || "—"}</div>
              <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.colDate")}</div>
              <div className={classes.detailValue}>{formatDateTime(detailsRow.createdAt)}</div>
              <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.detailOnboardingStage")}</div>
              <div className={classes.detailValue}>
                {i18n.t(`platform.signupRequests.${signupOnboardingStageKey(detailsRow)}`)}
              </div>
              <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.colStatus")}</div>
              <div className={classes.detailValue}>
                <StatusBadge status={detailsRow.status} />
              </div>
              {detailsRow.status === "approved" && !detailsRow.invitationSentAt ? (
                <Typography variant="caption" color="textSecondary" display="block" style={{ marginBottom: 16 }}>
                  {i18n.t("platform.signupRequests.detailApprovedHint")}
                </Typography>
              ) : null}
              {detailsRow.approvedAt ? (
                <>
                  <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.detailApprovedAt")}</div>
                  <div className={classes.detailValue}>{formatDateTime(detailsRow.approvedAt)}</div>
                </>
              ) : null}
              {detailsRow.rejectedAt ? (
                <>
                  <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.detailRejectedAt")}</div>
                  <div className={classes.detailValue}>{formatDateTime(detailsRow.rejectedAt)}</div>
                </>
              ) : null}
              {detailsRow.firstInvitationSentAt ? (
                <>
                  <div className={classes.detailLabel}>
                    {i18n.t("platform.signupRequests.detailFirstInvitationSentAt")}
                  </div>
                  <div className={classes.detailValue}>{formatDateTime(detailsRow.firstInvitationSentAt)}</div>
                </>
              ) : null}
              {detailsRow.invitationSentAt ? (
                <>
                  <div className={classes.detailLabel}>
                    {i18n.t("platform.signupRequests.detailInvitationSentAt")}
                  </div>
                  <div className={classes.detailValue}>{formatDateTime(detailsRow.invitationSentAt)}</div>
                </>
              ) : null}
              <div className={classes.detailLabel}>
                {i18n.t("platform.signupRequests.detailInvitationResentCount")}
              </div>
              <div className={classes.detailValue}>
                {detailsRow.invitationResentCount != null && detailsRow.invitationResentCount > 0
                  ? String(detailsRow.invitationResentCount)
                  : i18n.t("platform.signupRequests.detailInvitationResentNever")}
              </div>
              {Array.isArray(detailsRow.invitationResentHistory) &&
              detailsRow.invitationResentHistory.length > 0 ? (
                <>
                  <div className={classes.detailLabel}>
                    {i18n.t("platform.signupRequests.detailInvitationResentHistory")}
                  </div>
                  <div className={classes.detailValue}>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {detailsRow.invitationResentHistory
                        .slice(-8)
                        .reverse()
                        .map((entry, idx) => (
                          <li key={`${entry.at}-${idx}`}>
                            <Typography variant="body2" component="span">
                              {formatDateTime(entry.at)}
                              {entry.byUserId != null ? ` · ID ${entry.byUserId}` : ""}
                            </Typography>
                          </li>
                        ))}
                    </ul>
                  </div>
                </>
              ) : null}
              {detailsRow.activatedAt ? (
                <>
                  <div className={classes.detailLabel}>
                    {i18n.t("platform.signupRequests.detailActivatedAt")}
                  </div>
                  <div className={classes.detailValue}>{formatDateTime(detailsRow.activatedAt)}</div>
                </>
              ) : null}
              {detailsRow.firstLoginAt ? (
                <>
                  <div className={classes.detailLabel}>
                    {i18n.t("platform.signupRequests.detailFirstLoginAt")}
                  </div>
                  <div className={classes.detailValue}>{formatDateTime(detailsRow.firstLoginAt)}</div>
                </>
              ) : null}
              {Array.isArray(detailsRow.alerts) && detailsRow.alerts.length > 0 ? (
                <>
                  <div className={classes.detailLabel}>{i18n.t("platform.signupRequests.detailAlerts")}</div>
                  <div className={classes.detailValue}>
                    <AlertChips alerts={detailsRow.alerts} />
                  </div>
                </>
              ) : null}
              {detailsRow.status === "rejected" && detailsRow.rejectReason ? (
                <>
                  <div className={classes.detailLabel}>
                    {i18n.t("platform.signupRequests.detailRejectReason")}
                  </div>
                  <div className={classes.detailValue}>{detailsRow.rejectReason}</div>
                </>
              ) : null}
              {detailsRow.reviewedAt ? (
                <>
                  <div className={classes.detailLabel}>
                    {i18n.t("platform.signupRequests.detailReviewedAt")}
                  </div>
                  <div className={classes.detailValue}>{formatDateTime(detailsRow.reviewedAt)}</div>
                </>
              ) : null}
              {detailsRow.createdCompanyId ? (
                <>
                  <div className={classes.detailLabel}>
                    {i18n.t("platform.signupRequests.detailCompanyId")}
                  </div>
                  <div className={classes.detailValue}>#{detailsRow.createdCompanyId}</div>
                </>
              ) : null}
            </>
          ) : null}
        </DialogContent>
        <DialogActions style={{ flexWrap: "wrap", gap: 8 }}>
          {canResendInvite(detailsRow) ? (
            <AppSecondaryButton
              startIcon={<MailOutlineIcon fontSize="small" />}
              onClick={() => openResendConfirm(detailsRow)}
            >
              {i18n.t("platform.signupRequests.resendInviteConfirm")}
            </AppSecondaryButton>
          ) : null}
          <AppPrimaryButton style={{ marginLeft: "auto" }} onClick={() => setDetailsOpen(false)}>
            {i18n.t("platform.signupRequests.close")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>

      {/* Reenviar convite */}
      <Dialog open={resendOpen} onClose={() => !resendSubmitting && setResendOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("platform.signupRequests.resendInviteDialogTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" color="textPrimary" paragraph>
              <strong>{resendRow?.companyName}</strong>
              {" · "}
              {resendRow?.email}
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              {i18n.t("platform.signupRequests.resendInviteDialogIntro")}
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton disabled={resendSubmitting} onClick={() => setResendOpen(false)}>
            {i18n.t("platform.signupRequests.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton loading={resendSubmitting} onClick={confirmResendInvite}>
            {i18n.t("platform.signupRequests.resendInviteConfirm")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>

      {/* Aprovar */}
      <Dialog open={approveOpen} onClose={() => !approveSubmitting && setApproveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("platform.signupRequests.approveDialogTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Typography variant="body2" color="textPrimary" paragraph>
              <strong>{approveRow?.companyName}</strong>
              {" · "}
              {approveRow?.adminName}
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph style={{ marginBottom: 8 }}>
              {i18n.t("platform.signupRequests.approveDialogIntro")}
            </Typography>
            <ul className={classes.approveList}>
              <li>
                <Typography variant="body2">{i18n.t("platform.signupRequests.approveDialogBullet1")}</Typography>
              </li>
              <li>
                <Typography variant="body2">{i18n.t("platform.signupRequests.approveDialogBullet2")}</Typography>
              </li>
              <li>
                <Typography variant="body2">{i18n.t("platform.signupRequests.approveDialogBullet3")}</Typography>
              </li>
            </ul>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton disabled={approveSubmitting} onClick={() => setApproveOpen(false)}>
            {i18n.t("platform.signupRequests.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton loading={approveSubmitting} onClick={confirmApprove}>
            {i18n.t("platform.signupRequests.confirmApproveAction")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={credentialsOpen}
        onClose={() => setCredentialsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{i18n.t("platform.signupRequests.credentialsDialogTitle")}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            {i18n.t("platform.signupRequests.credentialsDialogIntro")}
          </Typography>
          <TextField
            fullWidth
            margin="dense"
            label={i18n.t("platform.companies.primaryAdminEmail")}
            value={credentialsPayload?.email || ""}
            InputProps={{ readOnly: true }}
            variant="outlined"
          />
          <TextField
            fullWidth
            margin="dense"
            label={i18n.t("platform.companies.primaryAdminTempPassword")}
            value={credentialsPayload?.temporaryPassword || ""}
            InputProps={{ readOnly: true }}
            variant="outlined"
            helperText={i18n.t("platform.companies.primaryAdminMustChange")}
          />
        </DialogContent>
        <DialogActions>
          <AppPrimaryButton onClick={() => setCredentialsOpen(false)}>
            {i18n.t("confirmationModal.buttons.confirm")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>

      {/* Rejeitar */}
      <Dialog open={rejectOpen} onClose={() => !rejectSubmitting && setRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("platform.signupRequests.rejectTitle")}</DialogTitle>
        <DialogContent>
          {rejectRow ? (
            <Typography variant="body2" color="textSecondary" paragraph>
              {rejectRow.companyName} · {rejectRow.email}
            </Typography>
          ) : null}
          <TextField
            label={i18n.t("platform.signupRequests.rejectReason")}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            margin="normal"
            variant="outlined"
            placeholder={i18n.t("platform.signupRequests.rejectReasonPlaceholder")}
          />
          <FormHelperText>{i18n.t("platform.signupRequests.rejectReasonHelper")}</FormHelperText>
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton disabled={rejectSubmitting} onClick={() => setRejectOpen(false)}>
            {i18n.t("platform.signupRequests.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton loading={rejectSubmitting} onClick={confirmReject}>
            {i18n.t("platform.signupRequests.confirmReject")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
}
