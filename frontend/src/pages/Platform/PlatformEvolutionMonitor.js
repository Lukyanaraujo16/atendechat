import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import LinearProgress from "@material-ui/core/LinearProgress";
import Chip from "@material-ui/core/Chip";
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
import { makeStyles } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import RefreshIcon from "@material-ui/icons/Refresh";
import PhonelinkOffIcon from "@material-ui/icons/PhonelinkOff";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { maskPhone } from "../../helpers/brMasks";
import PlatformPageHeader from "./PlatformPageHeader";
import { InfraSection, formatDateTime, formatDuration } from "./EvolutionInfraPanel";
import {
  AppSectionCard,
  AppActionBar,
  AppSecondaryButton,
  AppEmptyState,
  AppLoadingState,
  AppTableContainer,
} from "../../ui";

export const REFRESH_MS = 60000;
const ALL = "all";
const NO_COMPANY = "none";
const STATES = ["connected", "connecting", "disconnected"];
const STATE_COLORS = { connected: "#2e7d32", connecting: "#ed6c02", disconnected: "#c62828" };
const API_STATUS_COLORS = { online: STATE_COLORS.connected, offline: STATE_COLORS.disconnected };

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
  apiStatus: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    fontWeight: 600,
    fontSize: "1rem",
    lineHeight: 1.25,
    marginTop: theme.spacing(0.5),
  },
  apiDot: { width: 8, height: 8, borderRadius: "50%", backgroundColor: "currentColor", flexShrink: 0 },
  apiDetail: { fontSize: "0.75rem", lineHeight: 1.3, color: theme.palette.text.secondary },
  filters: { display: "flex", flexWrap: "wrap", gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  filter: { minWidth: 200 },
  stateChip: { color: "#fff", fontWeight: 600 },
  mono: { fontFamily: "monospace" },
}));

/** Número completo (endpoint exclusivo de Super Admin): BR → +55 (11) 98765-4321; demais → +DDI... */
export function formatWhatsappNumber(number) {
  const digits = String(number || "").replace(/\D/g, "");
  if (!digits) return "—";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return maskPhone(digits);
  return `+${digits}`;
}

export function filterInstances(instances, { company, state, search }) {
  const term = String(search || "").trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  return instances.filter((inst) => {
    if (company === NO_COMPANY && inst.companyId != null) return false;
    if (company !== ALL && company !== NO_COMPANY && String(inst.companyId) !== String(company)) return false;
    if (state !== ALL && inst.state !== state) return false;
    if (!term) return true;
    if (inst.instanceName.toLowerCase().includes(term)) return true;
    return Boolean(digits && inst.number && inst.number.includes(digits));
  });
}

function Kpi({ label, value }) {
  const classes = useStyles();
  return (
    <Box className={classes.kpiCard}>
      <Typography className={classes.kpiLabel} component="div">
        {label}
      </Typography>
      <Typography className={classes.kpiValue} component="div">
        {value}
      </Typography>
    </Box>
  );
}

function ApiStatusKpi({ label, apiInfo, uptimeSeconds, t }) {
  const classes = useStyles();
  const status = apiInfo?.status;
  const latency = status === "online" && apiInfo.latencyMs != null ? `${apiInfo.latencyMs} ms` : "—";
  const uptime = formatDuration(uptimeSeconds);
  return (
    <Box className={classes.kpiCard}>
      <Typography className={classes.kpiLabel} component="div">
        {label}
      </Typography>
      <Typography
        className={classes.apiStatus}
        component="div"
        style={{ color: API_STATUS_COLORS[status] }}
        color={API_STATUS_COLORS[status] ? undefined : "textSecondary"}
      >
        <span className={classes.apiDot} aria-hidden="true" />
        {t(`api.${status}`)}
      </Typography>
      <Typography className={classes.apiDetail} component="div">
        {t("apiLatency")}: {latency}
      </Typography>
      {/* Uptime do contêiner Evolution API (coletor); sem amostra recente → "—". */}
      <Typography className={classes.apiDetail} component="div">
        {t("apiUptime")}:{" "}
        {uptime || (
          <span title={t("infra.unavailable")} aria-label={t("infra.unavailable")}>
            —
          </span>
        )}
      </Typography>
    </Box>
  );
}

