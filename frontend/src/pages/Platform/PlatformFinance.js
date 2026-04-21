import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Chip from "@material-ui/core/Chip";
import InputAdornment from "@material-ui/core/InputAdornment";
import SearchIcon from "@material-ui/icons/Search";
import { alpha } from "@material-ui/core/styles";
import { makeStyles } from "@material-ui/core/styles";
import moment from "moment";

import MainContainer from "../../components/MainContainer";
import useCompanies from "../../hooks/useCompanies";
import toastError from "../../errors/toastError";
import { useDate } from "../../hooks/useDate";
import { i18n } from "../../translate/i18n";
import {
  AppPageHeader,
  AppSectionCard,
  AppActionBar,
  AppSecondaryButton,
  AppEmptyState,
  AppLoadingState,
} from "../../ui";
import AppTableContainer from "../../ui/components/AppTableContainer";

const NEAR_DAYS = 30;

/** @returns {'inactive'|'overdue'|'soon'|'ok'|'noDue'} */
function classifyFinanceStatus(company) {
  if (company.status === false) return "inactive";
  const due = company.dueDate && moment(company.dueDate).isValid() ? moment(company.dueDate).startOf("day") : null;
  if (!due) return "noDue";
  const now = moment().startOf("day");
  if (due.isBefore(now)) return "overdue";
  const days = due.diff(now, "days");
  if (days >= 0 && days <= NEAR_DAYS) return "soon";
  return "ok";
}

function formatBrl(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(i18n.language === "en" ? "en-US" : i18n.language === "es" ? "es-ES" : "pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

const useStyles = makeStyles((theme) => ({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    width: "100%",
  },
  kpiCard: {
    height: "100%",
    minHeight: 112,
    padding: theme.spacing(2.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    transition: theme.transitions.create(["box-shadow", "border-color"], { duration: 200 }),
    "@media (hover: hover)": {
      "&:hover": {
        borderColor: alpha(theme.palette.primary.main, 0.35),
        boxShadow:
          theme.palette.type === "light"
            ? "0 4px 20px rgba(15, 23, 42, 0.07)"
            : "0 4px 16px rgba(0,0,0,0.35)",
      },
    },
  },
  kpiValue: {
    fontWeight: 700,
    fontSize: "1.75rem",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.primary,
  },
  kpiLabel: {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    lineHeight: 1.35,
  },
  kpiHint: {
    marginTop: theme.spacing(1),
    fontSize: "0.7rem",
    lineHeight: 1.35,
    color: theme.palette.text.secondary,
    opacity: 0.92,
  },
  tableHead: {
    fontWeight: 600,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },
  filterSelect: {
    minWidth: 200,
  },
  searchField: {
    minWidth: 240,
    flex: "1 1 260px",
  },
  chipBase: {
    fontWeight: 600,
    fontSize: "0.75rem",
    height: 26,
    borderRadius: 6,
  },
  chipFinanceOk: {
    backgroundColor: alpha(theme.palette.success.main, 0.14),
    color: theme.palette.success.dark,
    border: `1px solid ${alpha(theme.palette.success.main, 0.4)}`,
  },
  chipFinanceSoon: {
    backgroundColor: alpha(theme.palette.warning.main, 0.16),
    color: theme.palette.warning.dark,
    border: `1px solid ${alpha(theme.palette.warning.main, 0.45)}`,
  },
  chipFinanceOverdue: {
    backgroundColor: alpha(theme.palette.error.main, 0.12),
    color: theme.palette.error.dark,
    border: `1px solid ${alpha(theme.palette.error.main, 0.45)}`,
  },
  chipFinanceInactive: {
    backgroundColor: alpha(theme.palette.grey[500], 0.14),
    color: theme.palette.text.secondary,
    border: `1px solid ${alpha(theme.palette.grey[500], 0.35)}`,
  },
  chipFinanceNoDue: {
    backgroundColor: "transparent",
    color: theme.palette.text.secondary,
    border: `1px dashed ${alpha(theme.palette.divider, 1)}`,
  },
  chipCompanyActive: {
    backgroundColor: alpha(theme.palette.success.main, 0.1),
    color: theme.palette.success.dark,
    border: `1px solid ${alpha(theme.palette.success.main, 0.35)}`,
    fontWeight: 600,
    fontSize: "0.75rem",
    height: 26,
  },
  chipCompanyInactive: {
    backgroundColor: alpha(theme.palette.grey[500], 0.12),
    color: theme.palette.text.secondary,
    border: `1px solid ${alpha(theme.palette.grey[500], 0.3)}`,
    fontWeight: 600,
    fontSize: "0.75rem",
    height: 26,
  },
  tableRow: {
    "& > td": {
      borderLeft: "3px solid transparent",
    },
  },
  rowInactive: {
    backgroundColor: alpha(theme.palette.grey[500], 0.06),
    "& > td:first-child": {
      borderLeftColor: theme.palette.grey[500],
    },
  },
  rowOverdue: {
    backgroundColor: alpha(theme.palette.error.main, 0.045),
    "& > td:first-child": {
      borderLeftColor: theme.palette.error.main,
    },
  },
  rowNoDue: {
    backgroundColor: alpha(theme.palette.warning.main, 0.05),
    "& > td:first-child": {
      borderLeftColor: theme.palette.warning.main,
    },
  },
  actionBarInner: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: theme.spacing(2),
    width: "100%",
  },
  filtersGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    alignItems: "flex-end",
  },
}));

