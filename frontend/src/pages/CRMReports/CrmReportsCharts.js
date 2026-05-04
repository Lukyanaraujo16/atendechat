import React, { useMemo } from "react";
import { useTheme } from "@material-ui/core/styles";
import { alpha } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  LineChart,
} from "recharts";
import { format, parseISO } from "date-fns";

import { i18n } from "../../translate/i18n";

function shortMoneyAxis(v) {
  if (v == null || Number.isNaN(Number(v))) return "";
  const n = Number(v);
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

export default function CrmReportsCharts({
  stages,
  bottlenecks,
  summary,
  timeline,
  terms,
  locale,
  formatMoney,
  formatAvgMs,
}) {
  const theme = useTheme();
  const isDark = theme.palette.type === "dark";
  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const gridStroke = alpha(isDark ? "#fff" : "#000", 0.12);
  const tooltipBg = isDark ? theme.palette.grey[800] : theme.palette.background.paper;
  const tooltipStyle = {
    backgroundColor: tooltipBg,
    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
    borderRadius: 8,
    color: textPrimary,
  };
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary?.main || theme.palette.primary.light;
  const wonColor = isDark ? "#81c784" : "#2e7d32";
  const lostColor = theme.palette.error.main;
  const createdLine = theme.palette.info?.main || "#29b6f6";

  const funnelData = useMemo(
    () =>
      (stages || []).map((s) => ({
        ...s,
        stageShort:
          String(s.stageName || "").length > 22
            ? `${String(s.stageName).slice(0, 20)}…`
            : String(s.stageName || "—"),
      })),
    [stages]
  );

  const wonLostPie = useMemo(() => {
    const w = summary?.wonCount ?? 0;
    const l = summary?.lostCount ?? 0;
    const rows = [];
    if (w > 0)
      rows.push({
        name: terms?.statusWon || i18n.t("crm.status.won"),
        value: w,
        key: "won",
      });
    if (l > 0)
      rows.push({
        name: terms?.statusLost || i18n.t("crm.status.lost"),
        value: l,
        key: "lost",
      });
    return rows;
  }, [summary, terms]);

  const timelineData = useMemo(() => {
    return (timeline || []).map((row) => ({
      ...row,
      label: row.date ? format(parseISO(`${row.date}T12:00:00.000Z`), "dd/MM", { locale }) : "",
    }));
  }, [timeline, locale]);

  const funnelBarsFill = alpha(primary, isDark ? 0.85 : 0.9);
  const funnelValueFill = alpha(secondary, isDark ? 0.65 : 0.55);

  return (
    <Grid container spacing={2} style={{ marginBottom: 24 }}>
      <Grid item xs={12}>
        <Paper
          elevation={0}
          style={{
            padding: theme.spacing(2),
            borderRadius: 12,
            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          }}
        >
          <Typography variant="subtitle1" style={{ fontWeight: 600, marginBottom: 8 }}>
            {i18n.t("crm.reports.chartFunnel")}
          </Typography>
          {funnelData.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("crm.reports.noDataPeriod")}
            </Typography>
          ) : (
            <Box style={{ width: "100%", height: 340 }}>
              <ResponsiveContainer>
                <ComposedChart data={funnelData} margin={{ top: 8, right: 8, left: 0, bottom: 64 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="stageShort"
                    tick={{ fill: textSecondary, fontSize: 11 }}
                    interval={0}
                    angle={-32}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: textSecondary, fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: textSecondary, fontSize: 11 }}
                    tickFormatter={shortMoneyAxis}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: textSecondary }}
                    formatter={(val, name) => {
                      if (name === i18n.t("crm.reports.chartFunnelValue")) {
                        return [formatMoney(val), name];
                      }
                      return [val, name];
                    }}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.stageName || ""
                    }
                  />
                  <Legend wrapperStyle={{ color: textSecondary, fontSize: 12 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="currentCount"
                    name={i18n.t("crm.reports.chartFunnelCount")}
                    fill={funnelBarsFill}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="currentValue"
                    name={i18n.t("crm.reports.chartFunnelValue")}
                    fill={funnelValueFill}
                    radius={[4, 4, 0, 0]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={5}>
        <Paper
          elevation={0}
          style={{
            padding: theme.spacing(2),
            borderRadius: 12,
            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
            height: "100%",
          }}
        >
          <Typography variant="subtitle1" style={{ fontWeight: 600, marginBottom: 4 }}>
            {i18n.t("crm.reports.chartWonLost")}
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block" paragraph>
            {i18n.t("crm.reports.chartWonLostHint")}
          </Typography>
          {wonLostPie.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("crm.reports.noDataPeriod")}
            </Typography>
          ) : (
            <Box style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={wonLostPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {wonLostPie.map((entry) => (
                      <Cell
                        key={entry.key}
                        fill={entry.key === "won" ? wonColor : lostColor}
                        stroke={alpha("#000", isDark ? 0.2 : 0.06)}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, i18n.t("crm.reports.chartCount")]} />
                  <Legend wrapperStyle={{ color: textSecondary, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={7}>
        <Paper
          elevation={0}
          style={{
            padding: theme.spacing(2),
            borderRadius: 12,
            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
            height: "100%",
          }}
        >
          <Typography variant="subtitle1" style={{ fontWeight: 600, marginBottom: 8 }}>
            {i18n.t("crm.reports.chartTimeline")}
          </Typography>
          {timelineData.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("crm.reports.noDataPeriod")}
            </Typography>
          ) : (
            <Box style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={timelineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: textSecondary, fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis tick={{ fill: textSecondary, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: textSecondary }} />
                  <Legend wrapperStyle={{ color: textSecondary, fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="created"
                    name={i18n.t("crm.reports.chartTimelineCreated")}
                    stroke={createdLine}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="won"
                    name={i18n.t("crm.reports.chartTimelineWon")}
                    stroke={wonColor}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="lost"
                    name={i18n.t("crm.reports.chartTimelineLost")}
                    stroke={lostColor}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper
          elevation={0}
          style={{
            padding: theme.spacing(2),
            borderRadius: 12,
            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          }}
        >
          <Typography variant="subtitle1" style={{ fontWeight: 600, marginBottom: 8 }}>
            {i18n.t("crm.reports.chartBottlenecks")}
          </Typography>
          {!bottlenecks?.length ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("crm.reports.noDataPeriod")}
            </Typography>
          ) : (
            <Box style={{ width: "100%", height: Math.min(420, 80 + bottlenecks.length * 36) }}>
              <ResponsiveContainer>
                <BarChart
                  layout="vertical"
                  data={[...bottlenecks].slice(0, 12)}
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis
                    type="number"
                    dataKey="avgDurationMs"
                    tick={{ fill: textSecondary, fontSize: 11 }}
                    tickFormatter={(ms) => {
                      const d = Number(ms) / 86400000;
                      if (d >= 1) return `${d.toFixed(1)}d`;
                      const h = Number(ms) / 3600000;
                      return `${h.toFixed(1)}h`;
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="stageName"
                    width={128}
                    tick={{ fill: textSecondary, fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(ms) => [formatAvgMs(ms), i18n.t("crm.reports.avgTime")]}
                    labelFormatter={(name) => name}
                  />
                  <Bar
                    dataKey="avgDurationMs"
                    name={i18n.t("crm.reports.chartBottleneckAxis")}
                    fill={alpha(primary, isDark ? 0.8 : 0.75)}
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}
