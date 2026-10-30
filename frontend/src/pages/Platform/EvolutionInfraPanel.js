import React, { useEffect, useMemo, useState } from "react";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { makeStyles, useTheme, alpha } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { AppSectionCard } from "../../ui";

// Só texto renderizado pelo React (que já escapa): sem isso o i18next troca "/" por "&#x2F;" nas datas.
export const REACT_TEXT_INTERPOLATION = { interpolation: { escapeValue: false } };
const t = (key, opts) => i18n.t(`platform.evolutionMonitor.infra.${key}`, { ...opts, ...REACT_TEXT_INTERPOLATION });

const HEALTH_COLORS = { ok: "#2e7d32", warn: "#ed6c02", error: "#c62828", unknown: "#9e9e9e" };

const useStyles = makeStyles((theme) => ({
  card: {
    height: "100%",
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    minWidth: 0,
  },
  label: { fontSize: "0.8125rem", fontWeight: 500, color: theme.palette.text.secondary },
  value: { fontWeight: 700, fontSize: "1.75rem", lineHeight: 1.15, marginTop: theme.spacing(0.5) },
  detail: {
    fontSize: "0.75rem",
    lineHeight: 1.3,
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sectionTitle: { fontWeight: 600, fontSize: "1rem", marginBottom: theme.spacing(1.5) },
  healthStatus: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    fontWeight: 600,
    fontSize: "1rem",
    lineHeight: 1.25,
    marginTop: theme.spacing(0.5),
  },
  dot: { width: 8, height: 8, borderRadius: "50%", backgroundColor: "currentColor", flexShrink: 0 },
  historyHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  chartTitle: { fontSize: "0.875rem", fontWeight: 600, marginBottom: theme.spacing(1) },
  chartBox: { width: "100%", height: 240 },
}));

// ------------------------------------------------------------------ formatação

