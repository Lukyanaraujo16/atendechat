import React, { useState, useEffect, useMemo, useContext, useCallback } from "react";
import { useHistory, Link as RouterLink } from "react-router-dom";
import {
  makeStyles,
  Box,
  Grid,
  FormControl,
  InputLabel,
  MenuItem,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  Select,
  Typography,
  Chip,
  InputAdornment,
  Tooltip,
  IconButton,
  Link,
  useMediaQuery,
} from "@material-ui/core";
import { useTheme, alpha } from "@material-ui/core/styles";
import SearchIcon from "@material-ui/icons/Search";
import EditOutlined from "@material-ui/icons/EditOutlined";
import HeadsetMic from "@material-ui/icons/HeadsetMic";
import ChatBubbleOutline from "@material-ui/icons/ChatBubbleOutline";
import LockOutlined from "@material-ui/icons/LockOutlined";
import LockOpen from "@material-ui/icons/LockOpen";
import Autorenew from "@material-ui/icons/Autorenew";
import DeleteForever from "@material-ui/icons/DeleteForever";
import NoteOutlined from "@material-ui/icons/NoteOutlined";
import History from "@material-ui/icons/History";
import Warning from "@material-ui/icons/Warning";
import AccountBalanceWalletOutlined from "@material-ui/icons/AccountBalanceWalletOutlined";
import FindInPageOutlined from "@material-ui/icons/FindInPageOutlined";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import useCompanies from "../../hooks/useCompanies";
import usePlans from "../../hooks/usePlans";
import { useDate } from "../../hooks/useDate";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { getCompanyEffectivePlanValue } from "../../utils/companyPlanValue";
import {
  AppSectionCard,
  AppLoadingState,
  AppPrimaryButton,
  AppNeutralButton,
} from "../../ui";
import AppTableContainer from "../../ui/components/AppTableContainer";
import FeatureGroupsEditor from "../ModuleSettings/FeatureGroupsEditor";
import { defaultModulePermissions } from "../ModuleSettings/moduleSync";
import { maskPhone, isValidEmail, isValidPhone } from "../../helpers/brMasks";
import CompanyPlanFields from "./CompanyPlanFields";
import {
  PrimaryAdminSetupDialog,
  useCompanyQuickActions,
} from "./CompanyActionDialogs";
import {
  previewRenewedDueDate,
  companyStorageBarColor,
  companyStorageStatusLabel,
  getDueCategory,
  getDueDisplayMeta,
  planNameForSort,
  comparePriorityDue,
  formatPlanValueDiscrete,
  getFinanceStateLabel,
  compareByDueDateAsc,
  compareByStatusBlockedFirst,
  campaignsLabelForRow,
  buildCompanyPayload,
} from "./companyHelpers";
import {
  OPERATIONAL_FILTERS,
  financialStatusLabel,
  financialStatusTone,
  blockKindLabel,
  indexBillingStatus,
  normalizeHistoricalSummary,
  historicalReviewPath,
} from "./billingStatusHelpers";

export * from "./companyHelpers";

/** Rota da página individual de uma empresa (Fase 8.4). */
export function companyDetailPath(companyId, tab) {
  const base = `/saas/companies/${companyId}`;
  return tab ? `${base}/${tab}` : base;
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
  userActionsCell: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing(0.25),
    maxWidth: 220,
    marginLeft: "auto",
  },
  opFilterLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginRight: theme.spacing(0.5),
  },
  opChip: {
    height: "auto",
    minHeight: 22,
    marginTop: 4,
    fontWeight: 600,
    maxWidth: "100%",
  },
  opChipLabel: {
    whiteSpace: "normal",
    lineHeight: 1.25,
    paddingTop: 2,
    paddingBottom: 2,
  },
  opTone_success: {
    backgroundColor: alpha(theme.palette.success.main, 0.14),
    color: theme.palette.type === "dark" ? theme.palette.success.light : theme.palette.success.dark,
  },
  opTone_warning: {
    backgroundColor: alpha(theme.palette.warning.main, 0.18),
    color: theme.palette.type === "dark" ? theme.palette.warning.light : theme.palette.warning.dark,
  },
  opTone_error: {
    backgroundColor: alpha(theme.palette.error.main, 0.12),
    color: theme.palette.type === "dark" ? theme.palette.error.light : theme.palette.error.dark,
  },
  opTone_info: {
    backgroundColor: alpha(theme.palette.info.main, 0.14),
    color: theme.palette.type === "dark" ? theme.palette.info.light : theme.palette.info.dark,
  },
  opTone_default: {},
  blockKindCaption: {
    display: "block",
    marginTop: 4,
    fontSize: "0.7rem",
    lineHeight: 1.3,
    fontWeight: 600,
    color: theme.palette.type === "dark" ? theme.palette.error.light : theme.palette.error.dark,
  },
  registeredSectionSubtitle: {
    marginBottom: theme.spacing(2),
    lineHeight: 1.55,
    maxWidth: 560,
  },
}));

