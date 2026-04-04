import React, { useState, useEffect } from "react";
import Paper from "@material-ui/core/Paper";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";

import AssignmentOutlinedIcon from "@material-ui/icons/AssignmentOutlined";
import ScheduleOutlinedIcon from "@material-ui/icons/ScheduleOutlined";
import CheckCircleOutlinedIcon from "@material-ui/icons/CheckCircleOutlined";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import ChatBubbleOutlinedIcon from "@material-ui/icons/ChatBubbleOutlined";
import PeopleOutlinedIcon from "@material-ui/icons/PeopleOutlined";
import AssessmentOutlinedIcon from "@material-ui/icons/AssessmentOutlined";

import { makeStyles } from "@material-ui/core/styles";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";
import TableAttendantsStatus from "../../components/Dashboard/TableAttendantsStatus";
import { isArray } from "lodash";
import useDashboard from "../../hooks/useDashboard";
import api from "../../services/api";
import { ChatsUser } from "./ChartsUser";
import { isEmpty } from "lodash";
import moment from "moment";
import { ChartsDate } from "./ChartsDate";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(4),
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  periodSelectorRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: theme.spacing(2),
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  periodSelect: {
    minWidth: 140,
    "& .MuiSelect-root": { paddingTop: 8, paddingBottom: 8 },
  },
  periodDateField: {
    "& .MuiInputBase-root": { fontSize: "0.875rem" },
    "& input": { padding: "8px 12px" },
  },
  card: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing(1),
  },
  cardTitle: {
    fontSize: "0.875rem",
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "& svg": {
      fontSize: 22,
    },
  },
  iconBlue: {
    backgroundColor: "rgba(33, 150, 243, 0.12)",
    color: "#2196f3",
  },
  iconOrange: {
    backgroundColor: "rgba(255, 152, 0, 0.12)",
    color: "#ff9800",
  },
  iconGreen: {
    backgroundColor: "rgba(76, 175, 80, 0.12)",
    color: "#4caf50",
  },
  iconPurple: {
    backgroundColor: "rgba(156, 39, 176, 0.12)",
    color: "#9c27b0",
  },
  iconRed: {
    backgroundColor: "rgba(244, 67, 54, 0.12)",
    color: "#f44336",
  },
  cardValue: {
    fontSize: "1.75rem",
    fontWeight: 700,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(0.5),
  },
  cardSub: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.25),
  },
  chartWrap: {
    marginTop: "auto",
    height: 56,
    width: "100%",
    marginLeft: -theme.spacing(1),
    marginRight: -theme.spacing(1),
    marginBottom: -theme.spacing(0.5),
  },
  selectContainer: {
    width: "100%",
    textAlign: "left",
  },
  fullWidth: {
    width: "100%",
  },
  sectionTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(3),
    color: theme.palette.text.primary,
  },
  badgeGreen: {
    display: "inline-block",
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    color: "#4caf50",
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 6,
    marginRight: theme.spacing(1),
  },
  performanceTable: {
    "& .MuiTableHead-root .MuiTableRow-root th": {
      backgroundColor: "#1a1a1a",
      color: "#fff",
      fontWeight: 600,
      fontSize: "0.8125rem",
    },
    "& .MuiTableCell-root": {
      fontSize: "0.8125rem",
    },
  },
  emptyRow: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    fontStyle: "italic",
    padding: theme.spacing(4, 2),
  },
  dashboardBg: {
    backgroundColor: "#f4f4f4",
    minHeight: "100%",
  },
}));

// Converte série real (por dia) em dados para o mini gráfico. Se não houver série, usa valor único (linha estável).
function seriesToSparkData(series, valueKey, fallbackValue = 0) {
  if (isArray(series) && series.length > 0) {
    return series.map((p, i) => ({
      name: p.date ? String(p.date).slice(0, 10) : `${i + 1}`,
      value: Number(p[valueKey]) || 0,
    }));
  }
  const v = Number(fallbackValue) || 0;
  return [{ name: "1", value: v }, { name: "2", value: v }];
}

