import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import TextField from "@material-ui/core/TextField";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles, alpha } from "@material-ui/core/styles";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  format,
  formatDistanceToNow,
} from "date-fns";
import { enUS, es, ptBR } from "date-fns/locale";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { getCrmTerminology } from "../../utils/crmTerminology";
import CrmReportsCharts from "./CrmReportsCharts";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    maxWidth: 1280,
    margin: "0 auto",
    backgroundColor:
      theme.palette.type === "dark"
        ? alpha(theme.palette.background.default, 0.5)
        : theme.palette.background.default,
    minHeight: "100%",
  },
  card: {
    padding: theme.spacing(1.5, 2),
    borderRadius: 12,
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    height: "100%",
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
    alignItems: "center",
    marginBottom: theme.spacing(2),
  },
}));

function localeForI18n() {
  const l = (i18n.language || "pt").split("-")[0];
  if (l === "en") return enUS;
  if (l === "es") return es;
  return ptBR;
}

function formatMoney(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "BRL" });
}

function formatAvgMs(ms) {
  if (ms == null || Number.isNaN(ms) || ms < 0) return "—";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return i18n.t("crm.dashboard.durationDaysHours", { days, hours });
}

function rangeForPreset(key) {
  const now = new Date();
  switch (key) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "7d":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "30d":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    case "month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    default:
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
  }
}

