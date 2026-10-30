import React, { useCallback, useEffect, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import LinearProgress from "@material-ui/core/LinearProgress";
import Chip from "@material-ui/core/Chip";
import Tab from "@material-ui/core/Tab";
import Tooltip from "@material-ui/core/Tooltip";
import TextField from "@material-ui/core/TextField";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import TablePagination from "@material-ui/core/TablePagination";
import TableSortLabel from "@material-ui/core/TableSortLabel";
import { makeStyles } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import RefreshIcon from "@material-ui/icons/Refresh";
import PhonelinkOffIcon from "@material-ui/icons/PhonelinkOff";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import PlatformPageHeader from "./PlatformPageHeader";
import PlatformEvolutionMonitor, { REFRESH_MS, formatWhatsappNumber } from "./PlatformEvolutionMonitor";
import { REACT_TEXT_INTERPOLATION, formatDateTime } from "./EvolutionInfraPanel";
import {
  AppTabs,
  AppSectionCard,
  AppActionBar,
  AppSecondaryButton,
  AppEmptyState,
  AppLoadingState,
  AppTableContainer,
} from "../../ui";

export const WHATSAPP_MONITOR_PATH = "/saas/whatsapp-monitor";
export const MONITOR_TABS = ["overview", "baileys", "evolution"];
const ALL = "all";
const PROVIDERS = ["baileys", "evolution"];
const STATUSES = ["connected", "connecting", "unconfirmed", "disconnected"];
const STATUS_COLORS = {
  connected: "#2e7d32",
  connecting: "#ed6c02",
  unconfirmed: "#616161",
  disconnected: "#c62828",
};
const ROWS_PER_PAGE = [25, 50, 100];
const SEARCH_DEBOUNCE_MS = 400;

const useStyles = makeStyles((theme) => ({
  root: { display: "flex", flexDirection: "column", gap: theme.spacing(3), width: "100%" },
  kpiCard: {
    height: "100%",
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  kpiLabel: { fontSize: "0.8125rem", fontWeight: 500, color: theme.palette.text.secondary },
  kpiValue: { fontWeight: 700, fontSize: "1.75rem", lineHeight: 1.15, marginTop: theme.spacing(0.5) },
  filters: { display: "flex", flexWrap: "wrap", gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  filter: { minWidth: 200, [theme.breakpoints.down("xs")]: { minWidth: "100%" } },
  statusChip: { color: "#fff", fontWeight: 600 },
  mono: { fontFamily: "monospace", whiteSpace: "nowrap" },
  companyId: { display: "block", fontSize: "0.75rem", color: theme.palette.text.secondary },
  inactiveChip: { marginLeft: theme.spacing(1), height: 20, fontSize: "0.6875rem" },
}));

const t = (key, options) => i18n.t(`platform.whatsappMonitor.${key}`, { ...options, ...REACT_TEXT_INTERPOLATION });

/** Query string do endpoint; omite filtros "todos" e paginação 0-based → 1-based. */
export function buildMonitorParams({ provider, company, status, search, page, rowsPerPage, sortBy, sortDir }) {
  const params = { page: page + 1, pageSize: rowsPerPage, sortBy, sortDir };
  if (provider && provider !== ALL) params.provider = provider;
  if (company !== ALL) params.companyId = company;
  if (status !== ALL) params.status = status;
  if (search.trim()) params.search = search.trim();
  return params;
}

function Kpi({ label, value }) {
  const classes = useStyles();
  return (
    <Box className={classes.kpiCard}>
      <Typography className={classes.kpiLabel} component="div">
        {label}
      </Typography>
      <Typography className={classes.kpiValue} component="div">
        {value ?? "—"}
      </Typography>
    </Box>
  );
}

function StatusChip({ row }) {
  const classes = useStyles();
  const source =
    row.statusSource === "database"
      ? t("source.database", { status: row.persistedStatus || "—" })
      : t(`source.${row.statusSource}`);
  return (
    <Tooltip title={source}>
      <Chip
        size="small"
        className={classes.statusChip}
        style={{ backgroundColor: STATUS_COLORS[row.status] }}
        label={t(`status.${row.status}`)}
      />
    </Tooltip>
  );
}

/** Tabela + indicadores das conexões cadastradas. `fixedProvider` = aba Baileys. */
export function ConnectionsPanel({ fixedProvider }) {
  const classes = useStyles();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
  const [provider, setProvider] = useState(fixedProvider || ALL);
  const [company, setCompany] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE[0]);
  const [sortBy, setSortBy] = useState("company");
  const [sortDir, setSortDir] = useState("asc");
  const requestSeq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    // filtros mudam durante uma requisição: só a mais recente vale
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const { data: result } = await api.get("/system/whatsapp-monitor", {
        params: buildMonitorParams({ provider, company, status, search, page, rowsPerPage, sortBy, sortDir }),
      });
      if (seq !== requestSeq.current) return;
      setData(result);
      setRequestFailed(false);
    } catch (err) {
      if (seq === requestSeq.current) setRequestFailed(true);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [provider, company, status, search, page, rowsPerPage, sortBy, sortDir]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(0);
  };
  const changeSort = (field) => {
    setSortDir(sortBy === field && sortDir === "asc" ? "desc" : "asc");
    setSortBy(field);
    setPage(0);
  };

  const summary = data?.summary;
  const counters = fixedProvider ? summary?.byProvider?.[fixedProvider] : summary;
  const kpis = fixedProvider
    ? [
        ["total", counters?.total],
        ["connected", counters?.connected],
        ["disconnected", counters?.disconnected],
        ["connecting", counters?.connecting],
        ["unconfirmed", counters?.unconfirmed],
        ["companiesBaileys", counters?.companies],
      ]
    : [
        ["total", counters?.total],
        ["baileys", summary?.byProvider?.baileys?.total],
        ["evolution", summary?.byProvider?.evolution?.total],
        ["connected", counters?.connected],
        ["disconnected", counters?.disconnected],
        ["connecting", counters?.connecting],
        ["unconfirmed", counters?.unconfirmed],
        ["companies", counters?.companies],
        ["companiesWithActive", counters?.companiesWithActive],
      ];
  const rows = data?.connections?.rows || [];
  const evolution = summary?.evolution;
  const showProvider = !fixedProvider;

  // backend limita a página (ex.: filtro reduziu o total): acompanha para o seletor não ficar fora do intervalo
  // roda a cada resposta (só a mais recente é aplicada em `data`)
  useEffect(() => {
    const serverPage = data?.connections?.page;
    if (serverPage && serverPage - 1 !== page) setPage(serverPage - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const sortableHead = (field, label, hint) => (
    <TableCell sortDirection={sortBy === field ? sortDir : false}>
      <TableSortLabel
        active={sortBy === field}
        direction={sortBy === field ? sortDir : "asc"}
        onClick={() => changeSort(field)}
        title={hint}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box className={classes.root}>
      <AppActionBar>
        <Typography variant="body2" color="textSecondary">
          {t("lastUpdate")}: {formatDateTime(data?.generatedAt)}
        </Typography>
        <AppSecondaryButton startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          {loading ? t("refreshing") : t("refresh")}
        </AppSecondaryButton>
      </AppActionBar>
      {loading ? <LinearProgress aria-label={t("refreshing")} /> : null}

      {requestFailed ? <Alert severity="warning">{data ? t("requestFailed") : t("loadFailed")}</Alert> : null}
      {fixedProvider === "baileys" ? <Alert severity="info">{t("baileysStatusHint")}</Alert> : null}
      {!fixedProvider && evolution && evolution.apiStatus !== "online" ? (
        <Alert severity="info">{t("evolutionUnavailable")}</Alert>
      ) : null}
      {!fixedProvider && evolution?.orphans > 0 ? (
        <Alert severity="warning">{t("orphans", { count: evolution.orphans })}</Alert>
      ) : null}

      {!data && loading ? (
        <AppLoadingState message={t("loading")} />
      ) : data ? (
        <>
          <Grid container spacing={2}>
            {kpis.map(([key, value]) => (
              <Grid item xs={6} sm={4} md key={key}>
                <Kpi label={t(`kpi.${key}`)} value={value} />
              </Grid>
            ))}
          </Grid>

          <AppSectionCard>
            <Box className={classes.filters}>
              <FormControl variant="outlined" size="small" className={classes.filter}>
                <InputLabel id="wa-company">{t("filters.company")}</InputLabel>
                <Select labelId="wa-company" label={t("filters.company")} value={company} onChange={changeFilter(setCompany)}>
                  <MenuItem value={ALL}>{t("filters.all")}</MenuItem>
                  {(data.companies || []).map((c) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {c.name || `#${c.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {showProvider ? (
                <FormControl variant="outlined" size="small" className={classes.filter}>
                  <InputLabel id="wa-provider">{t("filters.provider")}</InputLabel>
                  <Select labelId="wa-provider" label={t("filters.provider")} value={provider} onChange={changeFilter(setProvider)}>
                    <MenuItem value={ALL}>{t("filters.all")}</MenuItem>
                    {PROVIDERS.map((p) => (
                      <MenuItem key={p} value={p}>
                        {t(`provider.${p}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
              <FormControl variant="outlined" size="small" className={classes.filter}>
                <InputLabel id="wa-status">{t("filters.status")}</InputLabel>
                <Select labelId="wa-status" label={t("filters.status")} value={status} onChange={changeFilter(setStatus)}>
                  <MenuItem value={ALL}>{t("filters.all")}</MenuItem>
                  {STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {t(`status.${s}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                variant="outlined"
                size="small"
                className={classes.filter}
                label={t("filters.search")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                inputProps={{ "aria-label": t("filters.search"), maxLength: 100 }}
              />
            </Box>

            {rows.length === 0 ? (
              <AppEmptyState icon={PhonelinkOffIcon} title={counters?.total ? t("emptyFiltered") : t(fixedProvider ? "emptyBaileys" : "empty")} />
            ) : (
              <>
                <AppTableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {sortableHead("company", t("columns.company"))}
                        {sortableHead("name", t("columns.name"))}
                        {showProvider ? sortableHead("provider", t("columns.provider")) : null}
                        {sortableHead("number", t("columns.number"))}
                        {sortableHead("status", t("columns.status"))}
                        {sortableHead("lastUpdate", t("columns.lastUpdate"), t("columns.lastUpdateHint"))}
                        {showProvider ? null : sortableHead("whatsappId", t("columns.whatsappId"))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.whatsappId}>
                          <TableCell>
                            {row.companyName || (
                              <Typography variant="body2" color="error" component="span">
                                {t("noCompany")}
                              </Typography>
                            )}
                            {row.companyActive === false ? (
                              <Chip size="small" variant="outlined" className={classes.inactiveChip} label={t("inactiveCompany")} />
                            ) : null}
                            {row.companyId != null ? (
                              <span className={classes.companyId}>{t("companyId", { id: row.companyId })}</span>
                            ) : null}
                          </TableCell>
                          <TableCell>{row.name || "—"}</TableCell>
                          {showProvider ? <TableCell>{t(`provider.${row.provider}`)}</TableCell> : null}
                          <TableCell className={classes.mono}>{formatWhatsappNumber(row.number)}</TableCell>
                          <TableCell>
                            <StatusChip row={row} />
                          </TableCell>
                          <TableCell>{formatDateTime(row.lastUpdate)}</TableCell>
                          {showProvider ? null : <TableCell className={classes.mono}>{row.whatsappId}</TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AppTableContainer>
                <TablePagination
                  component="div"
                  count={data.connections.total}
                  page={Math.max(0, data.connections.page - 1)}
                  rowsPerPage={rowsPerPage}
                  rowsPerPageOptions={ROWS_PER_PAGE}
                  onChangePage={(_e, next) => setPage(next)}
                  onChangeRowsPerPage={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  labelRowsPerPage={t("rowsPerPage")}
                  labelDisplayedRows={({ from, to, count }) => t("displayedRows", { from, to, count })}
                />
              </>
            )}
          </AppSectionCard>
        </>
      ) : null}
    </Box>
  );
}

export default function PlatformWhatsappMonitor() {
  const history = useHistory();
  const { tab: tabParam } = useParams();
  const tab = MONITOR_TABS.includes(tabParam) ? tabParam : MONITOR_TABS[0];

  return (
    <MainContainer>
      <Box display="flex" flexDirection="column" style={{ gap: 16 }} width="100%">
        <PlatformPageHeader titleKey="platform.whatsappMonitor.title" subtitleKey="platform.whatsappMonitor.subtitle" />
        <AppTabs
          value={tab}
          onChange={(_e, next) => history.push(`${WHATSAPP_MONITOR_PATH}/${next}`)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t("title")}
        >
          {MONITOR_TABS.map((key) => (
            <Tab key={key} value={key} label={t(`tabs.${key}`)} />
          ))}
        </AppTabs>
        {/* só a aba ativa é montada: cada uma faz o próprio polling */}
        {tab === "overview" ? <ConnectionsPanel key="overview" /> : null}
        {tab === "baileys" ? <ConnectionsPanel key="baileys" fixedProvider="baileys" /> : null}
        {tab === "evolution" ? <PlatformEvolutionMonitor embedded /> : null}
      </Box>
    </MainContainer>
  );
}
