import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import AgentOsReadOnlyBanner from "../../components/AgentOsReadOnlyBanner";
import AgentOsIf from "../../components/AgentOsIf";
import useAgentOsConsolePermissions from "../../hooks/useAgentOsConsolePermissions";
import { toastAgentOsActionError } from "../../utils/agentOsActionError";
import {
  getObservabilityDashboard,
  probeObservability,
  runObservabilityOps,
  exportObservability,
} from "../../services/automationObservabilityApi";

const useStyles = makeStyles((theme) => ({
  paper: { padding: theme.spacing(2), marginBottom: theme.spacing(2) },
  chip: { marginRight: theme.spacing(1) },
  mono: { fontFamily: "monospace", fontSize: 12 },
}));

function statusColor(status) {
  if (status === "Healthy") return "primary";
  if (status === "Degraded") return "default";
  if (status === "Critical") return "secondary";
  return "default";
}

const AutomationObservability = () => {
  const classes = useStyles();
  const { canManage, readOnlyManage } = useAgentOsConsolePermissions();
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getObservabilityDashboard();
      setDash(data);
    } catch (err) {
      toastAgentOsActionError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onProbe = async () => {
    try {
      const { data } = await probeObservability();
      toast.success(`Probe ok: ${data.traceId}`);
      load();
    } catch (err) {
      toastAgentOsActionError(err);
    }
  };

  const onHealthOp = async () => {
    try {
      await runObservabilityOps({ operation: "health_check" });
      toast.success("Health check executado");
      load();
    } catch (err) {
      toastAgentOsActionError(err);
    }
  };

  const onExportMetrics = async () => {
    try {
      const { data } = await exportObservability({
        kind: "metrics",
        format: "json",
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "agentos-metrics.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastAgentOsActionError(err);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>AgentOS Observability</Title>
        <Box>
          <Button color="primary" variant="outlined" onClick={load} style={{ marginRight: 8 }}>
            Atualizar
          </Button>
          <AgentOsIf when={canManage}>
            <Button color="primary" variant="outlined" onClick={onProbe} style={{ marginRight: 8 }}>
              Probe
            </Button>
          </AgentOsIf>
          <AgentOsIf when={canManage}>
            <Button color="primary" variant="outlined" onClick={onHealthOp} style={{ marginRight: 8 }}>
              Health check
            </Button>
          </AgentOsIf>
          <Button color="primary" variant="contained" onClick={onExportMetrics}>
            Export metrics
          </Button>
        </Box>
      </MainHeader>

      <AgentOsReadOnlyBanner visible={readOnlyManage} />

      {loading && !dash ? (
        <Paper className={classes.paper}>
          <Table>
            <TableBody>
              <TableRowSkeleton columns={4} />
            </TableBody>
          </Table>
        </Paper>
      ) : (
        <>
          <Paper className={classes.paper}>
            <Typography variant="h6" gutterBottom>
              Health
            </Typography>
            <Chip
              className={classes.chip}
              color={statusColor(dash?.health?.status)}
              label={dash?.health?.status || "Unknown"}
            />
            <Typography variant="body2" color="textSecondary">
              {dash?.health?.checkedAt}
            </Typography>
            <Grid container spacing={1} style={{ marginTop: 8 }}>
              {(dash?.health?.components || []).map((c) => (
                <Grid item key={c.component}>
                  <Chip
                    size="small"
                    className={classes.chip}
                    label={`${c.component}: ${c.status}`}
                    color={statusColor(c.status)}
                  />
                </Grid>
              ))}
            </Grid>
          </Paper>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper className={classes.paper}>
                <Typography variant="subtitle1">Latência</Typography>
                <Typography>avg: {dash?.latency?.average ?? 0} ms</Typography>
                <Typography>p95: {dash?.latency?.p95 ?? 0} ms</Typography>
                <Typography>p99: {dash?.latency?.p99 ?? 0} ms</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper className={classes.paper}>
                <Typography variant="subtitle1">Taxas</Typography>
                <Typography>
                  success: {((dash?.metrics?.successRate || 0) * 100).toFixed(1)}%
                </Typography>
                <Typography>
                  failure: {((dash?.metrics?.failureRate || 0) * 100).toFixed(1)}%
                </Typography>
                <Typography>throughput: {dash?.metrics?.throughput ?? 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper className={classes.paper}>
                <Typography variant="subtitle1">Operação</Typography>
                <Typography>
                  em andamento: {dash?.inProgressExecutions?.length ?? 0}
                </Typography>
                <Typography>
                  recentes: {dash?.recentExecutions?.length ?? 0}
                </Typography>
                <Typography>alertas: {dash?.alerts?.length ?? 0}</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Paper className={classes.paper}>
            <Typography variant="h6" gutterBottom>
              Top erros
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(dash?.topErrors || []).map((e) => (
                  <TableRow key={e.code}>
                    <TableCell className={classes.mono}>{e.code}</TableCell>
                    <TableCell>{e.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Paper className={classes.paper}>
            <Typography variant="h6" gutterBottom>
              Falhas recentes
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Trace</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Origin</TableCell>
                  <TableCell>Quando</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(dash?.failures || []).map((f) => (
                  <TableRow key={f.eventId}>
                    <TableCell className={classes.mono}>{f.traceId}</TableCell>
                    <TableCell>{f.type}</TableCell>
                    <TableCell>{f.origin}</TableCell>
                    <TableCell>{f.timestamp}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </MainContainer>
  );
};

export default AutomationObservability;
