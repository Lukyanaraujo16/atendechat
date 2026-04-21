import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import Divider from "@material-ui/core/Divider";
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
  AppEmptyState,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";

const NEAR_EXPIRY_DAYS = 30;

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
  sectionSubheading: {
    marginBottom: theme.spacing(2),
    maxWidth: 640,
  },
  kpiCard: {
    height: "100%",
    padding: theme.spacing(2.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    transition: theme.transitions.create(["box-shadow", "border-color"], {
      duration: 200,
    }),
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
    fontSize: "2rem",
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    color: theme.palette.text.primary,
    marginTop: theme.spacing(0.5),
  },
  kpiLabel: {
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: theme.palette.text.secondary,
    lineHeight: 1.4,
  },
  kpiHint: {
    marginTop: theme.spacing(1),
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    opacity: 0.9,
  },
  listRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    padding: theme.spacing(1.25, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:last-child": {
      borderBottom: "none",
    },
  },
  listScroll: {
    maxHeight: 320,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
}));

function buildStats(companies) {
  const list = Array.isArray(companies) ? companies : [];
  const now = moment().startOf("day");
  let total = list.length;
  let active = 0;
  let inactive = 0;
  let nearExpiry = 0;
  let noAdmin = 0;
  list.forEach((c) => {
    if (c.status === false) inactive += 1;
    else active += 1;
    if (!c.primaryAdmin) noAdmin += 1;
    if (c.dueDate && moment(c.dueDate).isValid()) {
      const due = moment(c.dueDate).startOf("day");
      const days = due.diff(now, "days");
      if (days >= 0 && days <= NEAR_EXPIRY_DAYS) nearExpiry += 1;
    }
  });

  const pctActive = total === 0 ? 0 : Math.round((active / total) * 100);

  return {
    total,
    active,
    inactive,
    nearExpiry,
    noAdmin,
    pctActive,
  };
}

function recentCompanies(companies, limit = 6) {
  const list = Array.isArray(companies) ? [...companies] : [];
  return list
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )
    .slice(0, limit);
}

function problemCompanies(companies) {
  const list = Array.isArray(companies) ? companies : [];
  const now = moment().startOf("day");
  const out = [];

  list.forEach((c) => {
    const reasons = [];
    if (!c.primaryAdmin) reasons.push("noAdmin");
    if (c.status === false) reasons.push("inactive");
    if (c.dueDate && moment(c.dueDate).isValid()) {
      if (moment(c.dueDate).startOf("day").isBefore(now)) reasons.push("expired");
    }
    if (reasons.length) {
      out.push({ company: c, reasons });
    }
  });

  return out.sort((a, b) => (a.company.name || "").localeCompare(b.company.name || ""));
}