/** `embedded`: renderizado como aba da Central de Monitoramento WhatsApp (sem container/cabeçalho próprios). */
export default function PlatformEvolutionMonitor({ embedded = false }) {
  const classes = useStyles();
  const t = (key) => i18n.t(`platform.evolutionMonitor.${key}`);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
  const [company, setCompany] = useState(ALL);
  const [state, setState] = useState(ALL);
  const [search, setSearch] = useState("");
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const { data: snapshot } = await api.get("/system/evolution-monitor");
      setData(snapshot);
      setRequestFailed(false);
    } catch (err) {
      // mantém o último snapshot; aviso inline em vez de toast a cada 60s
      setRequestFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const instances = useMemo(() => data?.instances || [], [data]);
  const companies = useMemo(() => {
    const map = new Map();
    instances.forEach((inst) => {
      if (inst.companyId != null) map.set(inst.companyId, inst.companyName);
    });
    return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [instances]);
  const filtered = useMemo(
    () => filterInstances(instances, { company, state, search }),
    [instances, company, state, search]
  );

  const apiInfo = data?.api;
  const indicators = data?.indicators;
  const apiStatus = apiInfo?.status;

  const content = (
    <Box className={classes.root}>
      {embedded ? null : (
        <PlatformPageHeader
          titleKey="platform.evolutionMonitor.title"
          subtitleKey="platform.evolutionMonitor.subtitle"
        />
      )}

      <AppActionBar>
        <Typography variant="body2" color="textSecondary">
          {t("lastUpdate")}: {formatDateTime(data?.generatedAt)}
        </Typography>
        <AppSecondaryButton startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          {loading ? t("refreshing") : t("refresh")}
        </AppSecondaryButton>
      </AppActionBar>
      {loading ? <LinearProgress aria-label={t("refreshing")} /> : null}

      {requestFailed ? <Alert severity="warning">{t("requestFailed")}</Alert> : null}
      {apiStatus === "offline" ? (
        <Alert severity="error">
          {t("apiOffline")} ({apiInfo.errorCode})
        </Alert>
      ) : null}
      {apiStatus === "not_configured" ? <Alert severity="info">{t("apiNotConfigured")}</Alert> : null}

      {!data && loading ? (
        <AppLoadingState message={t("loading")} />
      ) : data ? (
        <>
          <Grid container spacing={2}>
            {[
              ["total", indicators.total],
              ["connected", indicators.connected],
              ["disconnected", indicators.disconnected],
              ["connecting", indicators.connecting],
              ["companies", indicators.companies],
              ["unlinked", indicators.unlinked],
            ].map(([key, value]) => (
              <Grid item xs={6} sm={4} md key={key}>
                <Kpi label={t(`kpi.${key}`)} value={value} />
              </Grid>
            ))}
            <Grid item xs={6} sm={4} md>
              <ApiStatusKpi
                label={t("kpi.apiStatus")}
                apiInfo={apiInfo}
                uptimeSeconds={data.infra?.services?.api?.uptimeSeconds}
                t={t}
              />
            </Grid>
          </Grid>

          <InfraSection infra={data.infra} apiInfo={apiInfo} refreshKey={data.generatedAt} />

          <AppSectionCard>
            <Box className={classes.filters}>
              <FormControl variant="outlined" size="small" className={classes.filter}>
                <InputLabel id="evo-company">{t("filters.company")}</InputLabel>
                <Select
                  labelId="evo-company"
                  label={t("filters.company")}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                >
                  <MenuItem value={ALL}>{t("filters.all")}</MenuItem>
                  <MenuItem value={NO_COMPANY}>{t("noCompany")}</MenuItem>
                  {companies.map(([id, name]) => (
                    <MenuItem key={id} value={String(id)}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl variant="outlined" size="small" className={classes.filter}>
                <InputLabel id="evo-state">{t("filters.state")}</InputLabel>
                <Select
                  labelId="evo-state"
                  label={t("filters.state")}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <MenuItem value={ALL}>{t("filters.all")}</MenuItem>
                  {STATES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {t(`states.${s}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                variant="outlined"
                size="small"
                className={classes.filter}
                label={t("filters.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputProps={{ "aria-label": t("filters.search") }}
              />
            </Box>

            {filtered.length === 0 ? (
              <AppEmptyState
                icon={PhonelinkOffIcon}
                title={instances.length === 0 ? t("empty") : t("emptyFiltered")}
              />
            ) : (
              <AppTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("columns.company")}</TableCell>
                      <TableCell>{t("columns.number")}</TableCell>
                      <TableCell>{t("columns.instance")}</TableCell>
                      <TableCell>{t("columns.state")}</TableCell>
                      <TableCell>{t("columns.lastUpdate")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((inst) => (
                      <TableRow key={inst.instanceName}>
                        <TableCell>
                          {inst.companyName || (
                            <Typography variant="body2" color="error" component="span">
                              {t("noCompany")}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell className={classes.mono}>{formatWhatsappNumber(inst.number)}</TableCell>
                        <TableCell className={classes.mono}>{inst.instanceName}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            className={classes.stateChip}
                            style={{ backgroundColor: STATE_COLORS[inst.state] }}
                            label={t(`states.${inst.state}`)}
                          />
                        </TableCell>
                        <TableCell>{formatDateTime(inst.lastUpdate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AppTableContainer>
            )}
          </AppSectionCard>
        </>
      ) : null}
    </Box>
  );
  return embedded ? content : <MainContainer>{content}</MainContainer>;
}
