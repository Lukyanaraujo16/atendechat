import React, { useState, useEffect } from "react";

import Paper from "@material-ui/core/Paper";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import FormHelperText from "@material-ui/core/FormHelperText";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";

import CallIcon from "@material-ui/icons/Call";
import GroupAddIcon from "@material-ui/icons/GroupAdd";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import AccessAlarmIcon from "@material-ui/icons/AccessAlarm";
import TimerIcon from "@material-ui/icons/Timer";

import { makeStyles } from "@material-ui/core/styles";
import { grey, blue } from "@material-ui/core/colors";
import { toast } from "react-toastify";

import ButtonWithSpinner from "../../components/ButtonWithSpinner";
import TableAttendantsStatus from "../../components/Dashboard/TableAttendantsStatus";
import { isArray } from "lodash";

import useDashboard from "../../hooks/useDashboard";
import useContacts from "../../hooks/useContacts";
import { ChatsUser } from "./ChartsUser";
import { isEmpty } from "lodash";
import moment from "moment";
import { ChartsDate } from "./ChartsDate";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.padding,
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(2),
  },
  fixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    height: 240,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  cardAvatar: {
    fontSize: "55px",
    color: grey[500],
    backgroundColor: "#ffffff",
    width: theme.spacing(7),
    height: theme.spacing(7),
  },
  cardTitle: {
    fontSize: "18px",
    color: blue[700],
  },
  cardSubtitle: {
    color: grey[600],
    fontSize: "14px",
  },
  alignRight: {
    textAlign: "right",
  },
  fullWidth: {
    width: "100%",
  },
  selectContainer: {
    width: "100%",
    textAlign: "left",
  },
  iframeDashboard: {
    width: "100%",
    height: "calc(100vh - 64px)",
    border: "none",
  },
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  fixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: 240,
  },
  customFixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: 120,
  },
  customFixedHeightPaperLg: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: "100%",
  },
  card1: {
    padding: theme.spacing(2.5),
    display: "flex",
    overflow: "hidden",
    flexDirection: "column",
    height: "100%",
    background:
      theme.palette.type === "light"
        ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
        : "linear-gradient(135deg, #1f2937, #111827)",
    color: "#f9fafb",
  },
  card2: {
    padding: theme.spacing(2.5),
    display: "flex",
    overflow: "hidden",
    flexDirection: "column",
    height: "100%",
    background:
      theme.palette.type === "light"
        ? "linear-gradient(135deg, #0ea5e9, #0369a1)"
        : "linear-gradient(135deg, #0f172a, #020617)",
    color: "#f9fafb",
  },
  card3: {
    padding: theme.spacing(2.5),
    display: "flex",
    overflow: "hidden",
    flexDirection: "column",
    height: "100%",
    background:
      theme.palette.type === "light"
        ? "linear-gradient(135deg, #22c55e, #16a34a)"
        : "linear-gradient(135deg, #064e3b, #022c22)",
    color: "#ecfdf5",
  },
  card4: {
    padding: theme.spacing(2.5),
    display: "flex",
    overflow: "hidden",
    flexDirection: "column",
    height: "100%",
    background:
      theme.palette.type === "light"
        ? "linear-gradient(135deg, #f97316, #ea580c)"
        : "linear-gradient(135deg, #7c2d12, #431407)",
    color: "#fffbeb",
  },
  card5: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: "100%",
    //backgroundColor: theme.palette.primary.main,
    backgroundColor: theme.palette.type === 'dark' ? theme.palette.boxticket.main : theme.palette.primary.main,
    color: "#eee",
  },
  card6: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: "100%",
    //backgroundColor: theme.palette.primary.main,
    backgroundColor: theme.palette.type === 'dark' ? theme.palette.boxticket.main : theme.palette.primary.main,
    color: "#eee",
  },
  card7: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: "100%",
    //backgroundColor: theme.palette.primary.main,
    backgroundColor: theme.palette.type === 'dark' ? theme.palette.boxticket.main : theme.palette.primary.main,
    color: "#eee",
  },
  card8: {
    padding: theme.spacing(2.5),
    display: "flex",
    overflow: "hidden",
    flexDirection: "column",
    height: "100%",
    background:
      theme.palette.type === "light"
        ? "linear-gradient(135deg, #06b6d4, #0891b2)"
        : "linear-gradient(135deg, #164e63, #083344)",
    color: "#ecfeff",
  },
  card9: {
    padding: theme.spacing(2.5),
    display: "flex",
    overflow: "hidden",
    flexDirection: "column",
    height: "100%",
    background:
      theme.palette.type === "light"
        ? "linear-gradient(135deg, #e11d48, #be123c)"
        : "linear-gradient(135deg, #4c0519, #881337)",
    color: "#ffe4e6",
  },
  fixedHeightPaper2: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
  },
  sectionTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    marginBottom: theme.spacing(2),
    color: theme.palette.text.primary,
  },
  filterBar: {
    padding: theme.spacing(2),
    borderRadius: 16,
    marginBottom: theme.spacing(3),
  },
}));