export default function CRMReports() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const bizSegment = user?.company?.businessSegment;
  const terms = useMemo(() => getCrmTerminology(bizSegment), [bizSegment]);
  const loc = useMemo(() => localeForI18n(), [i18n.language]);

  const [periodPreset, setPeriodPreset] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [pipelines, setPipelines] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const { startDateStr, endDateStr } = useMemo(() => {
    if (periodPreset === "custom" && customStart && customEnd) {
      return {
        startDateStr: customStart,
        endDateStr: customEnd,
      };
    }
    const { start, end } = rangeForPreset(periodPreset);
    return {
      startDateStr: format(start, "yyyy-MM-dd"),
      endDateStr: format(end, "yyyy-MM-dd"),
    };
  }, [periodPreset, customStart, customEnd]);

  useEffect(() => {
    (async () => {
      try {
        const { data: pl } = await api.get("/crm/pipelines");
        setPipelines(Array.isArray(pl) ? pl : []);
      } catch (e) {
        toastError(e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/list");
        setUsers(Array.isArray(data) ? data : []);
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        startDate: startDateStr,
        endDate: endDateStr,
      };
      if (pipelineId) params.pipelineId = pipelineId;
      if (assignee) params.assignedUserId = assignee;
      if (source) params.source = source;
      if (status) params.status = status;
      const { data: json } = await api.get("/crm/reports", { params });
      setData(json);
    } catch (e) {
      toastError(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDateStr, endDateStr, pipelineId, assignee, source, status]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const summary = data?.summary;
  const stages = data?.stages ?? [];
  const bottlenecks = data?.bottlenecks ?? [];
  const attentionDeals = data?.attentionDeals ?? [];
  const timeline = data?.timeline ?? [];

  const conversionLabel =
    summary?.conversionRate != null ? `${summary.conversionRate}%` : "—";

  const noFunnelStages = stages.length === 0;

  const handlePeriodChange = (e) => {
    const v = e.target.value;
    setPeriodPreset(v);
    if (v === "custom") {
      const { start, end } = rangeForPreset("30d");
      setCustomStart(format(start, "yyyy-MM-dd"));
      setCustomEnd(format(end, "yyyy-MM-dd"));
    }
  };

  return (
    <Box className={classes.root}>
      <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 12 }} mb={2}>
        <Button
          component={Link}
          to="/crm"
          startIcon={<ArrowBackIcon />}
          size="small"
        >
          {i18n.t("crm.reports.backToBoard")}
        </Button>
        <Typography variant="h5" style={{ fontWeight: 600, flex: "1 1 auto" }}>
          {i18n.t("crm.reports.title")}
        </Typography>
      </Box>

      <Paper className={classes.card} elevation={0} style={{ marginBottom: 16 }}>
        <Box className={classes.filters} style={{ marginBottom: 0 }}>
          <FormControl variant="outlined" size="small" style={{ minWidth: 160 }}>
            <InputLabel>{i18n.t("crm.reports.period")}</InputLabel>
            <Select
              label={i18n.t("crm.reports.period")}
              value={periodPreset}
              onChange={handlePeriodChange}
            >
              <MenuItem value="today">{i18n.t("crm.reports.periodToday")}</MenuItem>
              <MenuItem value="7d">{i18n.t("crm.reports.period7d")}</MenuItem>
              <MenuItem value="30d">{i18n.t("crm.reports.period30d")}</MenuItem>
              <MenuItem value="month">{i18n.t("crm.reports.periodMonth")}</MenuItem>
              <MenuItem value="custom">{i18n.t("crm.reports.periodCustom")}</MenuItem>
            </Select>
          </FormControl>
          {periodPreset === "custom" ? (
            <>
              <TextField
                type="date"
                size="small"
                variant="outlined"
                label={i18n.t("crm.reports.startDate")}
                InputLabelProps={{ shrink: true }}
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <TextField
                type="date"
                size="small"
                variant="outlined"
                label={i18n.t("crm.reports.endDate")}
                InputLabelProps={{ shrink: true }}
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </>
          ) : null}
          <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
            <InputLabel>{i18n.t("crm.summary.pipeline")}</InputLabel>
            <Select
              label={i18n.t("crm.summary.pipeline")}
              value={pipelineId}
              onChange={(e) => setPipelineId(e.target.value)}
            >
              <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
              {pipelines.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
            <InputLabel>{i18n.t("crm.filters.assignee")}</InputLabel>
            <Select
              label={i18n.t("crm.filters.assignee")}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
              <MenuItem value="unassigned">{i18n.t("crm.deal.fields.unassigned")}</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {u.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
            <InputLabel>{i18n.t("crm.filters.source")}</InputLabel>
            <Select
              label={i18n.t("crm.filters.source")}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
              <MenuItem value="manual">{i18n.t("crm.deal.source.manual")}</MenuItem>
              <MenuItem value="whatsapp">{i18n.t("crm.deal.source.whatsapp")}</MenuItem>
              <MenuItem value="instagram">{i18n.t("crm.deal.source.instagram")}</MenuItem>
              <MenuItem value="other">{i18n.t("crm.deal.source.other")}</MenuItem>
            </Select>
          </FormControl>
          <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
            <InputLabel>{i18n.t("crm.filters.status")}</InputLabel>
            <Select
              label={i18n.t("crm.filters.status")}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
              <MenuItem value="open">{i18n.t("crm.status.open")}</MenuItem>
              <MenuItem value="won">{terms.statusWon}</MenuItem>
              <MenuItem value="lost">{terms.statusLost}</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={36} />
        </Box>
      ) : null}

      {!loading && summary ? (
        <>
          <Grid container spacing={2} style={{ marginBottom: 24 }}>
            {[
              { label: i18n.t("crm.reports.createdInPeriod"), value: summary.createdCount },
              { label: i18n.t("crm.reports.openNow"), value: summary.openCount },
              {
                label: `${terms.statusWon} (${i18n.t("crm.reports.wonInPeriod")})`,
                value: summary.wonCount,
              },
              {
                label: `${terms.statusLost} (${i18n.t("crm.reports.lostInPeriod")})`,
                value: summary.lostCount,
              },
              { label: i18n.t("crm.reports.conversionRate"), value: conversionLabel },
              {
                label: terms.metricValueOpen || i18n.t("crm.reports.openValue"),
                value: formatMoney(summary.openValue),
              },
              { label: i18n.t("crm.reports.wonValue"), value: formatMoney(summary.wonValue) },
              { label: i18n.t("crm.reports.avgClose"), value: formatAvgMs(summary.avgCloseMs) },
              {
                label: i18n.t("crm.reports.stalledAttention"),
                value: summary.attentionCount,
              },
            ].map((c) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={c.label}>
                <Paper className={classes.card} elevation={0}>
                  <Typography variant="caption" color="textSecondary" display="block">
                    {c.label}
                  </Typography>
                  <Typography variant="h6" style={{ fontWeight: 600 }}>
                    {c.value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <CrmReportsCharts
            stages={stages}
            bottlenecks={bottlenecks}
            summary={summary}
            timeline={timeline}
            terms={terms}
            locale={loc}
            formatMoney={formatMoney}
            formatAvgMs={formatAvgMs}
          />

          <Paper className={classes.card} elevation={0} style={{ marginBottom: 24 }}>
            <Typography variant="subtitle1" gutterBottom style={{ fontWeight: 600 }}>
              {i18n.t("crm.reports.conversionDetail")}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {i18n.t("crm.reports.conversionRate")}: {conversionLabel} ·{" "}
              {i18n.t("crm.reports.wonQty")}: {summary.wonCount} ·{" "}
              {i18n.t("crm.reports.lostQty")}: {summary.lostCount} ·{" "}
              {i18n.t("crm.reports.wonValue")}: {formatMoney(summary.wonValue)} ·{" "}
              {i18n.t("crm.reports.lostValue")}: {formatMoney(summary.lostValue)}
            </Typography>
          </Paper>

          <Typography variant="h6" gutterBottom style={{ fontWeight: 600 }}>
            {i18n.t("crm.reports.funnelTitle")}
          </Typography>
          {noFunnelStages ? (
            <Typography color="textSecondary" paragraph>
              {i18n.t("crm.reports.noDataPeriod")}
            </Typography>
          ) : (
            <Table size="small" component={Paper} style={{ marginBottom: 24 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("crm.reports.stageCol")}</TableCell>
                  <TableCell align="right">{i18n.t("crm.reports.qtyCurrent")}</TableCell>
                  <TableCell align="right">{i18n.t("crm.reports.valueCurrent")}</TableCell>
                  <TableCell align="right">{i18n.t("crm.reports.avgTime")}</TableCell>
                  <TableCell align="right">{i18n.t("crm.reports.pctTotal")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stages.map((row) => (
                  <TableRow key={row.stageId}>
                    <TableCell>{row.stageName}</TableCell>
                    <TableCell align="right">{row.currentCount}</TableCell>
                    <TableCell align="right">{formatMoney(row.currentValue)}</TableCell>
                    <TableCell align="right">
                      {row.avgDurationMs != null ? formatAvgMs(row.avgDurationMs) : "—"}
                    </TableCell>
                    <TableCell align="right">{row.percentOfOpen}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Typography variant="h6" gutterBottom style={{ fontWeight: 600 }}>
            {i18n.t("crm.reports.attentionTitle")}
          </Typography>
          {attentionDeals.length === 0 ? (
            <Typography color="textSecondary">{i18n.t("crm.reports.noDataPeriod")}</Typography>
          ) : (
            <Table size="small" component={Paper}>
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("crm.deal.fields.title")}</TableCell>
                  <TableCell>{i18n.t("crm.reports.stageCol")}</TableCell>
                  <TableCell>{i18n.t("crm.filters.assignee")}</TableCell>
                  <TableCell>{i18n.t("crm.reports.staleSince")}</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {attentionDeals.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.title}</TableCell>
                    <TableCell>{d.stageName}</TableCell>
                    <TableCell>{d.assignedUserName ?? "—"}</TableCell>
                    <TableCell>
                      {d.lastActivityAt
                        ? formatDistanceToNow(new Date(d.lastActivityAt), {
                            addSuffix: true,
                            locale: loc,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        color="primary"
                        component={Link}
                        to={`/crm?dealId=${d.id}`}
                      >
                        {i18n.t("crm.reports.openDeal")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      ) : null}
    </Box>
  );
}
