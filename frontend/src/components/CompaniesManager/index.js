import React, { useState, useEffect, useMemo, useRef, useContext, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  makeStyles,
  Box,
  Grid,
  FormControl,
  InputLabel,
  MenuItem,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  Select,
  Typography,
  CircularProgress,
  Chip,
  InputAdornment,
  Button,
  Tooltip,
  IconButton,
} from "@material-ui/core";
import { useTheme, alpha } from "@material-ui/core/styles";
import SearchIcon from "@material-ui/icons/Search";
import EditOutlined from "@material-ui/icons/EditOutlined";
import DeleteOutline from "@material-ui/icons/DeleteOutline";
import HeadsetMic from "@material-ui/icons/HeadsetMic";
import ChatBubbleOutline from "@material-ui/icons/ChatBubbleOutline";
import { Formik, Form, Field } from "formik";
import ConfirmationModal from "../ConfirmationModal";
import Alert from "@material-ui/lab/Alert";

import { toast } from "react-toastify";
import useCompanies from "../../hooks/useCompanies";
import usePlans from "../../hooks/usePlans";
import ModalUsers from "../ModalUsers";
import api from "../../services/api";
import { head, isArray, has } from "lodash";
import { useDate } from "../../hooks/useDate";

import moment from "moment-timezone";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import LockOutlined from "@material-ui/icons/LockOutlined";
import LockOpen from "@material-ui/icons/LockOpen";
import Autorenew from "@material-ui/icons/Autorenew";
import DeleteForever from "@material-ui/icons/DeleteForever";
import NoteOutlined from "@material-ui/icons/NoteOutlined";
import History from "@material-ui/icons/History";
import Warning from "@material-ui/icons/Warning";
import { AuthContext } from "../../context/Auth/AuthContext";
import { getIanaTimezones } from "../../utils/ianaTimezones";
import {
  parseBrazilianCurrencyToNumber,
  formatPlanValueForInput,
} from "../../utils/brazilianCurrency";
import {
  getCompanyEffectivePlanValue,
  formatBrlBrief,
} from "../../utils/companyPlanValue";

import {
  AppSectionCard,
  AppEmptyState,
  AppPrimaryButton,
  AppSecondaryButton,
  AppNeutralButton,
} from "../../ui";
import AppTableContainer from "../../ui/components/AppTableContainer";
import ModuleToggleCard from "../ModuleSettings/ModuleToggleCard";
import CompanyPlanChangeDialog from "../ModuleSettings/CompanyPlanChangeDialog";
import {
  MODULE_TOGGLE_KEYS,
  defaultModulePermissions,
  mergeModulePermissions,
  mergeModulePermissionsFromPlan,
  getCompanyModuleEffectiveEnabled,
  getCompanyModuleOriginKey,
  planBlocksCompanyModule,
} from "../ModuleSettings/moduleSync";
import { BUSINESS_SEGMENTS } from "../../config/businessSegment.js";

const REC_MONTHS = {
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

/** Pré-visualização alinhada ao backend RenewCompanyDueDateService. */
function previewRenewedDueDate(row) {
  if (!row) return null;
  const rec = String(row.recurrence || "").toUpperCase();
  const months = REC_MONTHS[rec];
  if (!months) return null;
  const tz =
    row.timezone && typeof row.timezone === "string"
      ? row.timezone
      : "America/Sao_Paulo";
  try {
    if (!moment.tz.zone(tz)) return null;
    const now = moment.tz(tz).startOf("day");
    let base = now;
    if (row.dueDate) {
      const due = moment.tz(row.dueDate, tz).startOf("day");
      if (due.isValid() && due.isSameOrAfter(now)) {
        base = due;
      }
    }
    return base.clone().add(months, "months").format("YYYY-MM-DD");
  } catch (e) {
    return null;
  }
}

/** Exibe GB no input (vírgula decimal). */
function formatGbInputFromApi(gb) {
  if (gb == null || gb === "") return "";
  return String(gb).replace(".", ",");
}

function companyStorageBarColor(percent, palette) {
  if (percent == null) return palette.primary.main;
  if (percent >= 100) return palette.error.main;
  if (percent >= 90) return palette.error.main;
  if (percent >= 80) return palette.warning.main;
  return palette.success.main;
}

function companyStorageStatusLabel(alertLevel) {
  const lev = alertLevel && typeof alertLevel === "string" ? alertLevel : "ok";
  const key =
    lev === "attention"
      ? "storageStatusAttention"
      : lev === "critical"
        ? "storageStatusCritical"
        : lev === "exceeded"
          ? "storageStatusExceeded"
          : "storageStatusNormal";
  return i18n.t(`platform.companies.${key}`);
}

function formatStorageBytesBrief(n) {
  const x = Number(n) || 0;
  if (x >= 1073741824) return `${(x / 1073741824).toFixed(2)} GB`;
  if (x >= 1048576) return `${(x / 1048576).toFixed(1)} MB`;
  if (x >= 1024) return `${(x / 1024).toFixed(1)} KB`;
  return `${x} B`;
}

/**
 * Contexto para automação futura (avisos / bloqueio por inadimplência / desbloqueio pós-renovação).
 * Buckets estáveis: expired | today | soon | ok | neutral — usar estes nomes em jobs e regras.
 */
function getDueCategory(row) {
  if (!row?.dueDate || !moment(row.dueDate).isValid()) {
    return { category: "neutral", diff: null };
  }
  const dueDay = moment(row.dueDate).startOf("day");
  const today = moment().startOf("day");
  const diff = dueDay.diff(today, "days");
  if (diff < 0) return { category: "expired", diff };
  if (diff === 0) return { category: "today", diff };
  if (diff <= 3) return { category: "soon", diff };
  return { category: "ok", diff };
}

/** Vencido → vermelho; hoje → laranja; 1–3 dias → amarelo; em dia → verde. */
function getDueDisplayMeta(row, dateToClient) {
  const { category, diff } = getDueCategory(row);
  if (category === "neutral") {
    return {
      category,
      tone: "neutral",
      dateLabel: "—",
      shortLabel: "",
      recurrence: row?.recurrence || "",
      tooltip: i18n.t("platform.companies.dueTooltipNoDate"),
      dueClassKey: "dueDateNeutral",
    };
  }
  const dateLabel = dateToClient(row.dueDate);
  const fullDateLine = moment(row.dueDate).isValid()
    ? moment(row.dueDate).format("dddd, DD/MM/YYYY")
    : dateLabel;
  let dueClassKey;
  let shortLabel;
  let tooltip;
  if (category === "expired") {
    dueClassKey = "dueDateExpired";
    const days = Math.abs(diff);
    shortLabel = i18n.t("platform.companies.dueShortExpired", { days });
    tooltip = i18n.t("platform.companies.dueTooltipFullExpired", {
      date: dateLabel,
      longDate: fullDateLine,
      days,
    });
  } else if (category === "today") {
    dueClassKey = "dueDateToday";
    shortLabel = i18n.t("platform.companies.dueShortToday");
    tooltip = i18n.t("platform.companies.dueTooltipFullToday", {
      date: dateLabel,
      longDate: fullDateLine,
    });
  } else if (category === "soon") {
    dueClassKey = "dueDateSoon";
    shortLabel = i18n.t("platform.companies.dueShortSoon", { days: diff });
    tooltip = i18n.t("platform.companies.dueTooltipFullSoon", {
      date: dateLabel,
      longDate: fullDateLine,
      days: diff,
    });
  } else {
    dueClassKey = "dueDateOk";
    shortLabel = i18n.t("platform.companies.dueShortOk");
    tooltip = i18n.t("platform.companies.dueTooltipFullOk", {
      date: dateLabel,
      longDate: fullDateLine,
      days: diff,
    });
  }
  return {
    category,
    tone: category,
    dateLabel,
    shortLabel,
    recurrence: row.recurrence || "",
    tooltip,
    dueClassKey,
  };
}

function planNameForSort(row) {
  return row?.planId != null && row?.plan?.name ? String(row.plan.name) : "";
}

/** Ordenação: vencidos → hoje → próximos → em dia → sem data; desempate por dias e nome. */
function comparePriorityDue(a, b) {
  const ca = getDueCategory(a);
  const cb = getDueCategory(b);
  const rank = (c) => {
    if (c.category === "expired") return 0;
    if (c.category === "today") return 1;
    if (c.category === "soon") return 2;
    if (c.category === "ok") return 3;
    return 4;
  };
  const ra = rank(ca);
  const rb = rank(cb);
  if (ra !== rb) return ra - rb;
  if (ca.category === "expired" && cb.category === "expired") {
    if ((ca.diff ?? 0) !== (cb.diff ?? 0)) return (ca.diff ?? 0) - (cb.diff ?? 0);
  }
  if (ca.category === "soon" && cb.category === "soon") {
    if ((ca.diff ?? 0) !== (cb.diff ?? 0)) return (ca.diff ?? 0) - (cb.diff ?? 0);
  }
  if (ca.category === "ok" && cb.category === "ok") {
    if ((ca.diff ?? 0) !== (cb.diff ?? 0)) return (ca.diff ?? 0) - (cb.diff ?? 0);
  }
  const blockRank = (x) => (x.status === false ? 0 : 1);
  if (blockRank(a) !== blockRank(b)) return blockRank(a) - blockRank(b);
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
}

function buildBillingReminderMessage(row, dateToClientFn) {
  const name = row?.name || i18n.t("platform.companies.billingMessageFallbackName");
  let dateStr = i18n.t("platform.companies.billingMessageNoDue");
  if (row?.dueDate && moment(row.dueDate).isValid()) {
    dateStr = dateToClientFn(row.dueDate);
  }
  const plan =
    row?.planId != null && row?.plan?.name
      ? row.plan.name
      : i18n.t("platform.companies.billingMessageNoPlan");
  const amount = formatBrlBrief(getCompanyEffectivePlanValue(row));
  return i18n.t("platform.companies.billingMessageTemplate", {
    name,
    date: dateStr,
    plan,
    amount,
  });
}

function formatPlanValueDiscrete(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n);
}

function digitsForWhatsApp(phone) {
  if (!phone || typeof phone !== "string") return "";
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? d : "";
}

function getFinanceStateLabel(category) {
  switch (category) {
    case "expired":
      return i18n.t("platform.companies.financeStateOverdue");
    case "today":
      return i18n.t("platform.companies.financeStateToday");
    case "soon":
      return i18n.t("platform.companies.financeStateSoon");
    case "ok":
      return i18n.t("platform.companies.financeStateOk");
    default:
      return i18n.t("platform.companies.financeStateNoDue");
  }
}

function dueDateSortKey(row) {
  if (!row?.dueDate || !moment(row.dueDate).isValid()) return Number.POSITIVE_INFINITY;
  return moment(row.dueDate).startOf("day").valueOf();
}

function compareByDueDateAsc(a, b) {
  const ka = dueDateSortKey(a);
  const kb = dueDateSortKey(b);
  if (ka !== kb) return ka - kb;
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
}

function compareByStatusBlockedFirst(a, b) {
  const ra = a.status === false ? 0 : 1;
  const rb = b.status === false ? 0 : 1;
  if (ra !== rb) return ra - rb;
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
}