const Dashboard = () => {
  const classes = useStyles();
  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [period, setPeriod] = useState(0);
  const [filterType, setFilterType] = useState(1);
  const [dateFrom, setDateFrom] = useState(moment("1", "D").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const { find } = useDashboard();

  useEffect(() => {
    async function firstLoad() {
      await fetchData();
    }
    setTimeout(() => {
      firstLoad();
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
    async function handleChangePeriod(value) {
    setPeriod(value);
  }

  async function handleChangeFilterType(value) {
    setFilterType(value);
    if (value === 1) {
      setPeriod(0);
    } else {
      setDateFrom("");
      setDateTo("");
    }
  }

  async function fetchData() {
    setLoading(true);

    let params = {};

    if (period > 0) {
      params = {
        days: period,
      };
    }

    if (!isEmpty(dateFrom) && moment(dateFrom).isValid()) {
      params = {
        ...params,
        date_from: moment(dateFrom).format("YYYY-MM-DD"),
      };
    }

    if (!isEmpty(dateTo) && moment(dateTo).isValid()) {
      params = {
        ...params,
        date_to: moment(dateTo).format("YYYY-MM-DD"),
      };
    }

    if (Object.keys(params).length === 0) {
      toast.error(i18n.t("dashboard.toasts.selectFilterError"));
      setLoading(false);
      return;
    }

    const data = await find(params);

    setCounters(data.counters);
    if (isArray(data.attendants)) {
      setAttendants(data.attendants);
    } else {
      setAttendants([]);
    }

    setLoading(false);
  }

  function formatTime(minutes) {
    return moment()
      .startOf("day")
      .add(minutes, "minutes")
      .format("HH[h] mm[m]");
  }

    const GetContacts = (all) => {
    let props = {};
    if (all) {
      props = {};
    }
    const { count } = useContacts(props);
    return count;
  };
  
    function renderFilters() {
    if (filterType === 1) {
      return (
        <>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label={i18n.t("dashboard.filters.initialDate")}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={classes.fullWidth}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label={i18n.t("dashboard.filters.finalDate")}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={classes.fullWidth}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
        </>
      );
    } else {
      return (
        <Grid item xs={12} sm={6} md={4}>
          <FormControl className={classes.selectContainer}>
            <InputLabel id="period-selector-label">
              {i18n.t("dashboard.periodSelect.title")}
            </InputLabel>
            <Select
              labelId="period-selector-label"
              id="period-selector"
              value={period}
              onChange={(e) => handleChangePeriod(e.target.value)}
            >
              <MenuItem value={0}>{i18n.t("dashboard.periodSelect.options.none")}</MenuItem>
              <MenuItem value={3}>{i18n.t("dashboard.periodSelect.options.last3")}</MenuItem>
              <MenuItem value={7}>{i18n.t("dashboard.periodSelect.options.last7")}</MenuItem>
              <MenuItem value={15}>{i18n.t("dashboard.periodSelect.options.last15")}</MenuItem>
              <MenuItem value={30}>{i18n.t("dashboard.periodSelect.options.last30")}</MenuItem>
              <MenuItem value={60}>{i18n.t("dashboard.periodSelect.options.last60")}</MenuItem>
              <MenuItem value={90}>{i18n.t("dashboard.periodSelect.options.last90")}</MenuItem>
            </Select>
            <FormHelperText>{i18n.t("dashboard.periodSelect.helper")}</FormHelperText>
          </FormControl>
        </Grid>
      );
    }
  }

  return (
    <div>
      <Container maxWidth="lg" className={classes.container}>
        <Box mb={3}>
          <Typography variant="h5" style={{ fontWeight: 600 }} color="textPrimary" gutterBottom>
            {i18n.t("dashboard.title", "Dashboard")}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("dashboard.subtitle", "Visão geral dos atendimentos e indicadores")}
          </Typography>
        </Box>

        {/* Barra de filtros */}
        <Paper className={classes.filterBar} elevation={0} variant="outlined">
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <FormControl className={classes.selectContainer} size="small" fullWidth>
                <InputLabel id="filter-type-label">{i18n.t("dashboard.filters.filterType.title")}</InputLabel>
                <Select
                  labelId="filter-type-label"
                  value={filterType}
                  onChange={(e) => handleChangeFilterType(e.target.value)}
                >
                  <MenuItem value={1}>{i18n.t("dashboard.filters.filterType.options.perDate")}</MenuItem>
                  <MenuItem value={2}>{i18n.t("dashboard.filters.filterType.options.perPeriod")}</MenuItem>
                </Select>
                <FormHelperText>{i18n.t("dashboard.filters.filterType.helper")}</FormHelperText>
              </FormControl>
            </Grid>
            {renderFilters()}
            <Grid item xs={12} sm={6} md={2}>
              <ButtonWithSpinner
                loading={loading}
                onClick={() => fetchData()}
                variant="contained"
                color="primary"
                fullWidth
              >
                {i18n.t("dashboard.buttons.filter")}
              </ButtonWithSpinner>
            </Grid>
          </Grid>
        </Paper>

        <Grid container spacing={3}>
          {/* EM ATENDIMENTO */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              className={classes.card1}
              style={{ overflow: "hidden" }}
              elevation={4}
            >
              <Grid container spacing={3}>
                <Grid item xs={8}>
                  <Typography
                    component="h3"
                    variant="h6"
                    paragraph
                  >
                    {i18n.t("dashboard.counters.inTalk")}
                  </Typography>
                  <Grid item>
                    <Typography
                      component="h1"
                      variant="h4"
                    >
                      {counters.supportHappening}
                    </Typography>
                  </Grid>
                </Grid>
                <Grid item xs={2}>
                  <CallIcon
                    style={{
                      fontSize: 100,
                      color: "#FFFFFF",
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* AGUARDANDO */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              className={classes.card2}
              style={{ overflow: "hidden" }}
              elevation={6}
            >
              <Grid container spacing={3}>
                <Grid item xs={8}>
                  <Typography
                    component="h3"
                    variant="h6"
                    paragraph
                  >
                    {i18n.t("dashboard.counters.waiting")}
                  </Typography>
                  <Grid item>
                    <Typography
                      component="h1"
                      variant="h4"
                    >
                      {counters.supportPending}
                    </Typography>
                  </Grid>
                </Grid>
                <Grid item xs={4}>
                  <HourglassEmptyIcon
                    style={{
                      fontSize: 100,
                      color: "#FFFFFF",
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* ATENDENTES ATIVOS */}
			  {/*<Grid item xs={12} sm={6} md={4}>
            <Paper
              className={classes.card6}
              style={{ overflow: "hidden" }}
              elevation={6}
            >
              <Grid container spacing={3}>
                <Grid item xs={8}>
                  <Typography
                    component="h3"
                    variant="h6"
                    paragraph
                  >
                    Conversas Ativas
                  </Typography>
                  <Grid item>
                    <Typography
                      component="h1"
                      variant="h4"
                    >
                      {GetUsers()}
                      <span
                        style={{ color: "#805753" }}
                      >
                        /{attendants.length}
                      </span>
                    </Typography>
                  </Grid>
                </Grid>
                <Grid item xs={4}>
                  <RecordVoiceOverIcon
                    style={{
                      fontSize: 100,
                      color: "#805753",
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
</Grid>*/}

          {/* FINALIZADOS */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              className={classes.card3}
              style={{ overflow: "hidden" }}
              elevation={6}
            >
              <Grid container spacing={3}>
                <Grid item xs={8}>
                  <Typography
                    component="h3"
                    variant="h6"
                    paragraph
                  >
                    {i18n.t("dashboard.counters.finished")}
                  </Typography>
                  <Grid item>
                    <Typography
                      component="h1"
                      variant="h4"
                    >
                      {counters.supportFinished}
                    </Typography>
                  </Grid>
                </Grid>
                <Grid item xs={4}>
                  <CheckCircleIcon
                    style={{
                      fontSize: 100,
                      color: "#FFFFFF",
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* NOVOS CONTATOS */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              className={classes.card4}
              style={{ overflow: "hidden" }}
              elevation={6}
            >
              <Grid container spacing={3}>
                <Grid item xs={8}>
                  <Typography
                    component="h3"
                    variant="h6"
                    paragraph
                  >
                    {i18n.t("dashboard.counters.newContacts")}
                  </Typography>
                  <Grid item>
                    <Typography
                      component="h1"
                      variant="h4"
                    >
                      {GetContacts(true)}
                    </Typography>
                  </Grid>
                </Grid>
                <Grid item xs={4}>
                  <GroupAddIcon
                    style={{
                      fontSize: 100,
                      color: "#FFFFFF",
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          
          {/* T.M. DE ATENDIMENTO */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              className={classes.card8}
              style={{ overflow: "hidden" }}
              elevation={6}
            >
              <Grid container spacing={3}>
                <Grid item xs={8}>
                  <Typography
                    component="h3"
                    variant="h6"
                    paragraph
                  >
                    {i18n.t("dashboard.counters.averageTalkTime")}
                  </Typography>
                  <Grid item>
                    <Typography
                      component="h1"
                      variant="h4"
                    >
                      {formatTime(counters.avgSupportTime)}
                    </Typography>
                  </Grid>
                </Grid>
                <Grid item xs={4}>
                  <AccessAlarmIcon
                    style={{
                      fontSize: 100,
                      color: "#FFFFFF",
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* T.M. DE ESPERA */}
          <Grid item xs={12} sm={6} md={4}>
            <Paper
              className={classes.card9}
              style={{ overflow: "hidden" }}
              elevation={6}
            >
              <Grid container spacing={3}>
                <Grid item xs={8}>
                  <Typography
                    component="h3"
                    variant="h6"
                    paragraph
                  >
                    {i18n.t("dashboard.counters.averageWaitTime")}
                  </Typography>
                  <Grid item>
                    <Typography
                      component="h1"
                      variant="h4"
                    >
                      {formatTime(counters.avgWaitTime)}
                    </Typography>
                  </Grid>
                </Grid>
                <Grid item xs={4}>
                  <TimerIcon
                    style={{
                      fontSize: 100,
                      color: "#FFFFFF",
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
		  
          {/* USUARIOS ONLINE */}
          <Grid item xs={12}>
            <Typography className={classes.sectionTitle}>
              {i18n.t("dashboard.onlineTable.title", "Status dos atendentes")}
            </Typography>
            {attendants.length ? (
              <Paper elevation={0} variant="outlined" style={{ borderRadius: 16, overflow: "hidden" }}>
                <TableAttendantsStatus attendants={attendants} loading={loading} />
              </Paper>
            ) : null}
          </Grid>

          {/* TOTAL DE ATENDIMENTOS POR USUARIO */}
          <Grid item xs={12} md={6}>
            <ChatsUser />
          </Grid>

          {/* TOTAL DE ATENDIMENTOS */}
          <Grid item xs={12} md={6}>
            <ChartsDate />
          </Grid>

        </Grid>
      </Container >
    </div >
  );
};

export default Dashboard;