function KpiStat({ label, value, hint, loading }) {
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

export default function PlatformDashboard() {
  const classes = useStyles();
  const { list } = useCompanies();
  const { datetimeToClient } = useDate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await list();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (e) {
      setCompanies([]);
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => buildStats(companies), [companies]);
  const recent = useMemo(() => recentCompanies(companies), [companies]);
  const problems = useMemo(() => problemCompanies(companies), [companies]);

  const titleBlock = (
    <>
      <Typography
        variant="overline"
        color="textSecondary"
        display="block"
        style={{ letterSpacing: "0.06em", marginBottom: 4 }}
      >
        {i18n.t("platform.shell.eyebrow")}
      </Typography>
      <Typography variant="h5" component="h1" color="primary" style={{ fontWeight: 600 }}>
        {i18n.t("platform.dashboard.title")}
      </Typography>
    </>
  );

  const subtitleBlock = (
    <Typography variant="body2" color="textSecondary" component="p" style={{ margin: 0 }}>
      {i18n.t("platform.dashboard.subtitle")}
    </Typography>
  );

  const actions = (
    <>
      <AppSecondaryButton component={Link} to="/saas/companies">
        {i18n.t("platform.dashboard.actionNewCompany")}
      </AppSecondaryButton>
      <AppSecondaryButton component={Link} to="/saas/plans">
        {i18n.t("platform.dashboard.actionPlans")}
      </AppSecondaryButton>
      <AppPrimaryButton component={Link} to="/saas/branding">
        {i18n.t("platform.dashboard.actionBranding")}
      </AppPrimaryButton>
    </>
  );

  const reasonLabel = (r) => {
    if (r === "noAdmin") return i18n.t("platform.dashboard.reasonNoAdmin");
    if (r === "inactive") return i18n.t("platform.dashboard.reasonInactive");
    if (r === "expired") return i18n.t("platform.dashboard.reasonExpired");
    return r;
  };

  return (
    <MainContainer>
      <Box className={classes.page}>
        <AppPageHeader title={titleBlock} subtitle={subtitleBlock} actions={actions} />

        <AppSectionCard>
          <Typography className={classes.sectionHeading} component="h2">
            {i18n.t("platform.dashboard.kpiSectionTitle")}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <KpiStat
                label={i18n.t("platform.dashboard.kpiTotal")}
                value={stats.total}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiStat
                label={i18n.t("platform.dashboard.kpiActive")}
                value={stats.active}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiStat
                label={i18n.t("platform.dashboard.kpiInactive")}
                value={stats.inactive}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiStat
                label={i18n.t("platform.dashboard.kpiNearDue")}
                value={stats.nearExpiry}
                hint={i18n.t("platform.dashboard.kpiNearDueHint")}
                loading={loading}
              />
            </Grid>
          </Grid>
        </AppSectionCard>

        <AppSectionCard>
          <Typography className={classes.sectionHeading} component="h2">
            {i18n.t("platform.dashboard.healthSectionTitle")}
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.sectionSubheading}>
            {i18n.t("platform.dashboard.healthSectionSubtitle")}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <KpiStat
                label={i18n.t("platform.dashboard.healthPctActive")}
                value={`${stats.pctActive}%`}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <KpiStat
                label={i18n.t("platform.dashboard.healthNoAdmin")}
                value={stats.noAdmin}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <KpiStat
                label={i18n.t("platform.dashboard.healthBlocked")}
                value={stats.inactive}
                hint={i18n.t("platform.dashboard.healthBlockedHint")}
                loading={loading}
              />
            </Grid>
          </Grid>
        </AppSectionCard>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <AppSectionCard>
              <Typography className={classes.sectionHeading} style={{ marginBottom: 8 }} component="h2">
                {i18n.t("platform.dashboard.recentTitle")}
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph style={{ marginBottom: 16 }}>
                {i18n.t("platform.dashboard.recentSubtitle")}
              </Typography>
              {!loading && recent.length === 0 ? (
                <AppEmptyState title={i18n.t("platform.dashboard.recentEmpty")} />
              ) : (
                <Box className={classes.listScroll}>
                  {(loading ? Array.from({ length: 4 }) : recent).map((item, idx) =>
                    loading ? (
                      <Box key={idx} className={classes.listRow}>
                        <Typography variant="body2" color="textSecondary">
                          …
                        </Typography>
                      </Box>
                    ) : (
                      <Box key={item.id} className={classes.listRow}>
                        <Box minWidth={0}>
                          <Typography variant="body1" style={{ fontWeight: 600 }} noWrap>
                            {item.name || "—"}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {item.createdAt ? datetimeToClient(item.createdAt) : "—"}
                          </Typography>
                        </Box>
                      </Box>
                    )
                  )}
                </Box>
              )}
            </AppSectionCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <AppSectionCard>
              <Typography className={classes.sectionHeading} style={{ marginBottom: 8 }} component="h2">
                {i18n.t("platform.dashboard.problemsTitle")}
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph style={{ marginBottom: 16 }}>
                {i18n.t("platform.dashboard.problemsSubtitle")}
              </Typography>
              {!loading && problems.length === 0 ? (
                <AppEmptyState title={i18n.t("platform.dashboard.problemsEmpty")} />
              ) : (
                <Box className={classes.listScroll}>
                  {(loading ? Array.from({ length: 4 }) : problems).map((item, idx) =>
                    loading ? (
                      <Box key={idx} className={classes.listRow}>
                        <Typography variant="body2" color="textSecondary">
                          …
                        </Typography>
                      </Box>
                    ) : (
                      <Box key={item.company.id} className={classes.listRow}>
                        <Box minWidth={0} flex={1}>
                          <Typography variant="body1" style={{ fontWeight: 600 }} noWrap>
                            {item.company.name || "—"}
                          </Typography>
                          <Box display="flex" flexWrap="wrap" style={{ gap: 6, marginTop: 6 }}>
                            {item.reasons.map((r) => (
                              <Chip
                                key={r}
                                size="small"
                                label={reasonLabel(r)}
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </Box>
                      </Box>
                    )
                  )}
                </Box>
              )}
            </AppSectionCard>
          </Grid>
        </Grid>

        <Divider />

        <Box display="flex" flexWrap="wrap" alignItems="center" style={{ gap: 12 }}>
          <Typography variant="caption" color="textSecondary">
            {i18n.t("platform.dashboard.footerHint")}
          </Typography>
          <AppSecondaryButton component={Link} size="small" to="/saas/companies">
            {i18n.t("platform.dashboard.openCompanies")}
          </AppSecondaryButton>
        </Box>
      </Box>
    </MainContainer>
  );
}
