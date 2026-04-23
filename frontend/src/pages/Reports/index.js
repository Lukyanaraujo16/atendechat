import React, { useState, useEffect } from "react";
import {
  makeStyles,
  useTheme,
  Paper,
  Typography,
  Grid,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from "@material-ui/core";
import {
  AssessmentOutlined,
  AssignmentOutlined,
  PeopleOutlined,
  ChatBubbleOutlined,
  PrintOutlined,
  DescriptionOutlined,
} from "@material-ui/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import moment from "moment";
import { isArray } from "lodash";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import useDashboard from "../../hooks/useDashboard";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { fade } from "@material-ui/core/styles/colorManipulator";

const REPORT_TYPES = {
  RESUMO: "resumo",
  ATENDIMENTOS: "atendimentos",
  USUARIOS: "usuarios",
  MENSAGENS: "mensagens",
};

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    backgroundColor: theme.palette.background.default,
    minHeight: "100%",
    paddingBottom: theme.spacing(4),
  },
  headerPaper: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
    color: theme.palette.primary.contrastText,
    borderRadius: 12,
    boxShadow: theme.shadows[4],
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: "1.75rem",
    letterSpacing: "-0.02em",
    marginBottom: theme.spacing(0.5),
  },
  headerSubtitle: {
    opacity: 0.9,
    fontSize: "0.95rem",
  },
  reportCard: {
    padding: theme.spacing(2.5),
    height: "100%",
    cursor: "pointer",
    transition: "all 0.2s ease",
    borderRadius: 12,
    border: "2px solid transparent",
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[1],
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: theme.shadows[4],
      borderColor: theme.palette.primary.main,
    },
  },
  reportCardSelected: {
    borderColor: theme.palette.primary.main,
    backgroundColor: fade(theme.palette.primary.main, 0.08),
  },
  reportCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing(1.5),
    "& svg": { fontSize: 28 },
  },
  reportCardTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    marginBottom: theme.spacing(0.5),
    color: theme.palette.text.primary,
  },
  reportCardDesc: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.4,
  },
  filterBar: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    marginBottom: theme.spacing(3),
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[1],
    border: `1px solid ${theme.palette.divider}`,
  },
  reportContent: {
    padding: theme.spacing(3),
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[1],
    border: `1px solid ${theme.palette.divider}`,
  },
  statCard: {
    padding: theme.spacing(2),
    borderRadius: 10,
    height: "100%",
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  statValue: {
    fontSize: "1.75rem",
    fontWeight: 700,
    color: theme.palette.primary.main,
  },
  statLabel: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  printBtn: {
    textTransform: "none",
    fontWeight: 600,
  },
  contentSectionTitle: {
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  tableHeadRow: {
    backgroundColor: theme.palette.action.hover,
  },
  tableHeadCell: {
    fontWeight: 600,
    color: theme.palette.text.primary,
    borderColor: theme.palette.divider,
  },
  tableBodyCell: {
    color: theme.palette.text.primary,
    borderColor: theme.palette.divider,
  },
  statusBadgeOnline: {
    backgroundColor: fade(theme.palette.success.main, 0.12),
    color: theme.palette.success.main,
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  statusBadgeOffline: {
    backgroundColor: fade(theme.palette.error.main, 0.12),
    color: theme.palette.error.main,
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  generatedAtCaption: {
    marginTop: 16,
    color: theme.palette.text.secondary,
  },
  subsectionTitle: {
    fontWeight: 600,
    marginTop: 24,
    marginBottom: 12,
    color: theme.palette.text.primary,
  },
  headerDocIcon: {
    fontSize: 32,
    marginRight: 12,
    opacity: 0.9,
    color: theme.palette.primary.contrastText,
  },
}));

const Reports = () => {
  const classes = useStyles();
  const theme = useTheme();
  const chartGridStroke = theme.palette.divider;
  const chartTickColor = theme.palette.text.secondary;
  const { find } = useDashboard();
  const [reportType, setReportType] = useState(REPORT_TYPES.RESUMO);
  const [period, setPeriod] = useState(7);
  const [dateFrom, setDateFrom] = useState(moment().subtract(7, "days").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [messageStats, setMessageStats] = useState({ sent: 0, received: 0 });
  const [ticketsDay, setTicketsDay] = useState({ data: [], count: 0 });
  const [ticketsUsers, setTicketsUsers] = useState({ data: [] });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const params = period > 0
        ? { days: period }
        : {
            date_from: dateFrom,
            date_to: dateTo,
          };
      const data = await find(params);
      setCounters(data.counters || {});
      setAttendants(isArray(data.attendants) ? data.attendants : []);
      setMessageStats(data.messageStats || { sent: 0, received: 0 });
    } catch (e) {
      toastError(e);
      setCounters({});
      setAttendants([]);
    }
    setLoading(false);
  };

  const fetchTicketsDay = async () => {
    try {
      const companyId = localStorage.getItem("companyId");
      const { data } = await api.get(
        `/dashboard/ticketsDay?initialDate=${dateFrom}&finalDate=${dateTo}&companyId=${companyId}`
      );
      setTicketsDay({
        data: Array.isArray(data?.data) ? data.data : [],
        count: data?.count ?? 0,
      });
    } catch (e) {
      setTicketsDay({ data: [], count: 0 });
    }
  };

  const fetchTicketsUsers = async () => {
    try {
      const companyId = localStorage.getItem("companyId");
      const { data } = await api.get(
        `/dashboard/ticketsUsers?initialDate=${dateFrom}&finalDate=${dateTo}&companyId=${companyId}`
      );
      setTicketsUsers({
        data: Array.isArray(data?.data) ? data.data : [],
      });
    } catch (e) {
      setTicketsUsers({ data: [] });
    }
  };

  useEffect(() => {
    if (period > 0) {
      setDateFrom(moment().subtract(period, "days").format("YYYY-MM-DD"));
      setDateTo(moment().format("YYYY-MM-DD"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    fetchDashboardData();
  }, [period, dateFrom, dateTo]);

  useEffect(() => {
    if (reportType === REPORT_TYPES.ATENDIMENTOS) fetchTicketsDay();
    if (reportType === REPORT_TYPES.USUARIOS) fetchTicketsUsers();
  }, [reportType, dateFrom, dateTo]);

  const handlePrint = () => {
    window.print();
  };

  const formatTime = (minutes) => {
    if (minutes == null || isNaN(minutes)) return "0 min";
    const m = Math.round(Number(minutes));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min ? `${h}h ${min}min` : `${h}h`;
  };

  const totalAtendimentos =
    (Number(counters.supportHappening) || 0) +
    (Number(counters.supportPending) || 0) +
    (Number(counters.supportFinished) || 0) || 0;
  const taxaResolucao =
    totalAtendimentos > 0
      ? (((Number(counters.supportFinished) || 0) / totalAtendimentos) * 100).toFixed(1)
      : "0";

  const reportCards = [
    {
      id: REPORT_TYPES.RESUMO,
      title: i18n.t("dashboard.reports.types.summary", "Resumo Geral"),
      desc: i18n.t("dashboard.reports.types.summaryDesc", "Visão consolidada de atendimentos, tempos e indicadores"),
      icon: <AssessmentOutlined />,
      color: theme.palette.primary.main,
    },
    {
      id: REPORT_TYPES.ATENDIMENTOS,
      title: i18n.t("dashboard.reports.types.attendances", "Atendimentos por Período"),
      desc: i18n.t("dashboard.reports.types.attendancesDesc", "Distribuição de tickets por data e horário"),
      icon: <AssignmentOutlined />,
      color: theme.palette.info.main,
    },
    {
      id: REPORT_TYPES.USUARIOS,
      title: i18n.t("dashboard.reports.types.users", "Performance de Usuários"),
      desc: i18n.t("dashboard.reports.types.usersDesc", "Atendimentos por atendente no período"),
      icon: <PeopleOutlined />,
      color: theme.palette.success.main,
    },
    {
      id: REPORT_TYPES.MENSAGENS,
      title: i18n.t("dashboard.reports.types.messages", "Relatório de Mensagens"),
      desc: i18n.t("dashboard.reports.types.messagesDesc", "Volume de mensagens enviadas e recebidas"),
      icon: <ChatBubbleOutlined />,
      color: theme.palette.warning.main,
    },
  ];

  const chartColorsDate = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.info.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
  ];
  const chartColorsUser = [
    theme.palette.info.main,
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
  ];

  const chartDataDay =
    Array.isArray(ticketsDay?.data) && ticketsDay.data.length > 0
      ? ticketsDay.data.map((item) => ({
          name: item.hasOwnProperty("horario") ? `${item.horario}h` : item.data,
          total: item.total,
        }))
      : [];

  const chartDataUsers =
    Array.isArray(ticketsUsers?.data) && ticketsUsers.data.length > 0
      ? ticketsUsers.data.map((item) => ({
          name: item.nome || "-",
          quantidade: item.quantidade,
        }))
      : [];

  const renderReportContent = () => {
    if (reportType === REPORT_TYPES.RESUMO) {
      return (
        <div className={`${classes.reportContent} report-print-area`}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" className={classes.contentSectionTitle}>
              {i18n.t("dashboard.reports.summary.title", "Resumo do Período")}
            </Typography>
            <Button
              startIcon={<PrintOutlined />}
              variant="outlined"
              color="primary"
              onClick={handlePrint}
              className={classes.printBtn}
            >
              {i18n.t("dashboard.reports.print", "Imprimir")}
            </Button>
          </Box>
          <Divider style={{ marginBottom: 24 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>{totalAtendimentos}</Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.summary.totalAttendances", "Total de Atendimentos")}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>{counters.supportHappening || 0}</Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.summary.inProgress", "Em Atendimento")}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>{counters.supportPending || 0}</Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.summary.pending", "Pendentes")}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>{counters.supportFinished || 0}</Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.summary.finished", "Finalizados")}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>{taxaResolucao}%</Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.summary.resolutionRate", "Taxa de Resolução")}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>
                  {formatTime(counters.avgWaitTime)}
                </Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.summary.avgFirstResponse", "Tempo Médio 1ª Resposta")}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>
                  {formatTime(counters.avgSupportTime)}
                </Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.summary.avgSupportTime", "Tempo Médio Atendimento")}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>
                  {(messageStats.sent || 0) + (messageStats.received || 0)}
                </Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.summary.totalMessages", "Total de Mensagens")}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
          {(attendants.length > 0) && (
            <>
              <Typography variant="subtitle1" className={classes.subsectionTitle}>
                {i18n.t("dashboard.reports.summary.byUser", "Por Usuário")}
              </Typography>
              <TableContainer component={Paper} elevation={0} style={{ borderRadius: 8, border: `1px solid ${theme.palette.divider}` }}>
                <Table size="small">
                  <TableHead>
                    <TableRow className={classes.tableHeadRow}>
                      <TableCell className={classes.tableHeadCell}>Usuário</TableCell>
                      <TableCell align="center" className={classes.tableHeadCell}>Status</TableCell>
                      <TableCell align="center" className={classes.tableHeadCell}>Total</TableCell>
                      <TableCell align="center" className={classes.tableHeadCell}>Tempo Médio</TableCell>
                      <TableCell align="center" className={classes.tableHeadCell}>Avaliação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(Array.isArray(attendants) ? attendants : []).map((a, k) => (
                      <TableRow key={k}>
                        <TableCell className={classes.tableBodyCell}>{a.name}</TableCell>
                        <TableCell align="center" className={classes.tableBodyCell}>
                          <span className={a.online ? classes.statusBadgeOnline : classes.statusBadgeOffline}>
                            {a.online ? "Online" : "Offline"}
                          </span>
                        </TableCell>
                        <TableCell align="center" className={classes.tableBodyCell}>{a.total != null ? a.total : "-"}</TableCell>
                        <TableCell align="center" className={classes.tableBodyCell}>{a.avgSupportTime != null ? formatTime(a.avgSupportTime) : "-"}</TableCell>
                        <TableCell align="center" className={classes.tableBodyCell}>{a.rating != null ? Number(a.rating).toFixed(1) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
          <Typography variant="caption" display="block" className={classes.generatedAtCaption}>
            {i18n.t("dashboard.reports.generatedAt", "Gerado em")}: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </Typography>
        </div>
      );
    }

    if (reportType === REPORT_TYPES.ATENDIMENTOS) {
      return (
        <div className={`${classes.reportContent} report-print-area`}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" className={classes.contentSectionTitle}>
              {i18n.t("dashboard.reports.attendances.title", "Atendimentos por Período")}
            </Typography>
            <Button startIcon={<PrintOutlined />} variant="outlined" color="primary" onClick={handlePrint} className={classes.printBtn}>
              {i18n.t("dashboard.reports.print", "Imprimir")}
            </Button>
          </Box>
          <Divider style={{ marginBottom: 24 }} />
          <Box height={360}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataDay} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTickColor }} stroke={chartTickColor} />
                <YAxis tick={{ fontSize: 12, fill: chartTickColor }} stroke={chartTickColor} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" radius={[6, 6, 0, 0]} name={i18n.t("dashboard.reports.attendances.tickets", "Atendimentos")}>
                  {chartDataDay.map((_, i) => (
                    <Cell key={i} fill={chartColorsDate[i % chartColorsDate.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Typography variant="caption" display="block" className={classes.generatedAtCaption}>
            {i18n.t("dashboard.reports.generatedAt", "Gerado em")}: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </Typography>
        </div>
      );
    }

    if (reportType === REPORT_TYPES.USUARIOS) {
      return (
        <div className={`${classes.reportContent} report-print-area`}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" className={classes.contentSectionTitle}>
              {i18n.t("dashboard.reports.users.title", "Performance de Usuários")}
            </Typography>
            <Button startIcon={<PrintOutlined />} variant="outlined" color="primary" onClick={handlePrint} className={classes.printBtn}>
              {i18n.t("dashboard.reports.print", "Imprimir")}
            </Button>
          </Box>
          <Divider style={{ marginBottom: 24 }} />
          <Box height={Math.max(320, chartDataUsers.length * 40)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataUsers} layout="vertical" margin={{ top: 8, right: 24, left: 100, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                <XAxis type="number" tick={{ fontSize: 12, fill: chartTickColor }} stroke={chartTickColor} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: chartTickColor }} stroke={chartTickColor} />
                <Tooltip />
                <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} name={i18n.t("dashboard.reports.users.tickets", "Atendimentos")}>
                  {chartDataUsers.map((_, i) => (
                    <Cell key={i} fill={chartColorsUser[i % chartColorsUser.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Typography variant="caption" display="block" className={classes.generatedAtCaption}>
            {i18n.t("dashboard.reports.generatedAt", "Gerado em")}: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </Typography>
        </div>
      );
    }

    if (reportType === REPORT_TYPES.MENSAGENS) {
      return (
        <div className={`${classes.reportContent} report-print-area`}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" className={classes.contentSectionTitle}>
              {i18n.t("dashboard.reports.messages.title", "Relatório de Mensagens")}
            </Typography>
            <Button startIcon={<PrintOutlined />} variant="outlined" color="primary" onClick={handlePrint} className={classes.printBtn}>
              {i18n.t("dashboard.reports.print", "Imprimir")}
            </Button>
          </Box>
          <Divider style={{ marginBottom: 24 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>{messageStats.sent || 0}</Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.messages.sent", "Mensagens Enviadas")}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>{messageStats.received || 0}</Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.messages.received", "Mensagens Recebidas")}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper className={classes.statCard} elevation={0}>
                <Typography className={classes.statValue}>
                  {(messageStats.sent || 0) + (messageStats.received || 0)}
                </Typography>
                <Typography className={classes.statLabel}>
                  {i18n.t("dashboard.reports.messages.total", "Total de Mensagens")}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
          <Typography variant="caption" display="block" className={classes.generatedAtCaption}>
            {i18n.t("dashboard.reports.generatedAt", "Gerado em")}: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </Typography>
        </div>
      );
    }

    return null;
  };

  return (
    <MainContainer>
      <div className={classes.pageRoot}>
        <Paper className={`${classes.headerPaper} report-no-print`} elevation={0}>
          <Box display="flex" alignItems="center" mb={1}>
            <DescriptionOutlined className={classes.headerDocIcon} />
            <div>
              <Typography className={classes.headerTitle}>
                {i18n.t("dashboard.reports.title", "Relatórios")}
              </Typography>
              <Typography className={classes.headerSubtitle}>
                {i18n.t("dashboard.reports.subtitle", "Analise indicadores e performance do seu atendimento")}
              </Typography>
            </div>
          </Box>
        </Paper>

        <Paper className={`${classes.filterBar} report-no-print`} elevation={0}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl size="small" fullWidth variant="outlined">
                <InputLabel>{i18n.t("dashboard.reports.filter.period", "Período")}</InputLabel>
                <Select
                  value={period}
                  onChange={(e) => setPeriod(Number(e.target.value))}
                  label={i18n.t("dashboard.reports.filter.period", "Período")}
                >
                  <MenuItem value={3}>{i18n.t("dashboard.reports.period.last3", "Últimos 3 dias")}</MenuItem>
                  <MenuItem value={7}>{i18n.t("dashboard.reports.period.last7", "Últimos 7 dias")}</MenuItem>
                  <MenuItem value={15}>{i18n.t("dashboard.reports.period.last15", "Últimos 15 dias")}</MenuItem>
                  <MenuItem value={30}>{i18n.t("dashboard.reports.period.last30", "Últimos 30 dias")}</MenuItem>
                  <MenuItem value={60}>{i18n.t("dashboard.reports.period.last60", "Últimos 60 dias")}</MenuItem>
                  <MenuItem value={90}>{i18n.t("dashboard.reports.period.last90", "Últimos 90 dias")}</MenuItem>
                  <MenuItem value={0}>{i18n.t("dashboard.reports.period.custom", "Personalizado")}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {period === 0 && (
              <>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    size="small"
                    type="date"
                    label={i18n.t("dashboard.reports.filter.from", "De")}
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    variant="outlined"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    size="small"
                    type="date"
                    label={i18n.t("dashboard.reports.filter.to", "Até")}
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    variant="outlined"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={fetchDashboardData}
                disabled={loading}
                fullWidth
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : i18n.t("dashboard.reports.filter.apply", "Atualizar")}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={2} style={{ marginBottom: 24 }} className="report-no-print">
          {reportCards.map((card) => (
            <Grid item xs={12} sm={6} md={3} key={card.id}>
              <Paper
                className={`${classes.reportCard} ${reportType === card.id ? classes.reportCardSelected : ""}`}
                elevation={0}
                onClick={() => setReportType(card.id)}
              >
                <div
                  className={classes.reportCardIcon}
                  style={{ backgroundColor: fade(card.color, 0.12), color: card.color }}
                >
                  {card.icon}
                </div>
                <Typography className={classes.reportCardTitle}>{card.title}</Typography>
                <Typography className={classes.reportCardDesc}>{card.desc}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {loading && reportType === REPORT_TYPES.RESUMO ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          renderReportContent()
        )}
      </div>

      <style>{`
        @media print {
          .report-no-print { display: none !important; }
          .report-print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            right: 0 !important;
            width: 100% !important;
            background: white !important;
            box-shadow: none !important;
            padding: 24px !important;
            z-index: 9999 !important;
          }
        }
      `}</style>
    </MainContainer>
  );
};

export default Reports;