const EMPTY_CREATE_VALUES = () => ({
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
  modulePermissions: defaultModulePermissions(),
  businessSegment: "general",
  crmVisibilityMode: "all",
});

function validateCreateValues(values) {
  const errors = {};
  if (!String(values.name || "").trim()) errors.name = "Informe o nome da empresa.";
  if (!String(values.email || "").trim()) errors.email = "Informe o e-mail principal.";
  else if (!isValidEmail(values.email)) errors.email = "E-mail inválido.";
  if (String(values.phone || "").trim() && !isValidPhone(values.phone)) {
    errors.phone = "Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.";
  }
  return errors;
}

/**
 * Formulário de criação de empresa (diálogo na listagem).
 * A edição completa acontece na página individual /saas/companies/:id/:tab.
 */
export function CompanyCreateForm({ formId, onSubmit, loading }) {
  const { user } = useContext(AuthContext);
  const { list: listPlans } = usePlans();
  const [plans, setPlans] = useState([]);
  const initialValues = useMemo(() => EMPTY_CREATE_VALUES(), []);

  useEffect(() => {
    let alive = true;
    listPlans()
      .then((list) => {
        if (alive) setPlans(Array.isArray(list) ? list : []);
      })
      .catch(toastError);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Formik
      initialValues={initialValues}
      validate={validateCreateValues}
      onSubmit={(values) => {
        const built = buildCompanyPayload(values, { isSuper: Boolean(user?.super) });
        if (!built.ok) {
          toast.error(built.message);
          return;
        }
        onSubmit(built.payload);
      }}
    >
      {(formik) => (
        <Form id={formId}>
          <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
            <AppSectionCard>
              <Typography style={{ fontWeight: 600, marginBottom: 4 }} component="h2">
                {i18n.t("settings.company.form.sectionCompanyData")}
              </Typography>
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
                Dados básicos para criar a empresa. Razão social, documento e endereço podem ser
                preenchidos depois, na aba “Cadastro” da página da empresa.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <Field
                    as={TextField}
                    label={i18n.t("settings.company.form.name")}
                    name="name"
                    variant="outlined"
                    fullWidth
                    margin="dense"
                    required
                    error={Boolean(formik.touched.name && formik.errors.name)}
                    helperText={formik.touched.name && formik.errors.name}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Field
                    as={TextField}
                    label={i18n.t("settings.company.form.emailMain")}
                    name="email"
                    type="email"
                    variant="outlined"
                    fullWidth
                    margin="dense"
                    required
                    error={Boolean(formik.touched.email && formik.errors.email)}
                    helperText={formik.touched.email && formik.errors.email}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label={i18n.t("settings.company.form.phone")}
                    name="phone"
                    variant="outlined"
                    fullWidth
                    margin="dense"
                    inputProps={{ inputMode: "tel" }}
                    value={formik.values.phone}
                    onChange={(e) => formik.setFieldValue("phone", maskPhone(e.target.value))}
                    onBlur={formik.handleBlur}
                    error={Boolean(formik.touched.phone && formik.errors.phone)}
                    helperText={formik.touched.phone && formik.errors.phone}
                  />
                </Grid>
              </Grid>
            </AppSectionCard>
            <CompanyPlanFields plans={plans} loading={loading} />
            <AppSectionCard>
              <FeatureGroupsEditor
                mode="company"
                title={i18n.t("settings.company.form.modulesFeaturesSectionTitle")}
                hint={i18n.t("settings.company.form.modulesFeaturesSectionHint")}
                plan={plans.find((p) => String(p.id) === String(formik.values.planId))}
                modulePermissions={formik.values.modulePermissions}
                onModulePermissionsChange={(next) => formik.setFieldValue("modulePermissions", next)}
              />
            </AppSectionCard>
          </Box>
        </Form>
      )}
    </Formik>
  );
}

/** Compatibilidade: nome antigo do formulário exportado. */
export const CompanyForm = CompanyCreateForm;

const EMPTY_OBJ = Object.freeze({});

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
    onOpenBilling,
    getCompanyHref,
    billingStatusById,
    historicalByCompany,
    billingStatusState = "idle",
    historicalTotal,
    onOpenFinance,
    onOpenHistoricalReview,
  } = props;
  const classes = useStyles();
  const theme = useTheme();
  const { dateToClient, datetimeToClient } = useDate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("priority");
  const [dueFilter, setDueFilter] = useState("all");
  const [opFilter, setOpFilter] = useState("all");

  const statusById = billingStatusById || EMPTY_OBJ;
  const historicalById = historicalByCompany || EMPTY_OBJ;
  const statusOf = (row) => statusById[String(row.id)] || null;
  const historicalOf = (row) => Number(historicalById[String(row.id)]) || 0;
  const opFiltersAvailable = billingStatusState === "ok";

  const gridOpsEnabled =
    typeof onToggleCompanyStatus === "function" &&
    typeof onOpenRenewDialog === "function" &&
    typeof onOpenDeleteDialog === "function";

  const openBillingDialog = (e, row) => {
    e.stopPropagation();
    if (typeof onOpenBilling === "function") onOpenBilling(row);
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
    if (opFilter !== "all") {
      const def = OPERATIONAL_FILTERS.find((f) => f.key === opFilter);
      if (def) {
        list = list.filter((row) =>
          def.match(statusById[String(row.id)] || null, Number(historicalById[String(row.id)]) || 0)
        );
      }
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
  }, [records, search, sortBy, dueFilter, opFilter, statusById, historicalById]);

  const opFilterCounts = useMemo(() => {
    const base = Array.isArray(records) ? records : [];
    const counts = {};
    OPERATIONAL_FILTERS.forEach((f) => {
      counts[f.key] = base.filter((row) =>
        f.match(statusById[String(row.id)] || null, Number(historicalById[String(row.id)]) || 0)
      ).length;
    });
    return counts;
  }, [records, statusById, historicalById]);

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
        Clique no nome da empresa (ou no ícone de edição) para abrir a página da empresa.
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
      {opFiltersAvailable || historicalByCompany ? (
        <Box className={classes.filterChipsRow} data-testid="operational-filters">
          <Typography component="span" className={classes.opFilterLabel}>
            Situação financeira:
          </Typography>
          <Chip
            size="small"
            label="Todas"
            clickable
            color={opFilter === "all" ? "primary" : "default"}
            variant={opFilter === "all" ? "default" : "outlined"}
            onClick={() => setOpFilter("all")}
          />
          {OPERATIONAL_FILTERS.filter((f) => (f.key === "historical" ? Boolean(historicalByCompany) : opFiltersAvailable)).map((f) => {
            const extra =
              f.key === "historical" && Number(historicalTotal) > 0
                ? ` · ${historicalTotal} fatura${Number(historicalTotal) === 1 ? "" : "s"}`
                : "";
            return (
              <Tooltip key={f.key} title={f.hint} arrow enterDelay={400}>
                <Chip
                  size="small"
                  label={`${f.label} (${opFilterCounts[f.key] || 0})${extra}`}
                  clickable
                  color={opFilter === f.key ? "primary" : "default"}
                  variant={opFilter === f.key ? "default" : "outlined"}
                  onClick={() => setOpFilter(f.key)}
                />
              </Tooltip>
            );
          })}
        </Box>
      ) : null}
      {billingStatusState === "unavailable" ? (
        <Typography variant="caption" color="textSecondary" display="block" style={{ marginBottom: 12 }}>
          A situação financeira detalhada (carência, tipo de bloqueio) ainda não está disponível no servidor.
          A listagem continua funcionando normalmente.
        </Typography>
      ) : null}
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
                style={{ width: 280, minWidth: 280 }}
              >
                {i18n.t("platform.companies.actionsColumn")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: "28%" }}>
                {i18n.t("platform.companies.columnCompany")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: "16%" }}>
                {i18n.t("settings.company.form.plan")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: 132 }}>
                {i18n.t("settings.company.form.status")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: 168 }}>
                {i18n.t("settings.company.form.expire")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: 160 }}>
                {i18n.t("platform.companies.columnStorage")}
              </TableCell>
              <TableCell align="left" className={classes.tableHeadCell} style={{ width: 168 }}>
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
              const opStatus = statusOf(row);
              const historicalCount = historicalOf(row);
              const blockLabel = row.status === false && opStatus ? blockKindLabel(opStatus.blockKind) : "";
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
                      {typeof onOpenFinance === "function" ? (
                        <Tooltip title="Financeiro da empresa" arrow enterDelay={300}>
                          <IconButton
                            size="small"
                            onClick={() => onOpenFinance(row)}
                            aria-label="Financeiro"
                          >
                            <AccountBalanceWalletOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      {typeof onOpenHistoricalReview === "function" && historicalCount > 0 ? (
                        <Tooltip
                          title={`Regularizar faturas históricas (${historicalCount})`}
                          arrow
                          enterDelay={300}
                        >
                          <IconButton
                            size="small"
                            onClick={() => onOpenHistoricalReview(row)}
                            aria-label="Regularizar históricas"
                            style={{ color: theme.palette.warning.dark }}
                          >
                            <FindInPageOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
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
                        {typeof getCompanyHref === "function" ? (
                          <Link
                            component={RouterLink}
                            to={getCompanyHref(row)}
                            className={classes.companyNameLine}
                            style={{ display: "block" }}
                            color="inherit"
                            underline="hover"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.name || "—"}
                          </Link>
                        ) : (
                          <Typography className={classes.companyNameLine} component="div">
                            {row.name || "—"}
                          </Typography>
                        )}
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
                    {blockLabel ? (
                      <Typography component="span" className={classes.blockKindCaption}>
                        {blockLabel}
                      </Typography>
                    ) : null}
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
                    {opStatus ? (
                      <Chip
                        size="small"
                        label={
                          opStatus.daysLate > 0 &&
                          (opStatus.financialStatus === "carencia" || opStatus.financialStatus === "vencido")
                            ? `${financialStatusLabel(opStatus.financialStatus)} · ${opStatus.daysLate} dia${opStatus.daysLate === 1 ? "" : "s"}`
                            : financialStatusLabel(opStatus.financialStatus)
                        }
                        className={`${classes.opChip} ${classes[`opTone_${financialStatusTone(opStatus.financialStatus)}`]}`}
                        classes={{ label: classes.opChipLabel }}
                      />
                    ) : null}
                    {historicalCount > 0 ? (
                      <Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${historicalCount} histórica${historicalCount === 1 ? "" : "s"} a revisar`}
                          className={`${classes.opChip} ${classes.opTone_info}`}
                          classes={{ label: classes.opChipLabel }}
                        />
                      </Box>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </AppTableContainer>

    </AppSectionCard>
  );
}

export default function CompaniesManager() {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down("xs"));
  const history = useHistory();
  const { list, save, fetchBillingStatus, fetchHistoricalReviewSummary } = useCompanies();
  const { user, enterSupportMode } = useContext(AuthContext);

  const [records, setRecords] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [primaryAdminSetup, setPrimaryAdminSetup] = useState(null);
  const [pendingNavigateId, setPendingNavigateId] = useState(null);

  const [billingStatusById, setBillingStatusById] = useState(null);
  const [billingStatusState, setBillingStatusState] = useState("idle");
  const [historicalSummary, setHistoricalSummary] = useState(null);

  /**
   * Situação financeira em lote (C2) + resumo de históricas (C5): duas chamadas para a
   * listagem inteira (sem N+1). Falha/404 não quebra a listagem — só esconde os filtros novos.
   */
  const isSuperUser = Boolean(user?.super);
  const loadOperationalStatus = useCallback(async () => {
    if (!isSuperUser) return;
    setBillingStatusState("loading");
    const [statusRes, summaryRes] = await Promise.allSettled([
      typeof fetchBillingStatus === "function" ? fetchBillingStatus() : Promise.reject(new Error("n/a")),
      typeof fetchHistoricalReviewSummary === "function"
        ? fetchHistoricalReviewSummary()
        : Promise.reject(new Error("n/a")),
    ]);
    if (statusRes.status === "fulfilled") {
      setBillingStatusById(indexBillingStatus(statusRes.value));
      setBillingStatusState("ok");
    } else {
      setBillingStatusById(null);
      setBillingStatusState("unavailable");
    }
    setHistoricalSummary(
      summaryRes.status === "fulfilled" ? normalizeHistoricalSummary(summaryRes.value) : null
    );
  }, [isSuperUser, fetchBillingStatus, fetchHistoricalReviewSummary]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const companyList = await list();
      setRecords(Array.isArray(companyList) ? companyList : []);
    } catch (e) {
      toast.error(i18n.t("settings.company.toasts.errorList"));
    } finally {
      setListLoading(false);
    }
  }, [list]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadOperationalStatus();
  }, [loadOperationalStatus]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadList(), loadOperationalStatus()]);
  }, [loadList, loadOperationalStatus]);

  const { actions, dialogs } = useCompanyQuickActions({ onChanged: reloadAll });

  const openCompany = (row) => {
    if (row?.id) history.push(companyDetailPath(row.id));
  };

  const handleCreate = async (payload) => {
    setCreating(true);
    try {
      const created = await save(payload);
      toast.success(i18n.t("settings.company.toasts.success"));
      setCreateOpen(false);
      const setup = created?.primaryAdminSetup;
      if (setup && (setup.temporaryPassword || setup.inviteEmailSent !== true)) {
        // Mostra credenciais antes de sair da listagem.
        setPrimaryAdminSetup(setup);
        setPendingNavigateId(created?.id || null);
        await loadList();
      } else if (created?.id) {
        history.push(companyDetailPath(created.id, "cadastro"));
      } else {
        await loadList();
      }
    } catch (e) {
      toastError(e);
    } finally {
      setCreating(false);
    }
  };

  const gridOpsEnabled = Boolean(user?.super);

  return (
    <Box className={classes.pageStack}>
      {listLoading && records.length === 0 ? (
        <AppLoadingState message="Carregando empresas…" />
      ) : (
        <CompaniesManagerGrid
          records={records}
          onSelect={openCompany}
          selectedId={null}
          getCompanyHref={(row) => companyDetailPath(row.id)}
          onNewCompany={() => setCreateOpen(true)}
          onAccessCompany={
            user?.super && !user?.supportMode ? (row) => enterSupportMode(row.id) : undefined
          }
          currentUserCompanyId={user?.companyId}
          onToggleCompanyStatus={gridOpsEnabled ? actions.openBlock : undefined}
          onOpenRenewDialog={gridOpsEnabled ? actions.openRenew : undefined}
          onOpenDeleteDialog={gridOpsEnabled ? actions.openDelete : undefined}
          onOpenInternalNotes={gridOpsEnabled ? actions.openNotes : undefined}
          onOpenCompanyHistory={gridOpsEnabled ? actions.openHistory : undefined}
          onOpenBilling={actions.openBilling}
          billingStatusById={billingStatusById}
          billingStatusState={billingStatusState}
          historicalByCompany={historicalSummary ? historicalSummary.byCompany : null}
          historicalTotal={historicalSummary ? historicalSummary.total : 0}
          onOpenFinance={(row) => history.push(companyDetailPath(row.id, "financeiro"))}
          onOpenHistoricalReview={(row) => history.push(historicalReviewPath(row.id))}
        />
      )}

      <Dialog
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        maxWidth="md"
        fullWidth
        fullScreen={fullScreenDialog}
        scroll="paper"
        aria-labelledby="company-create-title"
      >
        <DialogTitle id="company-create-title">{i18n.t("platform.companies.newCompany")}</DialogTitle>
        <DialogContent dividers>
          {createOpen ? (
            <CompanyCreateForm formId="company-create-form" onSubmit={handleCreate} loading={creating} />
          ) : null}
        </DialogContent>
        <DialogActions>
          <AppNeutralButton type="button" onClick={() => setCreateOpen(false)} disabled={creating}>
            {i18n.t("confirmationModal.buttons.cancel")}
          </AppNeutralButton>
          <AppPrimaryButton type="submit" form="company-create-form" loading={creating}>
            Criar empresa
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>

      <PrimaryAdminSetupDialog
        setup={primaryAdminSetup}
        onClose={() => {
          setPrimaryAdminSetup(null);
          if (pendingNavigateId) {
            const id = pendingNavigateId;
            setPendingNavigateId(null);
            history.push(companyDetailPath(id, "cadastro"));
          }
        }}
      />

      {dialogs}
    </Box>
  );
}