function formatCompanyLogEntry(log, dateToClient, datetimeToClient) {
  const meta =
    log?.metadata && typeof log.metadata === "object" ? log.metadata : {};
  const actionKey = `platform.companies.companyLogActions.${log.action}`;
  let title = i18n.t(actionKey);
  if (title === actionKey) {
    title = log.action || "—";
  }
  let detail = "";
  switch (log.action) {
    case "renew":
      detail = i18n.t("platform.companies.logDetailRenew", {
        from: meta.previousDueDate ? dateToClient(meta.previousDueDate) : "—",
        to: meta.newDueDate ? dateToClient(meta.newDueDate) : "—",
      });
      break;
    case "block":
      detail = i18n.t("platform.companies.logDetailBlock");
      break;
    case "unblock":
      detail = i18n.t("platform.companies.logDetailUnblock");
      break;
    case "delete":
      detail = i18n.t("platform.companies.logDetailDelete", {
        name: meta.name != null ? String(meta.name) : "—",
      });
      break;
    case "warning_before_due":
      detail = i18n.t("platform.companies.logDetailWarningBefore", {
        date: meta.dueDate ? dateToClient(meta.dueDate) : "—",
        days: meta.daysUntilDue != null ? String(meta.daysUntilDue) : "—",
      });
      break;
    case "warning_after_due":
      detail = i18n.t("platform.companies.logDetailWarningAfter", {
        date: meta.dueDate ? dateToClient(meta.dueDate) : "—",
        days: meta.daysLate != null ? String(meta.daysLate) : "—",
      });
      break;
    case "auto_block":
      detail = i18n.t("platform.companies.logDetailAutoBlock", {
        date: meta.dueDate ? dateToClient(meta.dueDate) : "—",
        days: meta.daysLate != null ? String(meta.daysLate) : "—",
      });
      break;
    case "auto_unblock_after_renew":
      detail = i18n.t("platform.companies.logDetailAutoUnblockAfterRenew", {
        from: meta.previousDueDate ? dateToClient(meta.previousDueDate) : "—",
        to: meta.newDueDate ? dateToClient(meta.newDueDate) : "—",
      });
      break;
    case "contracted_value_change":
      detail = i18n.t("platform.companies.logDetailContractedValueChange", {
        from:
          meta.previousValue != null
            ? formatPlanValueDiscrete(meta.previousValue)
            : i18n.t("platform.companies.contractedFallbackDefault"),
        to:
          meta.newValue != null
            ? formatPlanValueDiscrete(meta.newValue)
            : i18n.t("platform.companies.contractedFallbackDefault"),
        planBase: formatPlanValueDiscrete(meta.planValue ?? 0),
      });
      break;
    case "plan_change":
      detail = i18n.t("platform.companies.logDetailPlanChange", {
        from:
          meta.previousPlanId != null && meta.previousPlanId !== ""
            ? String(meta.previousPlanId)
            : "—",
        to:
          meta.newPlanId != null && meta.newPlanId !== ""
            ? String(meta.newPlanId)
            : "—",
      });
      break;
    default:
      detail = "";
  }
  const isAutomated = meta.kind === "automated";
  const actor =
    log.user && (log.user.name || log.user.email)
      ? i18n.t("platform.companies.logActor", {
          name: log.user.name || log.user.email,
        })
      : isAutomated
        ? i18n.t("platform.companies.logActorSystem")
        : "";
  let whatsappLine = "";
  if (meta.whatsapp && typeof meta.whatsapp === "object" && meta.whatsapp.channel === "whatsapp") {
    const w = meta.whatsapp;
    if (w.sent === true) {
      whatsappLine = i18n.t("platform.companies.logWhatsappSent", {
        last4: w.destinationLast4 != null ? String(w.destinationLast4) : "—",
      });
    } else if (w.attempted === true || w.error || w.skippedReason) {
      whatsappLine = i18n.t("platform.companies.logWhatsappNotSent", {
        reason: String(w.error || w.skippedReason || "—"),
      });
    }
  }
  const parts = [detail, actor, whatsappLine].filter(Boolean);
  return {
    whenLabel: datetimeToClient(log.createdAt),
    title,
    subtitle: parts.length ? parts.join(" · ") : "",
  };
}

function campaignsLabelForRow(row) {
  if (has(row, "settings") && isArray(row.settings) && row.settings.length > 0) {
    const setting = row.settings.find((s) => s.key === "campaignsEnabled");
    if (setting) {
      return setting.value === "true"
        ? i18n.t("settings.company.form.enabled")
        : i18n.t("settings.company.form.disabled");
    }
  }
  return i18n.t("settings.company.form.disabled");
}

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
  },
  pageStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    width: "100%",
  },
  mainPaper: {
    width: "100%",
    flex: 1,
    padding: theme.spacing(2),
  },
  fullWidth: {
    width: "100%",
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: "1.125rem",
    lineHeight: 1.35,
    letterSpacing: "-0.01em",
    marginBottom: theme.spacing(0.75),
    color: theme.palette.text.primary,
  },
  sectionSubtitle: {
    marginBottom: theme.spacing(2.5),
    lineHeight: 1.6,
    maxWidth: 720,
  },
  usersScroll: {
    maxHeight: 280,
    overflow: "auto",
    ...theme.scrollbarStyles,
  },
  tableContainer: {
    width: "100%",
    overflowX: "auto",
    ...theme.scrollbarStyles,
  },
  tableToolbar: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    alignItems: "center",
  },
  tableRow: {
    cursor: "pointer",
    transition: theme.transitions.create(["background-color", "box-shadow"], { duration: 180 }),
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? alpha(theme.palette.common.white, 0.06)
          : alpha(theme.palette.primary.main, 0.06),
      boxShadow:
        theme.palette.type === "dark"
          ? `inset 0 0 0 1px ${alpha(theme.palette.common.white, 0.08)}`
          : `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.14)}`,
    },
  },
  tableRowSelected: {
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.primary.main, 0.2)
        : alpha(theme.palette.primary.main, 0.1),
    boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? alpha(theme.palette.primary.main, 0.26)
          : alpha(theme.palette.primary.main, 0.14),
    },
  },
  companyCell: {
    maxWidth: 0,
    minWidth: 200,
  },
  companyNameLine: {
    fontWeight: 600,
    fontSize: "0.9375rem",
    lineHeight: 1.35,
    color: theme.palette.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  companyAdminLine: {
    fontSize: "0.8125rem",
    lineHeight: 1.4,
    color: theme.palette.text.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 2,
  },
  companyEmailLine: {
    fontSize: "0.75rem",
    lineHeight: 1.35,
    color: theme.palette.text.hint,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 1,
  },
  planCell: {
    maxWidth: 0,
    minWidth: 120,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  planRecurrenceCaption: {
    fontSize: "0.7rem",
    lineHeight: 1.35,
    color: theme.palette.text.secondary,
    marginTop: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  financeCell: {
    maxWidth: 0,
    minWidth: 128,
  },
  financeValueMuted: {
    fontSize: "0.68rem",
    color: theme.palette.text.secondary,
    marginTop: 2,
    opacity: 0.92,
  },
  billingMessageField: {
    fontFamily: "inherit",
    fontSize: "0.8125rem",
    lineHeight: 1.5,
  },
  dueCell: {
    maxWidth: 0,
    minWidth: 160,
  },
  dueShortLabel: {
    fontSize: "0.7rem",
    lineHeight: 1.35,
    fontWeight: 500,
    marginTop: 2,
  },
  filterChipsRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  dueDatePrimary: {
    fontWeight: 600,
    fontSize: "0.875rem",
    lineHeight: 1.35,
  },
  dueDateExpired: {
    color: theme.palette.error.main,
  },
  dueDateToday: {
    color:
      theme.palette.type === "dark"
        ? "#ffb74d"
        : "#e65100",
  },
  dueDateSoon: {
    color:
      theme.palette.type === "dark"
        ? "#ffee58"
        : "#f9a825",
  },
  dueDateOk: {
    color:
      theme.palette.type === "dark"
        ? theme.palette.success.light
        : theme.palette.success.dark,
  },
  dueDateNeutral: {
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  tooltipDetailLabel: {
    fontWeight: 600,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: theme.palette.common.white,
    opacity: 0.85,
    marginTop: theme.spacing(0.75),
    marginBottom: 2,
  },
  tooltipDetailValue: {
    fontSize: "0.8125rem",
    lineHeight: 1.45,
    color: theme.palette.common.white,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  actionBar: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  actionGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
  dangerZone: {
    paddingRight: theme.spacing(2),
    marginRight: theme.spacing(0.5),
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  dangerDeleteButton: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: theme.palette.error.main,
    color: theme.palette.error.main,
    fontWeight: 600,
    textTransform: "none",
    letterSpacing: "0.01em",
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    "&:hover": {
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: theme.palette.error.dark,
      color: theme.palette.error.dark,
      backgroundColor: alpha(theme.palette.error.main, 0.08),
    },
  },
  rightActions: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(2),
  },
  editingBanner: {
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.primary.main, 0.12)
        : alpha(theme.palette.primary.main, 0.06),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
    borderLeftWidth: 4,
    borderLeftColor: theme.palette.primary.main,
    borderLeftStyle: "solid",
  },
  editingBannerTitle: {
    fontWeight: 600,
    fontSize: "1.0625rem",
    lineHeight: 1.4,
    color: theme.palette.text.primary,
  },
  editingBannerHint: {
    marginTop: theme.spacing(0.75),
    lineHeight: 1.5,
    fontSize: "0.8125rem",
  },
  tableHeadCell: {
    fontWeight: 600,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: theme.palette.text.secondary,
    borderBottom: `2px solid ${theme.palette.divider}`,
  },
  statusChipActive: {
    fontWeight: 600,
    backgroundColor: alpha(theme.palette.success.main, 0.18),
    color:
      theme.palette.type === "dark"
        ? theme.palette.success.light
        : theme.palette.success.dark,
    border: "none",
  },
  statusChipInactive: {
    fontWeight: 600,
    backgroundColor: alpha(theme.palette.error.main, 0.12),
    color:
      theme.palette.type === "dark"
        ? theme.palette.error.light
        : theme.palette.error.dark,
    border: "none",
  },
  userOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    marginRight: theme.spacing(1),
  },
  userProfileChip: {
    fontWeight: 500,
    maxWidth: "100%",
  },
  registeredSectionSubtitle: {
    marginBottom: theme.spacing(2),
    lineHeight: 1.55,
    maxWidth: 560,
  },
}));