export function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const digits = value >= 100 || i === 0 ? 0 : 1;
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: digits })} ${units[i]}`;
}

/** 693000 → "8d 0h"; 4500 → "1h 15min"; 59 → "59s". */
export function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds)) || seconds < 0) return null;
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

export const formatPercent = (v) =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** ISO (UTC) → "19/10/2026, 07:59:56" no fuso do navegador. Ausente/inválida/epoch → null. */
export function parseDisplayDate(value) {
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() <= 0 ? null : date;
}

export function formatDateTime(value, options) {
  const date = parseDisplayDate(value);
  return date ? date.toLocaleString("pt-BR", options) : "—";
}

/** "Boot: 19/10/2026, 07:59:56" — sem data válida não mostra o rótulo vazio. */
const dateDetail = (key, value) => (parseDisplayDate(value) ? t(key, { date: formatDateTime(value) }) : null);

// --------------------------------------------------------------------- saúde

/** Estado exibido de cada serviço. Coletor desatualizado ⇒ não afirmamos que algo está ok. */
export function serviceHealth(service, collectorStatus, apiStatus) {
  if (collectorStatus === "stale") return { level: "unknown", key: "stale" };
  if (!service) return { level: "unknown", key: "notMonitored" };
  if (!service.running) return { level: "error", key: "stopped" };
  if (service.state === "restarting") return { level: "warn", key: "restarting" };
  if (service.health === "unhealthy") return { level: "error", key: "unhealthy" };
  if (service.health === "starting") return { level: "warn", key: "starting" };
  if (apiStatus === undefined) return { level: "ok", key: "running" }; // só o contêiner é observado
  if (apiStatus !== "online") return { level: "error", key: "noResponse" };
  return { level: "ok", key: "operational" }; // contêiner em execução + API respondeu
}

export function collectorHealth(collector) {
  switch (collector?.status) {
    case "online":
      return { level: "ok", key: "operational" };
    case "stale":
      return { level: "warn", key: "stale" };
    case "no_data":
      return { level: "unknown", key: "noData" };
    default:
      return { level: "unknown", key: "notConfigured" };
  }
}

// --------------------------------------------------------------------- cards

function MetricCard({ label, value, detail, title }) {
  const classes = useStyles();
  return (
    <Box className={classes.card}>
      <Typography className={classes.label} component="div">
        {label}
      </Typography>
      <Typography className={classes.value} component="div" title={title}>
        {value}
      </Typography>
      <Typography className={classes.detail} component="div" title={typeof detail === "string" ? detail : undefined}>
        {detail || " "}
      </Typography>
    </Box>
  );
}

function HealthCard({ label, health, detail }) {
  const classes = useStyles();
  return (
    <Box className={classes.card}>
      <Typography className={classes.label} component="div">
        {label}
      </Typography>
      <Typography
        className={classes.healthStatus}
        component="div"
        style={{ color: HEALTH_COLORS[health.level] }}
        data-testid={`health-${label}`}
      >
        <span className={classes.dot} aria-hidden="true" />
        {t(`health.${health.key}`)}
      </Typography>
      <Typography className={classes.detail} component="div" title={detail || undefined}>
        {detail || " "}
      </Typography>
    </Box>
  );
}

export function InfraKpis({ infra }) {
  const host = infra?.host;
  const evo = infra?.services?.api;
  const unavailable = t("unavailable");
  const cards = [
    {
      key: "hostCpu",
      value: formatPercent(host?.cpuPercent),
      detail: host
        ? t("cpuDetail", {
            cores: host.cpuCores,
            load: (host.loadAverage || []).map((v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "—")).join(" · "),
          })
        : null,
    },
    {
      key: "hostRam",
      value: formatPercent(host?.memory.usedPercent),
      detail: host
        ? t("usedOf", { used: formatBytes(host.memory.usedBytes), total: formatBytes(host.memory.totalBytes) })
        : null,
    },
    {
      key: "hostDisk",
      value: formatPercent(host?.disk.usedPercent),
      detail: host ? t("available", { value: formatBytes(host.disk.availableBytes) }) : null,
    },
    {
      key: "hostUptime",
      value: formatDuration(host?.uptimeSeconds) || "—",
      detail: host ? dateDetail("bootAt", host.bootAt) : null,
    },
    {
      key: "evoCpu",
      value: formatPercent(evo?.cpuPercent),
      detail: evo ? t("ofVps") : null,
    },
    {
      key: "evoRam",
      value: formatBytes(evo?.memBytes),
      detail:
        evo && evo.memBytes != null && host
          ? t("ofVpsRam", { value: formatPercent((evo.memBytes / host.memory.totalBytes) * 100) })
          : null,
    },
    {
      key: "evoUptime",
      value: formatDuration(evo?.uptimeSeconds) || "—",
      detail: dateDetail("since", evo?.startedAt),
    },
    {
      key: "restarts",
      value: evo?.restartCount != null ? String(evo.restartCount) : "—",
      detail: evo ? t("restartsDetail") : null,
    },
  ];
  return (
    <Grid container spacing={2}>
      {cards.map((card) => (
        <Grid item xs={6} sm={4} md={3} key={card.key}>
          <MetricCard
            label={t(`kpi.${card.key}`)}
            value={card.value}
            detail={card.detail}
            title={card.value === "—" ? unavailable : undefined}
          />
        </Grid>
      ))}
    </Grid>
  );
}

export function InfraHealth({ infra, apiInfo }) {
  const collector = infra?.collector;
  const services = infra?.services || {};
  const status = collector?.status;
  const containerDetail = (svc) => {
    if (!svc) return null;
    if (!svc.running) return t("state", { state: svc.state });
    return dateDetail("since", svc.startedAt);
  };
  const apiVersion = apiInfo?.version ? `v${String(apiInfo.version).replace(/^v/, "")}` : null;
  const apiDetail = [apiVersion, containerDetail(services.api)].filter(Boolean).join(" · ");
  const collectorDetail =
    status === "online" || status === "stale"
      ? dateDetail("lastCollect", collector.lastCollectedAt)
      : status === "no_data"
      ? t("waitingFirst")
      : t("notConfiguredDetail");

  const items = [
    { key: "api", health: serviceHealth(services.api, status, apiInfo?.status), detail: apiDetail },
    { key: "postgres", health: serviceHealth(services.postgres, status), detail: containerDetail(services.postgres) },
    { key: "redis", health: serviceHealth(services.redis, status), detail: containerDetail(services.redis) },
    { key: "collector", health: collectorHealth(collector), detail: collectorDetail },
  ];
  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid item xs={6} md={3} key={item.key}>
          <HealthCard label={t(`services.${item.key}`)} health={item.health} detail={item.detail} />
        </Grid>
      ))}
    </Grid>
  );
}

// ------------------------------------------------------------------- gráficos

export function InfraHistory({ refreshKey, memTotalBytes }) {
  const classes = useStyles();
  const theme = useTheme();
  const [range, setRange] = useState("24h");
  const [history, setHistory] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get("/system/evolution-monitor/history", { params: { range } })
      .then(({ data }) => {
        if (!active) return;
        setHistory(data);
        setFailed(false);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [range, refreshKey]);

  const points = useMemo(
    () =>
      (history?.range === range ? history.points : []).map((p) => ({
        ...p,
        ts: new Date(p.t).getTime(),
        apiMemPercent:
          p.apiMemBytes != null && memTotalBytes ? Math.round((p.apiMemBytes / memTotalBytes) * 1000) / 10 : null,
      })),
    [history, range, memTotalBytes]
  );

  const tickFormat = (ts) => {
    const d = new Date(ts);
    return range === "24h"
      ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };
  const grid = alpha(theme.palette.type === "dark" ? "#fff" : "#000", 0.1);
  const tooltipStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    color: theme.palette.text.primary,
  };
  const vpsColor = theme.palette.primary.main;
  const evoColor = "#2e7d32";
  const hasData = points.some((p) => p.samples > 0);
  const firstAt = hasData ? points.find((p) => p.samples > 0).t : null;
  const partial = hasData && history && new Date(firstAt) > new Date(history.since).getTime() + 3600000;

  const chart = (title, lines) => (
    <Box>
      <Typography className={classes.chartTitle} component="div">
        {title}
      </Typography>
      <Box className={classes.chartBox}>
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={grid} vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={tickFormat}
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              minTickGap={24}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              width={52}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(ts) => formatDateTime(ts)}
              formatter={(value, name, item) =>
                item.dataKey === "apiMemPercent" && item.payload.apiMemBytes != null
                  ? [`${formatPercent(value)} (${formatBytes(item.payload.apiMemBytes)})`, name]
                  : [formatPercent(value), name]
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {lines.map(([key, name, color]) => (
              <Line
                key={key}
                dataKey={key}
                name={name}
                stroke={color}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );

  return (
    <AppSectionCard>
      <Box className={classes.historyHeader}>
        <Typography className={classes.sectionTitle} component="h2" style={{ marginBottom: 0 }}>
          {t("history.title")}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={range}
          onChange={(_e, value) => value && setRange(value)}
          aria-label={t("history.range")}
        >
          <ToggleButton value="24h">{t("history.24h")}</ToggleButton>
          <ToggleButton value="7d">{t("history.7d")}</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {failed ? <Alert severity="warning">{t("history.failed")}</Alert> : null}
      {!hasData ? (
        <Typography variant="body2" color="textSecondary">
          {t("history.empty")}
        </Typography>
      ) : (
        <>
          {partial ? (
            <Typography variant="caption" color="textSecondary" component="div" style={{ marginBottom: 8 }}>
              {t("history.partial", { date: formatDateTime(firstAt) })}
            </Typography>
          ) : null}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              {chart(t("history.cpu"), [
                ["hostCpuPercent", t("history.vps"), vpsColor],
                ["apiCpuPercent", t("history.evolution"), evoColor],
              ])}
            </Grid>
            <Grid item xs={12} md={6}>
              {chart(t("history.ram"), [
                ["hostMemPercent", t("history.vps"), vpsColor],
                ["apiMemPercent", t("history.evolution"), evoColor],
              ])}
            </Grid>
          </Grid>
        </>
      )}
    </AppSectionCard>
  );
}

export function InfraSection({ infra, apiInfo, refreshKey }) {
  const classes = useStyles();
  const status = infra?.collector?.status;
  return (
    <>
      <Box>
        <Typography className={classes.sectionTitle} component="h2">
          {t("title")}
        </Typography>
        {status === "stale" ? (
          <Alert severity="warning" style={{ marginBottom: 16 }}>
            {t("staleAlert", { date: formatDateTime(infra.collector.lastCollectedAt) })}
          </Alert>
        ) : null}
        {status === "no_data" || status === "not_configured" ? (
          <Alert severity="info" style={{ marginBottom: 16 }}>
            {t(status === "no_data" ? "noDataAlert" : "notConfiguredAlert")}
          </Alert>
        ) : null}
        <InfraKpis infra={infra} />
      </Box>
      <Box>
        <Typography className={classes.sectionTitle} component="h2">
          {t("healthTitle")}
        </Typography>
        <InfraHealth infra={infra} apiInfo={apiInfo} />
      </Box>
      <InfraHistory refreshKey={refreshKey} memTotalBytes={infra?.host?.memory?.totalBytes} />
    </>
  );
}