function KpiCard({ label, value, hint, loading }) {
  const classes = useStyles();
  return (
    <Box className={classes.kpiCard}>
      <Typography className={classes.kpiLabel} component="div">
        {label}
      </Typography>
      <Typography className={classes.kpiValue} component="div">
        {loading ? "…" : value}
      </Typography>
      {hint ? (
        <Typography className={classes.kpiHint} component="div">
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

function rowAttentionClass(classes, fin) {
  if (fin === "inactive") return classes.rowInactive;
  if (fin === "overdue") return classes.rowOverdue;
  if (fin === "noDue") return classes.rowNoDue;
  return null;
}

export default function PlatformFinance() {
  const classes = useStyles();
  const { list } = useCompanies();
  const { dateToClient } = useDate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [financeFilter, setFinanceFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await list();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toastError(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const list = rows;
    let emDia = 0;
    let inadimplente = 0;
    let vencendo = 0;
    let inativas = 0;
    let receita = 0;

    list.forEach((c) => {
      const fin = classifyFinanceStatus(c);
      if (fin === "inactive") {
        inativas += 1;
        return;
      }
      const planVal = Number(c.plan?.value);
      if (!Number.isNaN(planVal) && c.status !== false) {
        receita += planVal;
      }
      if (fin === "overdue") inadimplente += 1;
      else emDia += 1;
      if (fin === "soon") vencendo += 1;
    });

    return { total: list.length, emDia, inadimplente, vencendo, inativas, receita };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (q) {
        const nameOk = (c.name || "").toLowerCase().includes(q);
        const emailOk = (c.email || "").toLowerCase().includes(q);
        if (!nameOk && !emailOk) return false;
      }
      const fin = classifyFinanceStatus(c);
      if (companyFilter === "active" && c.status === false) return false;
      if (companyFilter === "inactive" && c.status !== false) return false;

      if (financeFilter === "all") return true;
      return fin === financeFilter;
    });
  }, [rows, search, financeFilter, companyFilter]);

  const financeChip = (c) => {
    const fin = classifyFinanceStatus(c);
    const map = {
      inactive: {
        label: i18n.t("platform.finance.status.inactive"),
        className: clsx(classes.chipBase, classes.chipFinanceInactive),
      },
      overdue: {
        label: i18n.t("platform.finance.status.overdue"),
        className: clsx(classes.chipBase, classes.chipFinanceOverdue),
      },
      soon: {
        label: i18n.t("platform.finance.status.soon"),
        className: clsx(classes.chipBase, classes.chipFinanceSoon),
      },
      ok: {
        label: i18n.t("platform.finance.status.ok"),
        className: clsx(classes.chipBase, classes.chipFinanceOk),
      },
      noDue: {
        label: i18n.t("platform.finance.status.noDue"),
        className: clsx(classes.chipBase, classes.chipFinanceNoDue),
      },
    };
    const cfg = map[fin] || map.noDue;
    return <Chip size="small" label={cfg.label} className={cfg.className} />;
  };

  const companyChip = (c) => {
    const active = c.status !== false;
    return (
      <Chip
        size="small"
        label={active ? i18n.t("platform.finance.companyStatus.active") : i18n.t("platform.finance.companyStatus.inactive")}
        className={active ? classes.chipCompanyActive : classes.chipCompanyInactive}
      />
    );
  };

  const header = (
    <>
      <Typography variant="overline" color="textSecondary" display="block" style={{ letterSpacing: "0.06em", marginBottom: 4 }}>
        {i18n.t("platform.shell.eyebrow")}
      </Typography>
      <Typography variant="h5" component="h1" color="primary" style={{ fontWeight: 600 }}>
        {i18n.t("platform.finance.title")}
      </Typography>
    </>
  );

  const subtitle = (
    <Typography variant="body2" color="textSecondary" component="p" style={{ margin: 0, maxWidth: 720 }}>
      {i18n.t("platform.finance.subtitle")}
    </Typography>
  );

  return (
    <MainContainer>
      <Box className={classes.page}>
        <AppPageHeader title={header} subtitle={subtitle} />

        <AppSectionCard>
          <Typography style={{ fontWeight: 600, fontSize: "1.0625rem", marginBottom: 16 }}>
            {i18n.t("platform.finance.kpiSection")}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <KpiCard label={i18n.t("platform.finance.kpiTotal")} value={stats.total} loading={loading} />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <KpiCard
                label={i18n.t("platform.finance.kpiEmDia")}
                value={stats.emDia}
                hint={i18n.t("platform.finance.kpiEmDiaHint")}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <KpiCard label={i18n.t("platform.finance.kpiInadimplente")} value={stats.inadimplente} loading={loading} />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <KpiCard
                label={i18n.t("platform.finance.kpiSoon")}
                value={stats.vencendo}
                hint={i18n.t("platform.finance.kpiSoonHint")}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <KpiCard label={i18n.t("platform.finance.kpiInactive")} value={stats.inativas} loading={loading} />
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <KpiCard
                label={i18n.t("platform.finance.kpiRevenue")}
                value={formatBrl(stats.receita)}
                hint={i18n.t("platform.finance.kpiRevenueHint")}
                loading={loading}
              />
            </Grid>
          </Grid>
        </AppSectionCard>

        <AppSectionCard>
          <Typography style={{ fontWeight: 600, fontSize: "1.0625rem", marginBottom: 12 }}>
            {i18n.t("platform.finance.tableSection")}
          </Typography>
          <AppActionBar style={{ marginBottom: 20, alignItems: "stretch" }}>
            <Box className={classes.actionBarInner}>
              <TextField
                size="small"
                variant="outlined"
                label={i18n.t("platform.finance.searchLabel")}
                placeholder={i18n.t("platform.finance.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={classes.searchField}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Box className={classes.filtersGroup}>
                <TextField
                  className={classes.filterSelect}
                  size="small"
                  select
                  label={i18n.t("platform.finance.filterFinanceLabel")}
                  value={financeFilter}
                  onChange={(e) => setFinanceFilter(e.target.value)}
                  variant="outlined"
                >
                  <MenuItem value="all">{i18n.t("platform.finance.filterFinanceAll")}</MenuItem>
                  <MenuItem value="ok">{i18n.t("platform.finance.filterFinanceOk")}</MenuItem>
                  <MenuItem value="soon">{i18n.t("platform.finance.filterFinanceSoon")}</MenuItem>
                  <MenuItem value="overdue">{i18n.t("platform.finance.filterFinanceOverdue")}</MenuItem>
                  <MenuItem value="noDue">{i18n.t("platform.finance.filterFinanceNoDue")}</MenuItem>
                  <MenuItem value="inactive">{i18n.t("platform.finance.filterFinanceInactive")}</MenuItem>
                </TextField>
                <TextField
                  className={classes.filterSelect}
                  size="small"
                  select
                  label={i18n.t("platform.finance.filterCompanyLabel")}
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  variant="outlined"
                >
                  <MenuItem value="all">{i18n.t("platform.finance.filterCompanyAll")}</MenuItem>
                  <MenuItem value="active">{i18n.t("platform.finance.filterCompanyActive")}</MenuItem>
                  <MenuItem value="inactive">{i18n.t("platform.finance.filterCompanyInactive")}</MenuItem>
                </TextField>
              </Box>
            </Box>
          </AppActionBar>

          {loading ? (
            <AppLoadingState message={i18n.t("platform.finance.loading")} />
          ) : filtered.length === 0 ? (
            <AppEmptyState title={i18n.t("platform.finance.emptyTitle")} description={i18n.t("platform.finance.emptySubtitle")} />
          ) : (
            <AppTableContainer nested>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell className={classes.tableHead}>{i18n.t("platform.finance.colCompany")}</TableCell>
                    <TableCell className={classes.tableHead}>{i18n.t("platform.finance.colPlan")}</TableCell>
                    <TableCell className={classes.tableHead} align="right">
                      {i18n.t("platform.finance.colPlanValue")}
                    </TableCell>
                    <TableCell className={classes.tableHead}>{i18n.t("platform.finance.colDue")}</TableCell>
                    <TableCell className={classes.tableHead}>{i18n.t("platform.finance.colRecurrence")}</TableCell>
                    <TableCell className={classes.tableHead}>{i18n.t("platform.finance.colFinance")}</TableCell>
                    <TableCell className={classes.tableHead}>{i18n.t("platform.finance.colCompanyStatus")}</TableCell>
                    <TableCell className={classes.tableHead} align="right">
                      {i18n.t("platform.finance.colActions")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((row) => {
                    const fin = classifyFinanceStatus(row);
                    return (
                      <TableRow key={row.id} className={clsx(classes.tableRow, rowAttentionClass(classes, fin))}>
                        <TableCell>
                          <Typography variant="body2" style={{ fontWeight: 600 }}>
                            {row.name || "—"}
                          </Typography>
                          {row.email ? (
                            <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 2 }}>
                              {row.email}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell>{row.plan?.name || "—"}</TableCell>
                        <TableCell align="right" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatBrl(row.plan?.value)}
                        </TableCell>
                        <TableCell>{row.dueDate ? dateToClient(row.dueDate) : "—"}</TableCell>
                        <TableCell>{row.recurrence || "—"}</TableCell>
                        <TableCell>{financeChip(row)}</TableCell>
                        <TableCell>{companyChip(row)}</TableCell>
                        <TableCell align="right">
                          <AppSecondaryButton size="small" component={Link} to={`/saas/companies?focus=${row.id}`}>
                            {i18n.t("platform.finance.actionEdit")}
                          </AppSecondaryButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </AppTableContainer>
          )}
        </AppSectionCard>
      </Box>
    </MainContainer>
  );
}