export function CompanyForm(props) {
  const {
    onSubmit,
    onDelete,
    onCancel,
    initialValue,
    loading,
    reloadCompanySnapshot,
    storageSnapshots = [],
  } = props;
  const { user } = useContext(AuthContext);
  const classes = useStyles();
  const theme = useTheme();
  const [plans, setPlans] = useState([]);
  const [modalUser, setModalUser] = useState(false);
  const [firstUser, setFirstUser] = useState({});
  const [companyUsers, setCompanyUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [planChangeCtx, setPlanChangeCtx] = useState(null);

  const [record, setRecord] = useState(() => ({
    name: "",
    email: "",
    phone: "",
    planId: "",
    status: true,
    campaignsEnabled: false,
    dueDate: "",
    recurrence: "",
    timezone: "America/Sao_Paulo",
    contractedPlanValueStr: "",
    storageLimitGbStr: "",
    storageUsedFormatted: null,
    storageLimitFormatted: null,
    storageUsagePercent: null,
    storageCalculatedAt: null,
    ...initialValue,
    contractedPlanValueStr:
      initialValue?.contractedPlanValue != null && initialValue?.contractedPlanValue !== ""
        ? formatPlanValueForInput(initialValue.contractedPlanValue)
        : "",
    storageLimitGbStr: formatGbInputFromApi(initialValue?.storageLimitGb),
    storageUsedFormatted: initialValue?.storageUsedFormatted ?? null,
    storageLimitFormatted: initialValue?.storageLimitFormatted ?? null,
    storageUsagePercent:
      initialValue?.storageUsagePercent != null
        ? Number(initialValue.storageUsagePercent)
        : null,
    storageCalculatedAt: initialValue?.storageCalculatedAt ?? null,
    storageAlertLevel: initialValue?.storageAlertLevel ?? "ok",
    modulePermissions: mergeModulePermissions(initialValue?.modulePermissions),
    businessSegment: initialValue?.businessSegment || "general",
    crmVisibilityMode: initialValue?.crmVisibilityMode || "all",
  }));

  const { list: listPlans } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const list = await listPlans();
      setPlans(list);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRecord((prev) => {
      if (moment(initialValue).isValid()) {
        initialValue.dueDate = moment(initialValue.dueDate).format(
          "YYYY-MM-DD"
        );
      }
      return {
        ...prev,
        ...initialValue,
        contractedPlanValueStr:
          initialValue?.contractedPlanValue != null && initialValue?.contractedPlanValue !== ""
            ? formatPlanValueForInput(initialValue.contractedPlanValue)
            : "",
        storageLimitGbStr: formatGbInputFromApi(initialValue?.storageLimitGb),
        storageUsedFormatted: initialValue?.storageUsedFormatted ?? null,
        storageLimitFormatted: initialValue?.storageLimitFormatted ?? null,
        storageUsagePercent:
          initialValue?.storageUsagePercent != null
            ? Number(initialValue.storageUsagePercent)
            : null,
        storageCalculatedAt: initialValue?.storageCalculatedAt ?? null,
        storageAlertLevel: initialValue?.storageAlertLevel ?? "ok",
        modulePermissions: mergeModulePermissions(initialValue?.modulePermissions),
        businessSegment: initialValue?.businessSegment || "general",
        crmVisibilityMode: initialValue?.crmVisibilityMode || "all",
      };
    });
  }, [initialValue]);

  const handleSubmit = async (data) => {
    const outgoing = { ...data };
    if (user?.super && Object.prototype.hasOwnProperty.call(outgoing, "contractedPlanValueStr")) {
      const trimmed = String(outgoing.contractedPlanValueStr ?? "").trim();
      let contractedPlanValue;
      if (!trimmed) contractedPlanValue = null;
      else {
        const n = parseBrazilianCurrencyToNumber(trimmed);
        if (n === null || Number.isNaN(n)) {
          toast.error(i18n.t("settings.company.form.contractedPlanValueInvalid"));
          return;
        }
        contractedPlanValue = n;
      }
      delete outgoing.contractedPlanValueStr;
      outgoing.contractedPlanValue = contractedPlanValue;
    } else if (!user?.super) {
      delete outgoing.contractedPlanValueStr;
    }
    if (outgoing.dueDate === "" || moment(outgoing.dueDate).isValid() === false) {
      outgoing.dueDate = null;
    }

    if (user?.super && Object.prototype.hasOwnProperty.call(outgoing, "storageLimitGbStr")) {
      const trimmed = String(outgoing.storageLimitGbStr ?? "").trim();
      let storageLimitGb;
      if (!trimmed) storageLimitGb = null;
      else {
        const n = parseBrazilianCurrencyToNumber(trimmed);
        if (n === null || Number.isNaN(n)) {
          toast.error(i18n.t("platform.companies.storageLimitInvalid"));
          return;
        }
        storageLimitGb = n;
      }
      delete outgoing.storageLimitGbStr;
      outgoing.storageLimitGb = storageLimitGb;
      delete outgoing.storageUsedFormatted;
      delete outgoing.storageLimitFormatted;
      delete outgoing.storageUsagePercent;
      delete outgoing.storageCalculatedAt;
      delete outgoing.storageAlertLevel;
    } else if (!user?.super) {
      delete outgoing.storageLimitGbStr;
      delete outgoing.storageUsedFormatted;
      delete outgoing.storageLimitFormatted;
      delete outgoing.storageUsagePercent;
      delete outgoing.storageCalculatedAt;
      delete outgoing.storageAlertLevel;
    }

    onSubmit(outgoing);
  };

  const handleOpenModalUsers = async () => {
    try {
      const { data } = await api.get("/users/list", {
        params: {
          companyId: initialValue.id,
        },
      });
      if (isArray(data) && data.length) {
        setFirstUser(head(data));
      }
      setModalUser(true);
    } catch (e) {
      toast.error(e);
    }
  };

  const handleCloseModalUsers = () => {
    setFirstUser({});
    setModalUser(false);
  };

  const companyIdForUsers = initialValue && initialValue.id;

  useEffect(() => {
    if (!companyIdForUsers) {
      setCompanyUsers([]);
      return undefined;
    }
    let cancelled = false;
    setUsersLoading(true);
    api
      .get("/users/list", { params: { companyId: companyIdForUsers } })
      .then(({ data }) => {
        if (!cancelled) setCompanyUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCompanyUsers([]);
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyIdForUsers]);

  const formatUserProfile = (profile) => {
    const key = `users.profileLabels.${profile}`;
    const t = i18n.t(key);
    return t !== key ? t : profile || "—";
  };

  const formatUserOnline = (online) =>
    online
      ? i18n.t("users.online.yes")
      : i18n.t("users.online.no");

  const profileChipColor = (profile) => {
    const p = (profile || "").toLowerCase();
    if (p === "admin") return "primary";
    if (p === "supervisor") return "secondary";
    return "default";
  };

  const incrementDueDate = () => {
    const data = { ...record };
    if (data.dueDate !== "" && data.dueDate !== null) {
      switch (data.recurrence) {
        case "MENSAL":
          data.dueDate = moment(data.dueDate)
            .add(1, "month")
            .format("YYYY-MM-DD");
          break;
        case "BIMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(2, "month")
            .format("YYYY-MM-DD");
          break;
        case "TRIMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(3, "month")
            .format("YYYY-MM-DD");
          break;
        case "SEMESTRAL":
          data.dueDate = moment(data.dueDate)
            .add(6, "month")
            .format("YYYY-MM-DD");
          break;
        case "ANUAL":
          data.dueDate = moment(data.dueDate)
            .add(12, "month")
            .format("YYYY-MM-DD");
          break;
        default:
          break;
      }
    }
    setRecord(data);
  };

  return (
    <>
      <ModalUsers
        userId={firstUser.id}
        companyId={initialValue.id}
        open={modalUser}
        onClose={handleCloseModalUsers}
      />
      <Formik
        enableReinitialize
        className={classes.fullWidth}
        initialValues={record}
        onSubmit={(values) => {
          handleSubmit(values);
        }}
      >
        {(formik) => (
          <>
          <Form className={classes.fullWidth}>
            <Box className={classes.formStack}>
              {/* Bloco 1 — Dados da empresa */}
              <AppSectionCard>
                <Typography className={classes.sectionTitle} component="h2">
                  {i18n.t("settings.company.form.sectionCompanyData")}
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.sectionSubtitle}
                >
                  {i18n.t("settings.company.form.sectionCompanyDataHint")}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Field
                      as={TextField}
                      label={i18n.t("settings.company.form.name")}
                      name="name"
                      variant="outlined"
                      className={classes.fullWidth}
                      margin="dense"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Field
                      as={TextField}
                      label={i18n.t("settings.company.form.emailMain")}
                      name="email"
                      variant="outlined"
                      className={classes.fullWidth}
                      margin="dense"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Field
                      as={TextField}
                      label={i18n.t("settings.company.form.phone")}
                      name="phone"
                      variant="outlined"
                      className={classes.fullWidth}
                      margin="dense"
                    />
                  </Grid>
                  {initialValue && initialValue.id ? (
                    <Grid item xs={12} md={8}>
                      <TextField
                        fullWidth
                        margin="dense"
                        variant="outlined"
                        label={i18n.t("settings.company.form.primaryAdmin")}
                        value={
                          initialValue.primaryAdmin
                            ? `${initialValue.primaryAdmin.name || "—"} (${initialValue.primaryAdmin.email || "—"})`
                            : i18n.t("settings.company.form.noPrimaryAdmin")
                        }
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>
                  ) : null}
                </Grid>
              </AppSectionCard>

              {/* Bloco 2 — Plano e operação (sem Campanhas: controlado em Módulos) */}
              <AppSectionCard>
                <Typography className={classes.sectionTitle} component="h2">
                  {i18n.t("settings.company.form.sectionPlanOperation")}
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.sectionSubtitle}
                >
                  {i18n.t("settings.company.form.sectionPlanOperationHint")}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl margin="dense" variant="outlined" fullWidth>
                      <InputLabel htmlFor="plan-selection">
                        {i18n.t("settings.company.form.plan")}
                      </InputLabel>
                      <Field name="planId">
                        {({ field, form }) => (
                          <Select
                            id="plan-selection"
                            label={i18n.t("settings.company.form.plan")}
                            labelId="plan-selection-label"
                            margin="dense"
                            required
                            value={field.value === "" ? "" : field.value}
                            onChange={(e) => {
                              const v = e.target.value;
                              const prevId = field.value;
                              const modulesBefore = mergeModulePermissions(
                                form.values.modulePermissions
                              );
                              field.onChange(e);
                              if (String(prevId) === String(v)) return;
                              const newPlan = plans.find(
                                (pl) => String(pl.id) === String(v)
                              );
                              if (!newPlan) return;
                              setPlanChangeCtx({
                                prevPlanId: prevId,
                                modulesBefore,
                                newPlan,
                              });
                            }}
                          >
                            {plans.map((plan) => (
                              <MenuItem key={plan.id} value={plan.id}>
                                {plan.name}
                              </MenuItem>
                            ))}
                          </Select>
                        )}
                      </Field>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl margin="dense" variant="outlined" fullWidth>
                      <InputLabel htmlFor="status-selection">
                        {i18n.t("settings.company.form.status")}
                      </InputLabel>
                      <Field
                        as={Select}
                        id="status-selection"
                        label={i18n.t("settings.company.form.status")}
                        labelId="status-selection-label"
                        name="status"
                        margin="dense"
                      >
                        <MenuItem value={true}>{i18n.t("settings.company.form.yes")}</MenuItem>
                        <MenuItem value={false}>{i18n.t("settings.company.form.no")}</MenuItem>
                      </Field>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Field
                      as={TextField}
                      select
                      name="timezone"
                      label={i18n.t("settings.company.form.timezone")}
                      variant="outlined"
                      className={classes.fullWidth}
                      margin="dense"
                    >
                      {getIanaTimezones().map((z) => (
                        <MenuItem key={z} value={z}>
                          {z}
                        </MenuItem>
                      ))}
                    </Field>
                  </Grid>
                  {user?.super ? (
                    <>
                      <Grid item xs={12} sm={6} md={4}>
                        <FormControl margin="dense" variant="outlined" fullWidth>
                          <InputLabel id="biz-seg-lbl">
                            {i18n.t("settings.company.form.businessSegment")}
                          </InputLabel>
                          <Field name="businessSegment">
                            {({ field }) => (
                              <Select
                                labelId="biz-seg-lbl"
                                label={i18n.t("settings.company.form.businessSegment")}
                                {...field}
                                value={field.value || "general"}
                              >
                                {BUSINESS_SEGMENTS.map((s) => (
                                  <MenuItem key={s.value} value={s.value}>
                                    {i18n.t(s.labelKey)}
                                  </MenuItem>
                                ))}
                              </Select>
                            )}
                          </Field>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <FormControl component="fieldset" margin="dense" fullWidth>
                          <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                            {i18n.t("settings.company.crmVisibility.label")}
                          </Typography>
                          <Field name="crmVisibilityMode">
                            {({ field }) => (
                              <RadioGroup row {...field} value={field.value || "all"}>
                                <FormControlLabel
                                  value="all"
                                  control={<Radio color="primary" />}
                                  label={i18n.t("settings.company.crmVisibility.optionAll")}
                                />
                                <FormControlLabel
                                  value="assigned"
                                  control={<Radio color="primary" />}
                                  label={i18n.t("settings.company.crmVisibility.optionAssigned")}
                                />
                              </RadioGroup>
                            )}
                          </Field>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        {initialValue && initialValue.id ? (
                          <Box mt={0.5}>
                            <Typography
                              variant="caption"
                              color="textSecondary"
                              display="block"
                              style={{ marginBottom: 8 }}
                            >
                              {i18n.t("settings.company.form.bootstrapCrmHint")}
                            </Typography>
                            <Button
                              variant="outlined"
                              color="primary"
                              size="small"
                              onClick={async () => {
                                try {
                                  const { data } = await api.post(
                                    `/companies/${initialValue.id}/crm/bootstrap`
                                  );
                                  toast.success(
                                    data.bootstrapped
                                      ? i18n.t("settings.company.form.bootstrapCrmOk")
                                      : i18n.t("settings.company.form.bootstrapCrmAlready")
                                  );
                                } catch (e) {
                                  toastError(e);
                                }
                              }}
                            >
                              {i18n.t("settings.company.form.bootstrapCrm")}
                            </Button>
                          </Box>
                        ) : null}
                      </Grid>
                    </>
                  ) : null}
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl variant="outlined" fullWidth>
                      <Field
                        as={TextField}
                        label={i18n.t("settings.company.form.dueDate")}
                        type="date"
                        name="dueDate"
                        InputLabelProps={{
                          shrink: true,
                        }}
                        variant="outlined"
                        fullWidth
                        margin="dense"
                      />
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl margin="dense" variant="outlined" fullWidth>
                      <InputLabel htmlFor="recorrencia-selection">
                        {i18n.t("settings.company.form.recurrence")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("settings.company.form.recurrence")}
                        labelId="recorrencia-selection-label"
                        id="recurrence"
                        name="recurrence"
                        margin="dense"
                      >
                        <MenuItem value="MENSAL">{i18n.t("settings.company.form.monthly")}</MenuItem>
                      </Field>
                    </FormControl>
                  </Grid>
                  {user?.super ? (
                    <>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 8 }}>
                          {i18n.t("settings.company.form.contractedPlanSection")}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="textSecondary"
                          paragraph
                          style={{ marginBottom: 12 }}
                        >
                          {i18n.t("settings.company.form.contractedPlanHint")}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={12} md={8}>
                        <Field name="contractedPlanValueStr">
                          {({ field, form }) => {
                            const selectedPlan = plans.find(
                              (p) => String(p.id) === String(form.values.planId)
                            );
                            const planBaseline = Number(selectedPlan?.value);
                            const hasPlan = Boolean(selectedPlan);
                            const raw = String(field.value ?? "").trim();
                            let parsedContr = raw ? parseBrazilianCurrencyToNumber(raw) : null;
                            if (parsedContr !== null && Number.isNaN(parsedContr))
                              parsedContr = null;
                            const effective = hasPlan
                              ? parsedContr !== null
                                ? parsedContr
                                : planBaseline
                              : parsedContr ?? 0;
                            let deltaLine = "";
                            if (hasPlan && !Number.isNaN(planBaseline) && parsedContr !== null) {
                              const delta = parsedContr - planBaseline;
                              if (Math.round(delta * 100) !== 0) {
                                deltaLine =
                                  delta < 0
                                    ? i18n.t("settings.company.form.contractedPlanDiscountLabel", {
                                        value: formatBrlBrief(Math.abs(delta)),
                                      })
                                    : i18n.t("settings.company.form.contractedPlanSurchargeLabel", {
                                        value: formatBrlBrief(delta),
                                      });
                              }
                            }
                            return (
                              <>
                                <TextField
                                  {...field}
                                  fullWidth
                                  margin="dense"
                                  variant="outlined"
                                  label={i18n.t("settings.company.form.contractedPlanLabel")}
                                  placeholder={
                                    selectedPlan ? formatPlanValueForInput(selectedPlan.value) : ""
                                  }
                                />
                                <Box mt={1} display="flex" flexWrap="wrap" alignItems="center">
                                  <Typography
                                    variant="caption"
                                    color="textSecondary"
                                    component="span"
                                    style={{ marginRight: theme.spacing(1) }}
                                  >
                                    {selectedPlan
                                      ? i18n.t("settings.company.form.contractedPlanBaseline", {
                                          value: formatPlanValueForInput(selectedPlan.value),
                                        })
                                      : i18n.t("settings.company.form.contractedPlanNoPlanSelected")}
                                  </Typography>
                                  <Typography variant="caption" color="textPrimary" component="span">
                                    {hasPlan || parsedContr !== null
                                      ? i18n.t("settings.company.form.contractedPlanEffective", {
                                          value: formatBrlBrief(effective),
                                        })
                                      : null}
                                  </Typography>
                                </Box>
                                {deltaLine ? (
                                  <Typography variant="caption" color="secondary" component="div" style={{ marginTop: 6 }}>
                                    {deltaLine}
                                  </Typography>
                                ) : null}
                                <Box mt={1.5}>
                                  <AppNeutralButton
                                    type="button"
                                    size="small"
                                    disabled={loading}
                                    onClick={() => form.setFieldValue("contractedPlanValueStr", "")}
                                  >
                                    {i18n.t("settings.company.form.contractedPlanClear")}
                                  </AppNeutralButton>
                                </Box>
                              </>
                            );
                          }}
                        </Field>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 8 }}>
                          {i18n.t("platform.companies.storageSectionTitle")}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="textSecondary"
                          paragraph
                          style={{ marginBottom: 8 }}
                        >
                          {i18n.t("platform.companies.storageSectionHint")}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={8}>
                        <Field name="storageLimitGbStr">
                          {({ field }) => (
                            <TextField
                              {...field}
                              fullWidth
                              margin="dense"
                              variant="outlined"
                              label={i18n.t("platform.companies.storageLimitLabel")}
                              helperText={i18n.t("platform.companies.storageLimitHelper")}
                            />
                          )}
                        </Field>
                      </Grid>
                      <Grid item xs={12}>
                        <Field name="storageLimitGbStr">
                          {({ form }) => {
                            const selectedPlan = plans.find(
                              (p) => String(p.id) === String(form.values.planId)
                            );
                            const planGb =
                              selectedPlan?.storageLimitGb != null &&
                              selectedPlan?.storageLimitGb !== ""
                                ? String(selectedPlan.storageLimitGb).replace(".", ",")
                                : null;
                            return (
                              <Typography variant="caption" color="textSecondary" component="div">
                                <div style={{ marginBottom: 4 }}>
                                  {i18n.t("platform.companies.storagePreviewPlan", {
                                    value: planGb ? `${planGb} GB` : i18n.t("platform.companies.storageNoPlanLimit"),
                                  })}
                                </div>
                                <div style={{ marginBottom: 4 }}>
                                  {i18n.t("platform.companies.storagePreviewUsage", {
                                    used: form.values.storageUsedFormatted || "—",
                                    limit:
                                      form.values.storageLimitFormatted ||
                                      i18n.t("platform.companies.storageUnlimitedLabel"),
                                  })}
                                </div>
                              </Typography>
                            );
                          }}
                        </Field>
                      </Grid>
                      {initialValue?.id ? (
                        <>
                          <Grid item xs={12}>
                            <AppSecondaryButton
                              type="button"
                              startIcon={<Autorenew />}
                              disabled={loading}
                              onClick={async () => {
                                try {
                                  await api.post(
                                    `/companies/${initialValue.id}/recalculate-storage`
                                  );
                                  toast.success(i18n.t("platform.companies.storageRecalculated"));
                                  if (typeof reloadCompanySnapshot === "function") {
                                    await reloadCompanySnapshot();
                                  }
                                } catch (e) {
                                  toastError(e);
                                }
                              }}
                            >
                              {i18n.t("platform.companies.storageRecalculate")}
                            </AppSecondaryButton>
                          </Grid>
                          {storageSnapshots.length > 0 ? (
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 6 }}>
                                {i18n.t("platform.companies.storageHistoryTitle")}
                              </Typography>
                              <Box component="ul" style={{ paddingLeft: 18, margin: 0 }}>
                                {storageSnapshots.slice(0, 12).map((s) => (
                                  <li key={s.id} style={{ marginBottom: 4 }}>
                                    <Typography variant="caption" component="span" color="textSecondary">
                                      {moment(s.createdAt).format("DD/MM/YYYY HH:mm")} —{" "}
                                      {i18n.t(`platform.companies.storageSnapshotReason.${s.reason}`)} —{" "}
                                      {formatStorageBytesBrief(s.usedBytes)}
                                      {s.usagePercent != null && Number(s.limitBytes) > 0
                                        ? ` (${Number(s.usagePercent).toFixed(1)}%)`
                                        : ""}
                                    </Typography>
                                  </li>
                                ))}
                              </Box>
                            </Grid>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : null}
                </Grid>
              </AppSectionCard>

              {/* Bloco 3 — Módulos liberados */}
              <AppSectionCard>
                <Typography className={classes.sectionTitle} component="h2">
                  {i18n.t("settings.company.form.modulesSectionTitle")}
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.sectionSubtitle}
                >
                  {i18n.t("settings.company.form.modulesSectionHintV2")}
                </Typography>
                <Grid container spacing={2}>
                  {MODULE_TOGGLE_KEYS.map((key) => (
                    <Grid item xs={12} md={6} key={key}>
                      <Field name={`modulePermissions.${key}`}>
                        {({ field, form }) => {
                          const selectedPlan = plans.find(
                            (p) =>
                              String(p.id) === String(form.values.planId)
                          );
                          const noPlan =
                            !form.values.planId ||
                            form.values.planId === "" ||
                            !selectedPlan;
                          const isGroups = key === "useGroups";
                          const blocked = planBlocksCompanyModule(
                            key,
                            selectedPlan
                          );
                          const toggleDisabled =
                            blocked || (!isGroups && noPlan);
                          const originKey = getCompanyModuleOriginKey(
                            key,
                            form.values.modulePermissions,
                            selectedPlan
                          );
                          const originLabel = i18n.t(
                            `platform.moduleSettings.origin.${originKey}`
                          );
                          const effectiveOn = getCompanyModuleEffectiveEnabled(
                            key,
                            form.values.modulePermissions,
                            selectedPlan
                          );
                          return (
                            <ModuleToggleCard
                              title={i18n.t(
                                `settings.company.form.modules.${key}`
                              )}
                              description={i18n.t(
                                `settings.company.form.modules.${key}Help`
                              )}
                              originLabel={originLabel}
                              checked={effectiveOn}
                              disabled={toggleDisabled}
                              onChange={(e) => {
                                if (toggleDisabled) return;
                                form.setFieldValue(
                                  field.name,
                                  e.target.checked
                                );
                              }}
                              inputProps={{
                                "aria-label": i18n.t(
                                  `settings.company.form.modules.${key}`
                                ),
                              }}
                            />
                          );
                        }}
                      </Field>
                    </Grid>
                  ))}
                </Grid>
              </AppSectionCard>

              {/* Bloco 4 — Utilizadores */}
              {initialValue && initialValue.id ? (
                <AppSectionCard>
                  <Typography className={classes.sectionTitle} component="h2">
                    {i18n.t("settings.company.form.usersSectionTitle")}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    className={classes.sectionSubtitle}
                  >
                    {i18n.t("settings.company.form.usersSectionHint")}
                  </Typography>
                  {usersLoading ? (
                    <Box display="flex" alignItems="center" py={3} justifyContent="center">
                      <CircularProgress size={32} />
                    </Box>
                  ) : companyUsers.length === 0 ? (
                    <AppEmptyState title={i18n.t("settings.company.form.usersEmpty")} />
                  ) : (
                    <Box className={classes.usersScroll}>
                      <Table size="small" aria-label={i18n.t("settings.company.form.usersSectionTitle")}>
                        <TableHead>
                          <TableRow>
                            <TableCell>{i18n.t("users.table.name")}</TableCell>
                            <TableCell>{i18n.t("users.table.email")}</TableCell>
                            <TableCell>{i18n.t("users.table.profile")}</TableCell>
                            <TableCell>{i18n.t("users.table.online")}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {companyUsers.map((u) => (
                            <TableRow key={u.id}>
                              <TableCell>
                                <Typography variant="body2">{u.name || "—"}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="textSecondary">
                                  {u.email || "—"}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={formatUserProfile(u.profile)}
                                  color={profileChipColor(u.profile)}
                                  variant={profileChipColor(u.profile) === "default" ? "outlined" : "default"}
                                  className={classes.userProfileChip}
                                />
                              </TableCell>
                              <TableCell>
                                <Box display="flex" alignItems="center">
                                  <Box
                                    className={classes.userOnlineDot}
                                    style={{
                                      backgroundColor: u.online
                                        ? theme.palette.success.main
                                        : theme.palette.grey[400],
                                    }}
                                    aria-hidden
                                  />
                                  <Typography variant="body2" color="textSecondary" component="span">
                                    {formatUserOnline(u.online)}
                                  </Typography>
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                </AppSectionCard>
              ) : null}

              {/* Ações */}
              <Box className={classes.actionBar}>
                <Box className={classes.actionGroup}>
                  <AppNeutralButton type="button" onClick={() => onCancel()}>
                    {i18n.t("settings.company.buttons.clear")}
                  </AppNeutralButton>
                  {record.id !== undefined ? (
                    <>
                      <AppSecondaryButton type="button" onClick={() => handleOpenModalUsers()}>
                        {i18n.t("settings.company.buttons.manageUsers")}
                      </AppSecondaryButton>
                      <AppSecondaryButton type="button" onClick={() => incrementDueDate()}>
                        {i18n.t("settings.company.buttons.adjustDueDate")}
                      </AppSecondaryButton>
                    </>
                  ) : null}
                </Box>
                <Box className={classes.rightActions}>
                  {record.id !== undefined ? (
                    <Box className={classes.dangerZone}>
                      <Button
                        type="button"
                        variant="outlined"
                        className={classes.dangerDeleteButton}
                        startIcon={<DeleteOutline fontSize="small" />}
                        onClick={() => onDelete(record)}
                        aria-label={i18n.t("settings.company.buttons.delete")}
                      >
                        {i18n.t("settings.company.buttons.delete")}
                      </Button>
                    </Box>
                  ) : null}
                  <AppPrimaryButton type="submit" loading={loading}>
                    {i18n.t("settings.company.buttons.save")}
                  </AppPrimaryButton>
                </Box>
              </Box>
            </Box>
          </Form>
          <CompanyPlanChangeDialog
            open={Boolean(planChangeCtx)}
            onClose={(event, reason) => {
              if (reason !== "backdropClick" && reason !== "escapeKeyDown") {
                return;
              }
              setPlanChangeCtx((ctx) => {
                if (ctx) {
                  formik.setFieldValue("planId", ctx.prevPlanId);
                }
                return null;
              });
            }}
            onKeepModules={() => {
              if (!planChangeCtx) return;
              const nextPlanId = planChangeCtx.newPlan?.id;
              formik.setFieldValue(
                "modulePermissions",
                planChangeCtx.modulesBefore
              );
              if (nextPlanId != null && nextPlanId !== "") {
                formik.setFieldValue("planId", nextPlanId);
              }
              setPlanChangeCtx(null);
            }}
            onApplyPlanModules={() => {
              if (!planChangeCtx) return;
              const nextPlanId = planChangeCtx.newPlan?.id;
              formik.setFieldValue(
                "modulePermissions",
                mergeModulePermissionsFromPlan(
                  planChangeCtx.newPlan,
                  planChangeCtx.modulesBefore
                )
              );
              if (nextPlanId != null && nextPlanId !== "") {
                formik.setFieldValue("planId", nextPlanId);
              }
              setPlanChangeCtx(null);
            }}
          />
        </>
        )}
      </Formik>
    </>
  );
}

export function CompaniesManagerGrid(props) {
  const {
    records,
    onSelect,
    selectedId,
    onNewCompany,
    onAccessCompany,
    currentUserCompanyId,
    onToggleCompanyStatus,
    onOpenRenewDialog,
    onOpenDeleteDialog,
    onOpenInternalNotes,
    onOpenCompanyHistory,
  } = props;
  const classes = useStyles();
  const theme = useTheme();
  const { dateToClient, datetimeToClient } = useDate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("priority");
  const [dueFilter, setDueFilter] = useState("all");
  const [billingDialogRow, setBillingDialogRow] = useState(null);

  const gridOpsEnabled =
    typeof onToggleCompanyStatus === "function" &&
    typeof onOpenRenewDialog === "function" &&
    typeof onOpenDeleteDialog === "function";

  const billingMessagePreview = useMemo(
    () =>
      billingDialogRow ? buildBillingReminderMessage(billingDialogRow, dateToClient) : "",
    [billingDialogRow, dateToClient]
  );

  const billingWhatsAppDigits = billingDialogRow ? digitsForWhatsApp(billingDialogRow.phone) : "";

  const openBillingDialog = (e, row) => {
    e.stopPropagation();
    setBillingDialogRow(row);
  };

  const handleBillingCopy = async () => {
    try {
      await navigator.clipboard.writeText(billingMessagePreview);
      toast.success(i18n.t("platform.companies.billingCopiedToast"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleBillingWhatsApp = () => {
    if (!billingWhatsAppDigits) return;
    const url = `https://wa.me/${billingWhatsAppDigits}?text=${encodeURIComponent(billingMessagePreview)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const filteredRecords = useMemo(() => {
    let list = Array.isArray(records) ? [...records] : [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (row) =>
          (row.name || "").toLowerCase().includes(q) ||
          (row.email || "").toLowerCase().includes(q) ||
          (row.phone || "").toLowerCase().includes(q)
      );
    }
    if (dueFilter === "expired") {
      list = list.filter((row) => getDueCategory(row).category === "expired");
    } else if (dueFilter === "today") {
      list = list.filter((row) => getDueCategory(row).category === "today");
    } else if (dueFilter === "soon3") {
      list = list.filter((row) => getDueCategory(row).category === "soon");
    } else if (dueFilter === "ok") {
      list = list.filter((row) => {
        const c = getDueCategory(row).category;
        return c === "ok" || c === "neutral";
      });
    } else if (dueFilter === "blocked") {
      list = list.filter((row) => row.status === false);
    } else if (dueFilter === "active") {
      list = list.filter((row) => row.status !== false);
    }
    if (sortBy === "priority") {
      list.sort(comparePriorityDue);
    } else if (sortBy === "name") {
      list.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    } else if (sortBy === "dueDate") {
      list.sort(compareByDueDateAsc);
    } else if (sortBy === "plan") {
      list.sort((a, b) =>
        planNameForSort(a).localeCompare(planNameForSort(b), undefined, { sensitivity: "base" })
      );
    } else if (sortBy === "status") {
      list.sort(compareByStatusBlockedFirst);
    } else if (sortBy === "createdAt") {
      list.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      );
    }
    return list;
  }, [records, search, sortBy, dueFilter]);

  const dueFilterCounts = useMemo(() => {
    const base = Array.isArray(records) ? records : [];
    let expired = 0;
    let today = 0;
    let soon3 = 0;
    let ok = 0;
    let blocked = 0;
    let active = 0;
    base.forEach((row) => {
      const c = getDueCategory(row).category;
      if (c === "expired") expired += 1;
      else if (c === "today") today += 1;
      else if (c === "soon") soon3 += 1;
      else ok += 1;
      if (row.status === false) blocked += 1;
      else active += 1;
    });
    return { all: base.length, expired, today, soon3, ok, blocked, active };
  }, [records]);

  const renderPlan = (row) => {
    return row.planId !== null ? row.plan.name : "—";
  };

  const renderCompanyTooltip = (row) => {
    const adminName = row.primaryAdmin?.name || i18n.t("settings.company.form.noPrimaryAdmin");
    const adminEmail = row.primaryAdmin?.email || "—";
    const companyEmail = row.email || "—";
    const phone = row.phone || "—";
    const created = row.createdAt ? dateToClient(row.createdAt) : "—";
    const campaigns = campaignsLabelForRow(row);
    return (
      <Box maxWidth={320}>
        <Typography variant="subtitle2" className={classes.tooltipDetailValue} component="p">
          {row.name || "—"}
        </Typography>
        <Typography className={classes.tooltipDetailLabel} component="p">
          {i18n.t("settings.company.form.primaryAdmin")}
        </Typography>
        <Typography className={classes.tooltipDetailValue} component="p">
          {adminName}
          {adminEmail && adminEmail !== "—" ? `\n${adminEmail}` : ""}
        </Typography>
        <Typography className={classes.tooltipDetailLabel} component="p">
          {i18n.t("settings.company.form.email")}
        </Typography>
        <Typography className={classes.tooltipDetailValue} component="p">
          {companyEmail}
        </Typography>
        <Typography className={classes.tooltipDetailLabel} component="p">
          {i18n.t("settings.company.form.phone")}
        </Typography>
        <Typography className={classes.tooltipDetailValue} component="p">
          {phone}
        </Typography>
        <Typography className={classes.tooltipDetailLabel} component="p">
          {i18n.t("settings.company.form.campanhas")}
        </Typography>
        <Typography className={classes.tooltipDetailValue} component="p">
          {campaigns}
        </Typography>
        <Typography className={classes.tooltipDetailLabel} component="p">
          {i18n.t("settings.company.form.createdAt")}
        </Typography>
        <Typography className={classes.tooltipDetailValue} component="p">
          {created}
        </Typography>
      </Box>
    );
  };

  return (
    <AppSectionCard>
      <Typography className={classes.sectionTitle} component="h2">
        {i18n.t("platform.companies.registeredListTitle")}
      </Typography>
      <Typography
        variant="body2"
        color="textSecondary"
        className={classes.registeredSectionSubtitle}
      >
        {i18n.t("platform.companies.registeredListSubtitle")}
      </Typography>
      <Typography variant="caption" color="textSecondary" display="block" style={{ marginBottom: 16 }}>
        {i18n.t("platform.companies.listRowHint")}
      </Typography>
      <Box className={classes.filterChipsRow}>
        <Chip
          size="small"
          label={i18n.t("platform.companies.filterAll", { count: dueFilterCounts.all })}
          clickable
          color={dueFilter === "all" ? "primary" : "default"}
          variant={dueFilter === "all" ? "default" : "outlined"}
          onClick={() => setDueFilter("all")}
        />
        <Chip
          size="small"
          label={i18n.t("platform.companies.filterExpired", { count: dueFilterCounts.expired })}
          clickable
          color={dueFilter === "expired" ? "primary" : "default"}
          variant={dueFilter === "expired" ? "default" : "outlined"}
          onClick={() => setDueFilter("expired")}
        />
        <Chip
          size="small"
          label={i18n.t("platform.companies.filterToday", { count: dueFilterCounts.today })}
          clickable
          color={dueFilter === "today" ? "primary" : "default"}
          variant={dueFilter === "today" ? "default" : "outlined"}
          onClick={() => setDueFilter("today")}
        />
        <Chip
          size="small"
          label={i18n.t("platform.companies.filterNext3Days", { count: dueFilterCounts.soon3 })}
          clickable
          color={dueFilter === "soon3" ? "primary" : "default"}
          variant={dueFilter === "soon3" ? "default" : "outlined"}
          onClick={() => setDueFilter("soon3")}
        />
        <Chip
          size="small"
          label={i18n.t("platform.companies.filterOk", { count: dueFilterCounts.ok })}
          clickable
          color={dueFilter === "ok" ? "primary" : "default"}
          variant={dueFilter === "ok" ? "default" : "outlined"}
          onClick={() => setDueFilter("ok")}
        />
        <Chip
          size="small"
          label={i18n.t("platform.companies.filterBlocked", { count: dueFilterCounts.blocked })}
          clickable
          color={dueFilter === "blocked" ? "primary" : "default"}
          variant={dueFilter === "blocked" ? "default" : "outlined"}
          onClick={() => setDueFilter("blocked")}
        />
        <Chip
          size="small"
          label={i18n.t("platform.companies.filterActive", { count: dueFilterCounts.active })}
          clickable
          color={dueFilter === "active" ? "primary" : "default"}
          variant={dueFilter === "active" ? "default" : "outlined"}
          onClick={() => setDueFilter("active")}
        />
      </Box>
      <Box className={classes.tableToolbar}>
        {typeof onNewCompany === "function" ? (
          <AppPrimaryButton
            type="button"
            onClick={onNewCompany}
            style={{ flexShrink: 0 }}
          >
            {i18n.t("platform.companies.newCompany")}
          </AppPrimaryButton>
        ) : null}
        <TextField
          size="small"
          variant="outlined"
          placeholder={i18n.t("platform.companies.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
          style={{ minWidth: 220, flex: "1 1 200px" }}
        />
        <FormControl variant="outlined" size="small" style={{ minWidth: 228 }}>
          <InputLabel id="companies-sort-label">{i18n.t("platform.companies.sortLabel")}</InputLabel>
          <Select
            labelId="companies-sort-label"
            label={i18n.t("platform.companies.sortLabel")}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <MenuItem value="priority">{i18n.t("platform.companies.sortByPriority")}</MenuItem>
            <MenuItem value="name">{i18n.t("platform.companies.sortByName")}</MenuItem>
            <MenuItem value="dueDate">{i18n.t("platform.companies.sortByDueDate")}</MenuItem>
            <MenuItem value="plan">{i18n.t("platform.companies.sortByPlan")}</MenuItem>
            <MenuItem value="status">{i18n.t("platform.companies.sortByStatus")}</MenuItem>
            <MenuItem value="createdAt">{i18n.t("platform.companies.sortByDate")}</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <AppTableContainer className={classes.tableContainer} nested>
        <Table
          className={classes.fullWidth}
          size="small"
          aria-label="companies"
          style={{ tableLayout: "fixed", width: "100%" }}
        >
          <TableHead>
            <TableRow>
              <TableCell
                align="center"
                className={classes.tableHeadCell}
                style={{ width: 252, minWidth: 252 }}
              >
                {i18n.t("platform.companies.actionsColumn")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: "28%" }}>
                {i18n.t("platform.companies.columnCompany")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: "16%" }}>
                {i18n.t("settings.company.form.plan")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: 108 }}>
                {i18n.t("settings.company.form.status")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: 168 }}>
                {i18n.t("settings.company.form.expire")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: 160 }}>
                {i18n.t("platform.companies.columnStorage")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: 132 }}>
                {i18n.t("platform.companies.columnFinance")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRecords.map((row) => {
              const isSelected = selectedId != null && row.id === selectedId;
              const dueMeta = getDueDisplayMeta(row, dateToClient);
              const financeLabel = getFinanceStateLabel(dueMeta.category);
              const effectiveAmount = getCompanyEffectivePlanValue(row);
              const planValueStr = formatPlanValueDiscrete(effectiveAmount);
              const contractedCustom =
                row.contractedPlanValue != null && row.contractedPlanValue !== "";
              const catalogStr =
                row.plan?.value !== undefined && row.plan?.value !== null
                  ? formatPlanValueDiscrete(row.plan.value)
                  : null;
              const adminName = row.primaryAdmin?.name || i18n.t("settings.company.form.noPrimaryAdmin");
              const adminEmail = row.primaryAdmin?.email || "";
              const planTitle = renderPlan(row);
              const recurrenceLine = row.recurrence ? String(row.recurrence) : "";
              return (
                <TableRow
                  key={row.id}
                  className={`${classes.tableRow} ${isSelected ? classes.tableRowSelected : ""}`}
                  onClick={() => onSelect(row)}
                  selected={isSelected}
                >
                  <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                    <Box display="flex" justifyContent="center" alignItems="center" flexWrap="wrap" style={{ gap: 2 }}>
                      {typeof onAccessCompany === "function" ? (
                        <Tooltip title={i18n.t("platform.companies.accessCompany")} arrow enterDelay={300}>
                          <IconButton
                            size="small"
                            style={{ color: theme.palette.secondary.main }}
                            onClick={() => onAccessCompany(row)}
                            aria-label={i18n.t("platform.companies.accessCompany")}
                          >
                            <HeadsetMic fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      <Tooltip title={i18n.t("platform.companies.editRow")} arrow enterDelay={300}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => onSelect(row)}
                          aria-label={i18n.t("platform.companies.editRow")}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {typeof onOpenInternalNotes === "function" ? (
                        <Tooltip
                          title={i18n.t("platform.companies.internalNotesTooltip")}
                          arrow
                          enterDelay={300}
                        >
                          <IconButton
                            size="small"
                            onClick={() => onOpenInternalNotes(row)}
                            aria-label={i18n.t("platform.companies.internalNotesTooltip")}
                          >
                            <NoteOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      {typeof onOpenCompanyHistory === "function" ? (
                        <Tooltip
                          title={i18n.t("platform.companies.companyHistoryTooltip")}
                          arrow
                          enterDelay={300}
                        >
                          <IconButton
                            size="small"
                            onClick={() => onOpenCompanyHistory(row)}
                            aria-label={i18n.t("platform.companies.companyHistoryTooltip")}
                          >
                            <History fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      {gridOpsEnabled ? (
                        <>
                          <Tooltip
                            title={
                              row.status === false
                                ? i18n.t("platform.companies.unblockCompany")
                                : i18n.t("platform.companies.blockCompany")
                            }
                            arrow
                            enterDelay={300}
                          >
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => onToggleCompanyStatus(row)}
                                disabled={row.id === currentUserCompanyId}
                                aria-label={
                                  row.status === false
                                    ? i18n.t("platform.companies.unblockCompany")
                                    : i18n.t("platform.companies.blockCompany")
                                }
                              >
                                {row.status === false ? (
                                  <LockOpen fontSize="small" />
                                ) : (
                                  <LockOutlined fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={i18n.t("platform.companies.renewCompany")} arrow enterDelay={300}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => onOpenRenewDialog(row)}
                                disabled={!previewRenewedDueDate(row)}
                                aria-label={i18n.t("platform.companies.renewCompany")}
                              >
                                <Autorenew fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={i18n.t("platform.companies.billingActionTooltip")} arrow enterDelay={300}>
                            <IconButton
                              size="small"
                              onClick={(e) => openBillingDialog(e, row)}
                              aria-label={i18n.t("platform.companies.billingActionTooltip")}
                            >
                              <ChatBubbleOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={i18n.t("platform.companies.deleteCompanyAction")} arrow enterDelay={300}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => onOpenDeleteDialog(row)}
                                disabled={row.id === currentUserCompanyId}
                                aria-label={i18n.t("platform.companies.deleteCompanyAction")}
                                style={{ color: theme.palette.error.main }}
                              >
                                <DeleteForever fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      ) : null}
                    </Box>
                  </TableCell>
                  <TableCell align="left" className={classes.companyCell}>
                    <Tooltip
                      title={renderCompanyTooltip(row)}
                      arrow
                      interactive
                      enterDelay={400}
                      leaveDelay={200}
                    >
                      <Box minWidth={0}>
                        <Typography className={classes.companyNameLine} component="div">
                          {row.name || "—"}
                        </Typography>
                        <Typography className={classes.companyAdminLine} component="div">
                          {adminName}
                        </Typography>
                        {adminEmail ? (
                          <Typography className={classes.companyEmailLine} component="div">
                            {adminEmail}
                          </Typography>
                        ) : null}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="left">
                    <Tooltip
                      title={recurrenceLine ? `${planTitle} · ${recurrenceLine}` : planTitle}
                      arrow
                      disableHoverListener={
                        planTitle.length < 28 && (recurrenceLine || "").length < 20
                      }
                      enterDelay={400}
                    >
                      <Box minWidth={0}>
                        <Typography variant="body2" className={classes.planCell} component="div">
                          {planTitle}
                        </Typography>
                        {recurrenceLine ? (
                          <Typography component="div" className={classes.planRecurrenceCaption}>
                            {recurrenceLine}
                          </Typography>
                        ) : null}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="left">
                    <Chip
                      size="small"
                      label={
                        row.status === false
                          ? i18n.t("platform.companies.statusInactive")
                          : i18n.t("platform.companies.statusActive")
                      }
                      classes={{
                        root:
                          row.status === false
                            ? classes.statusChipInactive
                            : classes.statusChipActive,
                      }}
                    />
                  </TableCell>
                  <TableCell align="left" className={classes.dueCell}>
                    <Tooltip
                      title={<span style={{ whiteSpace: "pre-line" }}>{dueMeta.tooltip}</span>}
                      arrow
                      enterDelay={300}
                    >
                      <Box display="flex" alignItems="flex-start" minWidth={0}>
                        {(dueMeta.tone === "expired" || dueMeta.tone === "soon") ? (
                          <Tooltip
                            title={
                              dueMeta.tone === "expired"
                                ? i18n.t("platform.companies.dueAlertExpiredTooltip")
                                : i18n.t("platform.companies.dueAlertSoonTooltip")
                            }
                            arrow
                            enterDelay={400}
                          >
                            <Warning
                              fontSize="small"
                              style={{
                                flexShrink: 0,
                                marginRight: 6,
                                marginTop: 2,
                                color:
                                  dueMeta.tone === "expired"
                                    ? theme.palette.error.main
                                    : theme.palette.type === "dark"
                                      ? "#ffee58"
                                      : "#f9a825",
                              }}
                              aria-hidden
                            />
                          </Tooltip>
                        ) : null}
                        <Box minWidth={0} flex={1}>
                        <Typography
                          component="div"
                          className={`${classes.dueDatePrimary} ${classes[dueMeta.dueClassKey]}`}
                        >
                          {dueMeta.dateLabel}
                        </Typography>
                        {dueMeta.shortLabel ? (
                          <Typography
                            component="div"
                            className={`${classes.dueShortLabel} ${classes[dueMeta.dueClassKey]}`}
                          >
                            {dueMeta.shortLabel}
                          </Typography>
                        ) : null}
                        {dueMeta.recurrence ? (
                          <Typography
                            variant="caption"
                            component="div"
                            style={{ color: theme.palette.text.secondary, marginTop: 2 }}
                          >
                            {dueMeta.recurrence}
                          </Typography>
                        ) : null}
                        </Box>
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="left" style={{ verticalAlign: "top" }}>
                    <Tooltip
                      title={
                        <span style={{ whiteSpace: "pre-line" }}>
                          {`${companyStorageStatusLabel(row.storageAlertLevel)}\n${
                            row.storageCalculatedAt
                              ? i18n.t("platform.companies.storageUpdatedTooltip", {
                                  date: datetimeToClient(row.storageCalculatedAt),
                                })
                              : i18n.t("platform.companies.storageUpdatedUnknown")
                          }`}
                        </span>
                      }
                      arrow
                      enterDelay={320}
                    >
                      <Box minWidth={0}>
                        <Typography
                          variant="caption"
                          display="block"
                          style={{ lineHeight: 1.35, wordBreak: "break-word" }}
                        >
                          {row.storageLimitFormatted != null
                            ? `${row.storageUsedFormatted || "—"} / ${row.storageLimitFormatted}`
                            : i18n.t("platform.companies.storageListUnlimited", {
                                used: row.storageUsedFormatted || "—",
                              })}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 2 }}>
                          {companyStorageStatusLabel(row.storageAlertLevel)}
                        </Typography>
                        {row.storageUsagePercent != null ? (
                          <Box
                            style={{
                              marginTop: 6,
                              height: 6,
                              borderRadius: 3,
                              overflow: "hidden",
                              backgroundColor: theme.palette.action.hover,
                            }}
                          >
                            <Box
                              style={{
                                width: `${Math.min(100, Number(row.storageUsagePercent) || 0)}%`,
                                height: "100%",
                                backgroundColor: companyStorageBarColor(
                                  Number(row.storageUsagePercent),
                                  theme.palette
                                ),
                                transition: "width 0.25s ease",
                              }}
                            />
                          </Box>
                        ) : null}
                      </Box>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="left" className={classes.financeCell}>
                    <Tooltip
                      title={
                        <span style={{ whiteSpace: "pre-line" }}>
                          {`${financeLabel}\n${dueMeta.tooltip}`}
                        </span>
                      }
                      arrow
                      enterDelay={280}
                    >
                      <Box minWidth={0}>
                        <Typography
                          component="div"
                          className={`${classes.dueDatePrimary} ${classes[dueMeta.dueClassKey]}`}
                          style={{ fontSize: "0.8125rem" }}
                        >
                          {financeLabel}
                        </Typography>
                        {planValueStr ? (
                          <>
                            <Typography className={classes.financeValueMuted} component="div">
                              {planValueStr}
                            </Typography>
                            {contractedCustom && catalogStr ? (
                              <Box mt={0.5}>
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={i18n.t("platform.companies.contractedBadge")}
                                  style={{
                                    height: 22,
                                    marginBottom: 4,
                                  }}
                                />
                                <Typography variant="caption" component="div" color="textSecondary">
                                  {i18n.t("platform.companies.contractedComparedToPlan", {
                                    value: catalogStr,
                                  })}
                                </Typography>
                              </Box>
                            ) : null}
                          </>
                        ) : null}
                      </Box>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </AppTableContainer>

      <Dialog
        open={Boolean(billingDialogRow)}
        onClose={() => setBillingDialogRow(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{i18n.t("platform.companies.billingDialogTitle")}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="textSecondary" display="block" paragraph>
            {billingDialogRow
              ? `${billingDialogRow.name || "—"} · ${dateToClient(billingDialogRow.dueDate) || "—"}`
              : ""}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={5}
            variant="outlined"
            size="small"
            value={billingMessagePreview}
            InputProps={{
              readOnly: true,
              className: classes.billingMessageField,
            }}
          />
          {!billingWhatsAppDigits ? (
            <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 8 }}>
              {i18n.t("platform.companies.billingPhoneMissingHint")}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBillingDialogRow(null)} color="primary">
            {i18n.t("confirmationModal.buttons.cancel")}
          </Button>
          <Button onClick={handleBillingCopy} color="primary">
            {i18n.t("platform.companies.billingCopyButton")}
          </Button>
          <Button
            onClick={handleBillingWhatsApp}
            color="primary"
            variant="contained"
            disabled={!billingWhatsAppDigits}
          >
            {i18n.t("platform.companies.billingOpenWhatsApp")}
          </Button>
        </DialogActions>
      </Dialog>
    </AppSectionCard>
  );
}

export default function CompaniesManager() {
  const classes = useStyles();
  const { list, save, update, remove, renewDueDate, fetchCompanyLogs, finding } = useCompanies();
  const { user, enterSupportMode } = useContext(AuthContext);
  const { dateToClient, datetimeToClient } = useDate();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [blockDialogRow, setBlockDialogRow] = useState(null);
  const [renewDialogRow, setRenewDialogRow] = useState(null);
  const [gridDeleteRow, setGridDeleteRow] = useState(null);
  const [gridDeleteNameInput, setGridDeleteNameInput] = useState("");
  const [internalNotesRow, setInternalNotesRow] = useState(null);
  const [internalNotesDraft, setInternalNotesDraft] = useState("");
  const [internalNotesSaving, setInternalNotesSaving] = useState(false);
  const [historyRow, setHistoryRow] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [storageSnapshots, setStorageSnapshots] = useState([]);
  const [primaryAdminSetupDialog, setPrimaryAdminSetupDialog] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [record, setRecord] = useState({
    name: "",
    email: "",
    phone: "",
    planId: "",
    status: true,
    campaignsEnabled: false,
    dueDate: "",
    recurrence: "",
    timezone: "America/Sao_Paulo",
    contractedPlanValueStr: "",
    storageLimitGbStr: "",
    storageUsedFormatted: null,
    storageLimitFormatted: null,
    storageUsagePercent: null,
    storageCalculatedAt: null,
    storageAlertLevel: "ok",
    modulePermissions: defaultModulePermissions(),
    primaryAdmin: null,
    businessSegment: "general",
    crmVisibilityMode: "all",
  });

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const companyList = await list();
      setRecords(companyList);
    } catch (e) {
      toast.error(i18n.t("settings.company.toasts.errorList"));
    }
    setLoading(false);
  };

  const loadStorageSnapshotsForCompany = useCallback(async (companyId) => {
    if (!companyId) {
      setStorageSnapshots([]);
      return;
    }
    try {
      const { data } = await api.get(`/companies/${companyId}/storage-snapshots`);
      setStorageSnapshots(Array.isArray(data) ? data : []);
    } catch (e) {
      setStorageSnapshots([]);
    }
  }, []);

  const reloadCompanySnapshot = useCallback(async () => {
    if (!record.id) return;
    try {
      const data = await finding(record.id);
      setRecord((prev) => ({
        ...prev,
        ...data,
        contractedPlanValueStr:
          data.contractedPlanValue != null && data.contractedPlanValue !== ""
            ? formatPlanValueForInput(data.contractedPlanValue)
            : "",
        storageLimitGbStr: formatGbInputFromApi(data.storageLimitGb),
        storageUsedFormatted: data.storageUsedFormatted ?? null,
        storageLimitFormatted: data.storageLimitFormatted ?? null,
        storageUsagePercent:
          data.storageUsagePercent != null ? Number(data.storageUsagePercent) : null,
        storageCalculatedAt: data.storageCalculatedAt ?? null,
        storageAlertLevel: data.storageAlertLevel ?? "ok",
        modulePermissions: mergeModulePermissions(data.modulePermissions),
        businessSegment: data.businessSegment || "general",
        crmVisibilityMode: data.crmVisibilityMode || "all",
      }));
      await loadStorageSnapshotsForCompany(record.id);
    } catch (e) {
      toastError(e);
    }
  }, [record.id, finding, loadStorageSnapshotsForCompany]);

  const handleSubmit = async (data) => {
    setLoading(true);
    try {
      if (data.id !== 0 && data.id !== undefined) {
        await update(data);
      } else {
        const created = await save(data);
        if (created?.primaryAdminSetup) {
          const s = created.primaryAdminSetup;
          if (s.temporaryPassword || s.inviteEmailSent !== true) {
            setPrimaryAdminSetupDialog(s);
          }
        }
      }

      await loadPlans();
      handleCancel();
      toast.success(i18n.t("settings.company.toasts.success"));
    } catch (e) {
      toast.error(
        i18n.t("settings.company.toasts.error")
      );
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await remove(record.id);
      await loadPlans();
      handleCancel();
      toast.success(i18n.t("settings.company.toasts.success"));
    } catch (e) {
      toast.error(i18n.t("settings.company.toasts.errorOperation"));
    }
    setLoading(false);
  };

  const handleOpenDeleteDialog = () => {
    setShowConfirmDialog(true);
  };

  const handleCancel = () => {
    setFormOpen(false);
    setStorageSnapshots([]);
    setRecord((prev) => ({
      ...prev,
      id: undefined,
      name: "",
      email: "",
      phone: "",
      planId: "",
      status: true,
      campaignsEnabled: false,
      dueDate: "",
      recurrence: "",
      timezone: "America/Sao_Paulo",
      contractedPlanValueStr: "",
      storageLimitGbStr: "",
      storageUsedFormatted: null,
      storageLimitFormatted: null,
      storageUsagePercent: null,
      storageCalculatedAt: null,
      storageAlertLevel: "ok",
      modulePermissions: defaultModulePermissions(),
      primaryAdmin: null,
    }));
  };

  const handleNewCompany = () => {
    setStorageSnapshots([]);
    setRecord({
      name: "",
      email: "",
      phone: "",
      planId: "",
      status: true,
      campaignsEnabled: false,
      dueDate: "",
      recurrence: "",
      timezone: "America/Sao_Paulo",
      contractedPlanValueStr: "",
      storageLimitGbStr: "",
      storageUsedFormatted: null,
      storageLimitFormatted: null,
      storageUsagePercent: null,
      storageCalculatedAt: null,
      storageAlertLevel: "ok",
      modulePermissions: defaultModulePermissions(),
      primaryAdmin: null,
    });
    setFormOpen(true);
  };

  const handleSelect = (data) => {
    let campaignsEnabled = false;

    const setting = (data.settings || []).find(
      (s) => s.key.indexOf("campaignsEnabled") > -1
    );
    if (setting) {
      campaignsEnabled =
        setting.value === "true" || setting.value === "enabled";
    }

    setRecord((prev) => ({
      ...prev,
      id: data.id,
      name: data.name || "",
      phone: data.phone || "",
      email: data.email || "",
      planId: data.planId || "",
      status: data.status === false ? false : true,
      campaignsEnabled,
      dueDate: data.dueDate || "",
      recurrence: data.recurrence || "",
      timezone: data.timezone || "America/Sao_Paulo",
      contractedPlanValueStr:
        data.contractedPlanValue != null && data.contractedPlanValue !== ""
          ? formatPlanValueForInput(data.contractedPlanValue)
          : "",
      storageLimitGbStr: formatGbInputFromApi(data.storageLimitGb),
      storageUsedFormatted: data.storageUsedFormatted ?? null,
      storageLimitFormatted: data.storageLimitFormatted ?? null,
      storageUsagePercent:
        data.storageUsagePercent != null ? Number(data.storageUsagePercent) : null,
      storageCalculatedAt: data.storageCalculatedAt ?? null,
      storageAlertLevel: data.storageAlertLevel ?? "ok",
      modulePermissions: mergeModulePermissions(data.modulePermissions),
      primaryAdmin: data.primaryAdmin ?? null,
    }));
    setFormOpen(true);
    loadStorageSnapshotsForCompany(data.id);
  };

  const history = useHistory();
  const location = useLocation();
  const handleSelectRef = useRef(() => {});
  handleSelectRef.current = handleSelect;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fid = params.get("focus");
    if (!fid || records.length === 0) return;
    const id = Number(fid);
    if (Number.isNaN(id)) return;
    const row = records.find((r) => r.id === id);
    if (!row) return;
    handleSelectRef.current(row);
    history.replace({ pathname: "/saas/companies" });
  }, [location.search, records, history]);

  const openGridDeleteDialog = (row) => {
    setGridDeleteRow(row);
    setGridDeleteNameInput("");
  };

  const handleConfirmBlockToggle = async () => {
    const row = blockDialogRow;
    if (!row) return;
    setBlockDialogRow(null);
    try {
      await update({ id: row.id, status: row.status === false ? true : false });
      await loadPlans();
      toast.success(i18n.t("platform.companies.statusUpdateSuccess"));
    } catch (e) {
      toastError(e);
    }
  };

  const handleConfirmRenew = async () => {
    const row = renewDialogRow;
    if (!row) return;
    try {
      const data = await renewDueDate(row.id);
      setRenewDialogRow(null);
      await loadPlans();
      toast.success(
        data?.autoUnblocked
          ? i18n.t("platform.companies.renewSuccessReactivated")
          : i18n.t("platform.companies.renewSuccess")
      );
    } catch (e) {
      toastError(e);
    }
  };

  const handleConfirmGridDelete = async () => {
    const row = gridDeleteRow;
    if (!row) return;
    const expected = (row.name || "").trim();
    if (gridDeleteNameInput.trim() !== expected) return;
    try {
      await remove(row.id);
      setGridDeleteRow(null);
      setGridDeleteNameInput("");
      await loadPlans();
      toast.success(i18n.t("platform.companies.deleteGridSuccess"));
    } catch (e) {
      toastError(e);
    }
  };

  const handleSaveInternalNotes = async () => {
    if (!internalNotesRow) return;
    setInternalNotesSaving(true);
    try {
      await update({
        id: internalNotesRow.id,
        internalNotes: internalNotesDraft,
      });
      await loadPlans();
      toast.success(i18n.t("platform.companies.internalNotesSaved"));
      setInternalNotesRow(null);
    } catch (e) {
      toastError(e);
    } finally {
      setInternalNotesSaving(false);
    }
  };

  const openCompanyHistory = async (row) => {
    setHistoryRow(row);
    setHistoryItems([]);
    setHistoryLoading(true);
    try {
      const items = await fetchCompanyLogs(row.id);
      setHistoryItems(Array.isArray(items) ? items : []);
    } catch (e) {
      toastError(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const gridOpsEnabled = Boolean(user?.super);
  const renewPreviewDate =
    renewDialogRow && previewRenewedDueDate(renewDialogRow)
      ? dateToClient(previewRenewedDueDate(renewDialogRow))
      : null;
  const renewBaseUsesCurrentDue =
    renewDialogRow?.dueDate &&
    moment(renewDialogRow.dueDate).isValid() &&
    moment(renewDialogRow.dueDate).startOf("day").isSameOrAfter(moment().startOf("day"));

  return (
    <Box className={classes.pageStack}>
      <CompaniesManagerGrid
        records={records}
        onSelect={handleSelect}
        selectedId={record.id}
        onNewCompany={handleNewCompany}
        onAccessCompany={
          user?.super && !user?.supportMode ? (row) => enterSupportMode(row.id) : undefined
        }
        currentUserCompanyId={user?.companyId}
        onToggleCompanyStatus={gridOpsEnabled ? (r) => setBlockDialogRow(r) : undefined}
        onOpenRenewDialog={gridOpsEnabled ? (r) => setRenewDialogRow(r) : undefined}
        onOpenDeleteDialog={gridOpsEnabled ? openGridDeleteDialog : undefined}
        onOpenInternalNotes={
          gridOpsEnabled
            ? (r) => {
                setInternalNotesRow(r);
                setInternalNotesDraft(r.internalNotes || "");
              }
            : undefined
        }
        onOpenCompanyHistory={gridOpsEnabled ? openCompanyHistory : undefined}
      />
      {formOpen ? (
        <>
          {record.id !== undefined ? (
            <Box className={classes.editingBanner}>
              <Typography className={classes.editingBannerTitle} component="p">
                {i18n.t("settings.company.form.editingBanner", { name: record.name || "—" })}
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
                className={classes.editingBannerHint}
                component="p"
              >
                {i18n.t("settings.company.form.editingContextHint")}
              </Typography>
            </Box>
          ) : null}
          <CompanyForm
            initialValue={record}
            onDelete={handleOpenDeleteDialog}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
            reloadCompanySnapshot={reloadCompanySnapshot}
            storageSnapshots={storageSnapshots}
          />
        </>
      ) : null}
      <ConfirmationModal
        title={i18n.t("settings.company.confirmModal.title")}
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => handleDelete()}
      >
        {i18n.t("settings.company.confirmModal.confirm")}
      </ConfirmationModal>

      <Dialog
        open={Boolean(primaryAdminSetupDialog)}
        onClose={() => setPrimaryAdminSetupDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{i18n.t("platform.companies.primaryAdminDialogTitle")}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            {i18n.t("platform.companies.primaryAdminDialogIntro")}
          </Typography>
          {primaryAdminSetupDialog?.inviteEmailSent ? (
            <Alert severity="info" style={{ marginBottom: 12 }}>
              {i18n.t("platform.companies.primaryAdminInviteSent")}
            </Alert>
          ) : null}
          <TextField
            fullWidth
            margin="dense"
            label={i18n.t("platform.companies.primaryAdminEmail")}
            value={primaryAdminSetupDialog?.email || ""}
            InputProps={{ readOnly: true }}
            variant="outlined"
          />
          {primaryAdminSetupDialog?.temporaryPassword ? (
            <TextField
              fullWidth
              margin="dense"
              label={i18n.t("platform.companies.primaryAdminTempPassword")}
              value={primaryAdminSetupDialog.temporaryPassword}
              InputProps={{ readOnly: true }}
              variant="outlined"
              helperText={i18n.t("platform.companies.primaryAdminMustChange")}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPrimaryAdminSetupDialog(null)}
            color="primary"
            variant="contained"
          >
            {i18n.t("confirmationModal.buttons.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(blockDialogRow)} onClose={() => setBlockDialogRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {blockDialogRow?.status === false
            ? i18n.t("platform.companies.confirmUnblockTitle")
            : i18n.t("platform.companies.confirmBlockTitle")}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" component="p">
            {blockDialogRow?.status === false
              ? i18n.t("platform.companies.confirmUnblockMessage", {
                  name: blockDialogRow?.name || "—",
                })
              : i18n.t("platform.companies.confirmBlockMessage", {
                  name: blockDialogRow?.name || "—",
                })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBlockDialogRow(null)} color="primary">
            {i18n.t("confirmationModal.buttons.cancel")}
          </Button>
          <Button onClick={handleConfirmBlockToggle} color="primary" variant="contained">
            {i18n.t("confirmationModal.buttons.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(renewDialogRow)} onClose={() => setRenewDialogRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("platform.companies.renewDialogTitle")}</DialogTitle>
        <DialogContent dividers>
          {renewDialogRow && renewPreviewDate ? (
            <Box display="flex" flexDirection="column" style={{ gap: 10 }}>
              <Typography variant="subtitle1" component="p" style={{ fontWeight: 600 }}>
                {renewDialogRow.name || "—"}
              </Typography>
              <Typography variant="body2" color="textSecondary" component="p">
                <strong>{i18n.t("settings.company.form.plan")}:</strong>{" "}
                {renewDialogRow.plan?.name || "—"}
              </Typography>
              <Typography variant="body2" color="textSecondary" component="p">
                <strong>{i18n.t("settings.company.form.expire")}:</strong>{" "}
                {renewDialogRow.dueDate ? dateToClient(renewDialogRow.dueDate) : "—"}
              </Typography>
              <Typography variant="body2" color="textSecondary" component="p">
                <strong>{i18n.t("platform.companies.renewDialogRecurrence")}:</strong>{" "}
                {renewDialogRow.recurrence || "—"}
              </Typography>
              <Typography variant="body2" component="p">
                <strong>{i18n.t("platform.companies.renewDialogNewDue")}:</strong> {renewPreviewDate}
              </Typography>
              <Typography variant="caption" color="textSecondary" component="p">
                {renewBaseUsesCurrentDue
                  ? i18n.t("platform.companies.renewBaseFromCurrentDue")
                  : i18n.t("platform.companies.renewBaseFromToday")}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="error" component="p">
              {i18n.t("platform.companies.renewInvalidRecurrence")}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenewDialogRow(null)} color="primary">
            {i18n.t("confirmationModal.buttons.cancel")}
          </Button>
          <Button
            onClick={handleConfirmRenew}
            color="primary"
            variant="contained"
            disabled={!renewPreviewDate}
          >
            {i18n.t("platform.companies.renewConfirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(internalNotesRow)}
        onClose={() => !internalNotesSaving && setInternalNotesRow(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{i18n.t("platform.companies.internalNotesDialogTitle")}</DialogTitle>
        <DialogContent dividers>
          {internalNotesRow ? (
            <Box display="flex" flexDirection="column" style={{ gap: 12 }}>
              <Typography variant="body2" color="textSecondary" component="p">
                {i18n.t("platform.companies.internalNotesHint")}
              </Typography>
              <Typography variant="subtitle2" component="p" style={{ fontWeight: 600 }}>
                {internalNotesRow.name || "—"}
              </Typography>
              <TextField
                multiline
                minRows={6}
                fullWidth
                variant="outlined"
                size="small"
                value={internalNotesDraft}
                onChange={(e) => setInternalNotesDraft(e.target.value)}
                placeholder={i18n.t("platform.companies.internalNotesPlaceholder")}
                disabled={internalNotesSaving}
                inputProps={{ "aria-label": i18n.t("platform.companies.internalNotesPlaceholder") }}
              />
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setInternalNotesRow(null)}
            color="primary"
            disabled={internalNotesSaving}
          >
            {i18n.t("confirmationModal.buttons.cancel")}
          </Button>
          <Button
            onClick={handleSaveInternalNotes}
            color="primary"
            variant="contained"
            disabled={internalNotesSaving}
          >
            {i18n.t("platform.companies.internalNotesSave")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(historyRow)}
        onClose={() => setHistoryRow(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{i18n.t("platform.companies.companyHistoryTitle")}</DialogTitle>
        <DialogContent dividers>
          {historyRow ? (
            <Typography variant="subtitle2" component="p" style={{ fontWeight: 600, marginBottom: 12 }}>
              {historyRow.name || "—"}
            </Typography>
          ) : null}
          {historyLoading ? (
            <Box display="flex" justifyContent="center" py={2}>
              <CircularProgress size={28} />
            </Box>
          ) : !historyItems.length ? (
            <Typography variant="body2" color="textSecondary" component="p">
              {i18n.t("platform.companies.companyHistoryEmpty")}
            </Typography>
          ) : (
            <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
              {historyItems.map((log) => {
                const entry = formatCompanyLogEntry(log, dateToClient, datetimeToClient);
                return (
                  <Box key={log.id} data-log-id={log.id}>
                    <Typography variant="caption" color="textSecondary" component="p">
                      {entry.whenLabel}
                    </Typography>
                    <Typography variant="body2" style={{ fontWeight: 600 }} component="p">
                      {entry.title}
                    </Typography>
                    {entry.subtitle ? (
                      <Typography variant="body2" color="textSecondary" component="p">
                        {entry.subtitle}
                      </Typography>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryRow(null)} color="primary">
            {i18n.t("confirmationModal.buttons.cancel")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(gridDeleteRow)} onClose={() => setGridDeleteRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("platform.companies.deleteGridTitle")}</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" component="p" paragraph>
            {i18n.t("platform.companies.deleteGridMessage", { name: gridDeleteRow?.name || "—" })}
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label={i18n.t("platform.companies.deleteGridNameLabel")}
            placeholder={gridDeleteRow?.name || ""}
            value={gridDeleteNameInput}
            onChange={(e) => setGridDeleteNameInput(e.target.value)}
            autoComplete="off"
          />
          <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 8 }}>
            {i18n.t("platform.companies.deleteGridHint")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGridDeleteRow(null)} color="primary">
            {i18n.t("confirmationModal.buttons.cancel")}
          </Button>
          <Button
            onClick={handleConfirmGridDelete}
            color="secondary"
            variant="contained"
            disabled={
              !gridDeleteRow ||
              gridDeleteNameInput.trim() !== (gridDeleteRow.name || "").trim()
            }
          >
            {i18n.t("platform.companies.deleteGridConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