const Dashboard = () => {
  const classes = useStyles();
  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [series, setSeries] = useState([]);
  const [period, setPeriod] = useState(7);
  const [dateFrom, setDateFrom] = useState(moment().subtract(7, "days").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const [messageStats, setMessageStats] = useState({ sent: 0, received: 0 });
  const [contactsCount, setContactsCount] = useState(0);
  const { find } = useDashboard();

  useEffect(() => {
    if (period > 0) {
      const days = period === 1 ? 1 : period;
      setDateFrom(moment().subtract(days, "days").format("YYYY-MM-DD"));
      setDateTo(moment().format("YYYY-MM-DD"));
    }
  }, [period]);

  useEffect(() => {
    if (period > 0) {
      const t = setTimeout(() => fetchData(), 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    api.get("/contacts", { params: { pageNumber: 1 } }).then((r) => {
      setContactsCount(r.data?.count ?? 0);
    }).catch(() => {});
  }, []);

  const handlePeriodChange = (value) => {
    setPeriod(Number(value));
  };

  async function fetchData() {
    setLoading(true);
    let params = {};
    if (period > 0) {
      params = { days: period };
    } else if (!isEmpty(dateFrom) && !isEmpty(dateTo) && moment(dateFrom).isValid() && moment(dateTo).isValid()) {
      params = {
        date_from: moment(dateFrom).format("YYYY-MM-DD"),
        date_to: moment(dateTo).format("YYYY-MM-DD"),
      };
    } else {
      setLoading(false);
      return;
    }
    try {
      const data = await find(params);
      setCounters(data.counters || {});
      setAttendants(isArray(data.attendants) ? data.attendants : []);
      setMessageStats(data.messageStats || { sent: 0, received: 0 });
      setSeries(isArray(data.series) ? data.series : []);
    } catch (e) {
      setCounters({});
      setAttendants([]);
      setSeries([]);
    }
    setLoading(false);
  }

  function formatTime(minutes) {
    if (minutes == null || isNaN(minutes)) return "0 min";
    const m = Math.round(Number(minutes));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min ? `${h}h ${min}min` : `${h}h`;
  }

  const totalAtendimentos =
    (Number(counters.supportHappening) || 0) +
    (Number(counters.supportPending) || 0) +
    (Number(counters.supportFinished) || 0) || 0;
  const taxaResolucao =
    totalAtendimentos > 0
      ? ((Number(counters.supportFinished) || 0) / totalAtendimentos * 100).toFixed(1)
      : "0";
  const pendentes = Number(counters.supportPending) || 0;
  const fechados = Number(counters.supportFinished) || 0;
  const emAtendimento = Number(counters.supportHappening) || 0;
  const percentPendentes =
    totalAtendimentos > 0 ? ((pendentes / totalAtendimentos) * 100).toFixed(0) : 0;
  const totalMensagens =
    (messageStats.sent || 0) + (messageStats.received || 0);
  const sent = messageStats.sent || 0;
  const received = messageStats.received || 0;

  const avgWaitMin = counters.avgWaitTime != null ? Math.round(Number(counters.avgWaitTime)) : 0;
  const avgSupportMin = counters.avgSupportTime != null ? Math.round(Number(counters.avgSupportTime)) : 0;

  const onlineCount = attendants.filter((a) => a.online).length;
  const totalUsers = attendants.length || 1;
  const taxaOnline = totalUsers > 0 ? ((onlineCount / totalUsers) * 100).toFixed(0) : 0;
  const avgRating = attendants.length > 0
    ? (attendants.reduce((s, a) => s + (Number(a.rating) || 0), 0) / attendants.length).toFixed(1)
    : "0.0";
  const sparkContacts = seriesToSparkData(series, "total", contactsCount);
  const sparkOnline = seriesToSparkData(series, "total", onlineCount);
  const sparkRating = [{ name: "1", value: Number(avgRating) || 0 }, { name: "2", value: Number(avgRating) || 0 }];

  const sparkTotal = seriesToSparkData(series, "total", totalAtendimentos);
  const sparkPendentes = seriesToSparkData(series, "pending", pendentes);
  const sparkFechados = seriesToSparkData(series, "closed", fechados);
  const sparkWait = seriesToSparkData(series, "avgWait", avgWaitMin);
  const sparkSupport = seriesToSparkData(series, "avgSupport", avgSupportMin);
  const sparkMsg =
    series.length > 0
      ? series.map((p, i) => ({
          name: p.date ? String(p.date).slice(0, 10) : `${i + 1}`,
          value: (Number(p.sent) || 0) + (Number(p.received) || 0),
        }))
      : [{ name: "1", value: totalMensagens }, { name: "2", value: totalMensagens }];

  return (
    <div className={classes.dashboardBg}>
      <Container maxWidth="lg" className={classes.container}>
        {/* Seletor de período - compacto, canto superior direito */}
        <div className={classes.periodSelectorRow}>
          <FormControl size="small" variant="outlined" className={classes.periodSelect}>
            <InputLabel>{i18n.t("dashboard.periodSelect.title", "Período")}</InputLabel>
            <Select
              value={period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              label={i18n.t("dashboard.periodSelect.title", "Período")}
            >
              <MenuItem value={1}>{i18n.t("dashboard.periodSelect.options.today", "Hoje")}</MenuItem>
              <MenuItem value={7}>{i18n.t("dashboard.periodSelect.options.last7", "7 dias")}</MenuItem>
              <MenuItem value={15}>{i18n.t("dashboard.periodSelect.options.last15", "15 dias")}</MenuItem>
              <MenuItem value={30}>{i18n.t("dashboard.periodSelect.options.last30", "30 dias")}</MenuItem>
              <MenuItem value={0}>{i18n.t("dashboard.periodSelect.options.custom", "Personalizado")}</MenuItem>
            </Select>
          </FormControl>
          {period === 0 && (
            <>
              <TextField
                type="date"
                size="small"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                className={classes.periodDateField}
                style={{ width: 140 }}
                inputProps={{ "aria-label": "Data inicial" }}
              />
              <TextField
                type="date"
                size="small"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                className={classes.periodDateField}
                style={{ width: 140 }}
                inputProps={{ "aria-label": "Data final" }}
              />
              <ButtonWithSpinner
                loading={loading}
                onClick={() => fetchData()}
                variant="contained"
                color="primary"
                size="small"
              >
                {i18n.t("dashboard.buttons.filter", "Filtrar")}
              </ButtonWithSpinner>
            </>
          )}
        </div>

        {/* Cards */}
        <Grid container spacing={3}>
          {/* 1. Total de Atendimentos */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper className={classes.card} elevation={0}>
              <div className={classes.cardHeader}>
                <Typography className={classes.cardTitle}>
                  {i18n.t("dashboard.cards.totalAttendances", "Total de Atendimentos")}
                </Typography>
                <div className={`${classes.iconCircle} ${classes.iconBlue}`}>
                  <AssignmentOutlinedIcon />
                </div>
              </div>
              <Typography className={classes.cardValue}>{totalAtendimentos}</Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.inAttendance", "Em Atendimento")}: {emAtendimento}
              </Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.resolutionRate", "Taxa Resolução")}: {taxaResolucao}%
              </Typography>
              <div className={classes.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkTotal} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2196f3" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#2196f3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#2196f3" fill="url(#areaBlue)" strokeWidth={1.5} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          </Grid>

          {/* 2. Pendentes */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper className={classes.card} elevation={0}>
              <div className={classes.cardHeader}>
                <Typography className={classes.cardTitle}>
                  {i18n.t("dashboard.counters.waiting", "Pendentes")}
                </Typography>
                <div className={`${classes.iconCircle} ${classes.iconOrange}`}>
                  <ScheduleOutlinedIcon />
                </div>
              </div>
              <Typography className={classes.cardValue}>{pendentes}</Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.ofTotal", "Do Total")}: {percentPendentes}%
              </Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.statusWaiting", "Status: Aguardando Atendimento")}
              </Typography>
              <div className={classes.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkPendentes} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaOrange" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff9800" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#ff9800" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#ff9800" fill="url(#areaOrange)" strokeWidth={1.5} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          </Grid>

          {/* 3. Fechados */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper className={classes.card} elevation={0}>
              <div className={classes.cardHeader}>
                <Typography className={classes.cardTitle}>
                  {i18n.t("dashboard.counters.finished", "Fechados")}
                </Typography>
                <div className={`${classes.iconCircle} ${classes.iconGreen}`}>
                  <CheckCircleOutlinedIcon />
                </div>
              </div>
              <Typography className={classes.cardValue}>
                <span className={classes.badgeGreen}>^ {taxaResolucao}%</span>
                {fechados}
              </Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.resolutionRate", "Taxa Resolução")}: {taxaResolucao}%
              </Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.ofTotal", "Do Total")}: {totalAtendimentos}
              </Typography>
              <div className={classes.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkFechados} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4caf50" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#4caf50" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#4caf50" fill="url(#areaGreen)" strokeWidth={1.5} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          </Grid>

          {/* 4. Tempo Médio 1° Resposta */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper className={classes.card} elevation={0}>
              <div className={classes.cardHeader}>
                <Typography className={classes.cardTitle}>
                  {i18n.t("dashboard.cards.avgFirstResponse", "Tempo Médio 1° Resposta")}
                </Typography>
                <div className={`${classes.iconCircle} ${classes.iconBlue}`}>
                  <AccessTimeIcon />
                </div>
              </div>
              <Typography className={classes.cardValue}>{formatTime(avgWaitMin)}</Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.inMinutes", "Em Minutos")}: {avgWaitMin} min
              </Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.status", "Status")}: {avgWaitMin <= 5 ? "Ótimo" : avgWaitMin <= 15 ? "Rápido" : "Normal"}
              </Typography>
              <div className={classes.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkWait} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaBlue2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2196f3" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#2196f3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#2196f3" fill="url(#areaBlue2)" strokeWidth={1.5} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          </Grid>

          {/* 5. Tempo Médio Atendimento */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper className={classes.card} elevation={0}>
              <div className={classes.cardHeader}>
                <Typography className={classes.cardTitle}>
                  {i18n.t("dashboard.counters.averageTalkTime", "Tempo Médio Atendimento")}
                </Typography>
                <div className={`${classes.iconCircle} ${classes.iconOrange}`}>
                  <ScheduleOutlinedIcon />
                </div>
              </div>
              <Typography className={classes.cardValue}>{formatTime(avgSupportMin)}</Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.inMinutes", "Em Minutos")}: {avgSupportMin} min
              </Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.status", "Status")}: {avgSupportMin <= 20 ? "Rápido" : "Normal"}
              </Typography>
              <div className={classes.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkSupport} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaOrange2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff9800" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#ff9800" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#ff9800" fill="url(#areaOrange2)" strokeWidth={1.5} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          </Grid>

          {/* 6. Total de Mensagens */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper className={classes.card} elevation={0}>
              <div className={classes.cardHeader}>
                <Typography className={classes.cardTitle}>
                  {i18n.t("dashboard.cards.totalMessages", "Total de Mensagens")}
                </Typography>
                <div className={`${classes.iconCircle} ${classes.iconBlue}`}>
                  <ChatBubbleOutlinedIcon />
                </div>
              </div>
              <Typography className={classes.cardValue}>{totalMensagens}</Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.sent", "Enviadas")}: {sent}
              </Typography>
              <Typography className={classes.cardSub}>
                {i18n.t("dashboard.cards.received", "Recebidas")}: {received}
              </Typography>
              <div className={classes.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkMsg} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaBlue3" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2196f3" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#2196f3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#2196f3" fill="url(#areaBlue3)" strokeWidth={1.5} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          </Grid>

          {/* 7. Total de Contatos */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper className={classes.card} elevation={0}>
              <div className={classes.cardHeader}>
                <Typography className={classes.cardTitle}>Total de Contatos</Typography>
                <div className={`${classes.iconCircle} ${classes.iconPurple}`}>
                  <PeopleOutlinedIcon />
                </div>
              </div>
              <Typography className={classes.cardValue}>{contactsCount}</Typography>
              <Typography className={classes.cardSub}>Contatos Ativos: {contactsCount}</Typography>
              <Typography className={classes.cardSub}>Inativos: 0</Typography>
              <div className={classes.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkContacts} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaPurple" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9c27b0" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#9c27b0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#9c27b0" fill="url(#areaPurple)" strokeWidth={1.5} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          </Grid>

          {/* 8. Usuários Online */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper className={classes.card} elevation={0}>
              <div className={classes.cardHeader}>
                <Typography className={classes.cardTitle}>Usuários Online</Typography>
                <div className={`${classes.iconCircle} ${classes.iconPurple}`}>
                  <PeopleOutlinedIcon />
                </div>
              </div>
              <Typography className={classes.cardValue}>{onlineCount}</Typography>
              <Typography className={classes.cardSub}>Taxa Online: {taxaOnline}%</Typography>
              <Typography className={classes.cardSub}>Offline: {totalUsers - onlineCount}</Typography>
              <div className={classes.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkOnline} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaPurple2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9c27b0" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#9c27b0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#9c27b0" fill="url(#areaPurple2)" strokeWidth={1.5} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          </Grid>

          {/* 9. Avaliação Média */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper className={classes.card} elevation={0}>
              <div className={classes.cardHeader}>
                <Typography className={classes.cardTitle}>Avaliação Média</Typography>
                <div className={`${classes.iconCircle} ${classes.iconRed}`}>
                  <AssessmentOutlinedIcon />
                </div>
              </div>
              <Typography className={classes.cardValue}>{avgRating}</Typography>
              <Typography className={classes.cardSub}>Escala: 1 a 3</Typography>
              <Typography className={classes.cardSub}>
                Status:{" "}
                {Number(avgRating) >= 2.5 ? "Ótimo" : Number(avgRating) >= 1.5 ? "Bom" : "Melhorar"}
              </Typography>
              <div className={classes.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkRating} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f44336" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f44336" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#f44336" fill="url(#areaRed)" strokeWidth={1.5} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide domain={[0, 3]} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          </Grid>
        </Grid>

        {/* Performance de Usuários / Filas / Conexões */}
        <Typography className={classes.sectionTitle}>
          Performance de Usuários
        </Typography>
        {attendants.length > 0 ? (
          <Paper elevation={0} style={{ borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <TableContainer>
              <Table size="small" className={classes.performanceTable}>
                <TableHead>
                  <TableRow>
                    <TableCell>Usuário</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Total</TableCell>
                    <TableCell align="center">Tempo Médio</TableCell>
                    <TableCell align="center">Avaliação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attendants.map((a, k) => (
                    <TableRow key={k}>
                      <TableCell>{a.name}</TableCell>
                      <TableCell align="center">
                        <span style={{
                          backgroundColor: a.online ? "rgba(76, 175, 80, 0.15)" : "rgba(244, 67, 54, 0.15)",
                          color: a.online ? "#4caf50" : "#f44336",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}>
                          {a.online ? "Online" : "Offline"}
                        </span>
                      </TableCell>
                      <TableCell align="center">{a.total != null ? a.total : "-"}</TableCell>
                      <TableCell align="center">{a.avgSupportTime != null ? formatTime(a.avgSupportTime) : "-"}</TableCell>
                      <TableCell align="center">{a.rating != null ? Number(a.rating).toFixed(1) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ) : (
          <Paper elevation={0} style={{ borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <TableContainer>
              <Table size="small" className={classes.performanceTable}>
                <TableHead>
                  <TableRow>
                    <TableCell>Usuário</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Total</TableCell>
                    <TableCell align="center">Tempo Médio</TableCell>
                    <TableCell align="center">Avaliação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow><TableCell colSpan={5} className={classes.emptyRow}>Nenhum dado disponível</TableCell></TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        <Typography className={classes.sectionTitle}>
          Performance de Filas
        </Typography>
        <Paper elevation={0} style={{ borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
          <TableContainer>
            <Table size="small" className={classes.performanceTable}>
              <TableHead>
                <TableRow>
                  <TableCell>Fila</TableCell>
                  <TableCell align="center">Total</TableCell>
                  <TableCell align="center">Tempo Médio</TableCell>
                  <TableCell align="center">Taxa Resolução</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow><TableCell colSpan={4} className={classes.emptyRow}>Nenhum dado disponível</TableCell></TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Typography className={classes.sectionTitle}>
          Performance de Conexões
        </Typography>
        <Paper elevation={0} style={{ borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
          <TableContainer>
            <Table size="small" className={classes.performanceTable}>
              <TableHead>
                <TableRow>
                  <TableCell>Conexão</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Atendimentos</TableCell>
                  <TableCell align="center">Mensagens</TableCell>
                  <TableCell align="center">Tempo Médio</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow><TableCell colSpan={5} className={classes.emptyRow}>Nenhum dado disponível</TableCell></TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Gráficos */}
        <Typography className={classes.sectionTitle}>
          Atendimentos ao Longo do Tempo
        </Typography>
        <Grid container spacing={3} style={{ marginTop: 8, marginBottom: 24 }}>
          <Grid item xs={12}>
            <ChartsDate />
          </Grid>
        </Grid>
        <Typography className={classes.sectionTitle}>
          Mensagens ao Longo do Tempo / Performance por Usuário
        </Typography>
        <Grid container spacing={3} style={{ marginTop: 8 }}>
          <Grid item xs={12} md={6}>
            <ChatsUser />
          </Grid>
          <Grid item xs={12} md={6}>
            {attendants.length > 0 ? (
              <Paper elevation={0} variant="outlined" style={{ borderRadius: 12, overflow: "hidden", height: "100%" }}>
                <TableAttendantsStatus attendants={attendants} loading={loading} />
              </Paper>
            ) : null}
          </Grid>
        </Grid>

      </Container>
    </div>
  );
};

export default Dashboard;
