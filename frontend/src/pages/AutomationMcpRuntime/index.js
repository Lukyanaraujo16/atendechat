import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Grid,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import {
  connectMcpServer,
  createMcpServer,
  executeMcpTool,
  getMcpConfig,
  getMcpDashboard,
  healthMcpServer,
  inspectMcpDispatch,
  listMcpExecutions,
  listMcpServers,
  listMcpTools,
  normalizeMcpResult,
  previewMcpTool,
  replayMcpRuntime,
  simulateMcpFallback,
  simulateMcpPolicy,
  syncMcpServer,
  updateMcpConfig,
} from "../../services/automationMcpApi";

const useStyles = makeStyles((theme) => ({
  paper: { padding: theme.spacing(2), marginBottom: theme.spacing(2) },
  card: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    height: "100%",
  },
  mono: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  row: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 },
}));

function Metric({ label, value, classes }) {
  return (
    <Box className={classes.card}>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="h6">{value ?? "—"}</Typography>
    </Box>
  );
}

export default function AutomationMcpRuntimePage() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [dash, setDash] = useState(null);
  const [servers, setServers] = useState([]);
  const [tools, setTools] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [serverName, setServerName] = useState("MCP Demo");
  const [endpoint, setEndpoint] = useState("https://mcp.example.com/mcp");
  const [selectedServerId, setSelectedServerId] = useState("");
  const [toolName, setToolName] = useState("search_customer");
  const [argsJson, setArgsJson] = useState('{"query":"ana"}');
  const [result, setResult] = useState(null);
  const [configJson, setConfigJson] = useState("");
  const [replayGoal, setReplayGoal] = useState("Buscar cliente ana");

  const load = useCallback(async () => {
    try {
      const [d, s, t, e, cfg] = await Promise.all([
        getMcpDashboard(),
        listMcpServers(),
        listMcpTools(),
        listMcpExecutions({ limit: 20 }),
        getMcpConfig(),
      ]);
      setDash(d.data);
      setServers(s.data?.servers || s.data || []);
      setTools(t.data?.tools || t.data || []);
      setExecutions(e.data?.executions || e.data || []);
      setConfigJson(JSON.stringify(cfg.data?.config || {}, null, 2));
      if (!selectedServerId && (s.data?.servers || s.data || [])[0]) {
        setSelectedServerId((s.data?.servers || s.data)[0].id);
      }
    } catch (err) {
      toastError(err);
    }
  }, [selectedServerId]);

  useEffect(() => {
    load();
  }, [load]);

  const parseArgs = () => {
    try {
      return JSON.parse(argsJson || "{}");
    } catch (e) {
      throw new Error("Args JSON inválido");
    }
  };

  const createServer = async () => {
    try {
      await createMcpServer({
        name: serverName,
        transportType: "STREAMABLE_HTTP",
        endpoint,
      });
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  const run = async (fn) => {
    try {
      const data = await fn();
      setResult(data?.data ?? data);
      await load();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>MCP Runtime (V2.7)</Title>
      </MainHeader>

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Model Context Protocol via Runtime Integration Layer. Admin / tester /
          simulator / replay — sem integração Live. Core Cognitivo permanece
          isolado. SDK: {dash?.sdk?.package}@{dash?.sdk?.version || "—"}
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={6} md={2}>
          <Metric label="Servers" value={dash?.servers} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric label="Healthy" value={dash?.healthy} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric label="Degraded" value={dash?.degraded} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric label="Unhealthy" value={dash?.unhealthy} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric label="Tools" value={dash?.tools} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric label="Read" value={dash?.readTools} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric label="Write" value={dash?.writeTools} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric label="Requests" value={dash?.requests} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric
            label="Success Rate"
            value={
              dash?.successRate != null
                ? `${Math.round(dash.successRate * 100)}%`
                : "—"
            }
            classes={classes}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric label="Failures" value={dash?.failures} classes={classes} />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric
            label="Latency"
            value={
              dash?.averageLatency != null
                ? `${Math.round(dash.averageLatency)}ms`
                : "—"
            }
            classes={classes}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <Metric
            label="Policy Denials"
            value={dash?.policyDenials}
            classes={classes}
          />
        </Grid>
      </Grid>

      <Paper className={classes.paper} variant="outlined" style={{ marginTop: 16 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
        >
          <Tab label="Servers" />
          <Tab label="Catalog" />
          <Tab label="Tester" />
          <Tab label="Policy / Fallback" />
          <Tab label="Executions" />
          <Tab label="Replay" />
          <Tab label="Config" />
        </Tabs>

        <Box style={{ marginTop: 16 }}>
          {tab === 0 && (
            <>
              <div className={classes.row}>
                <TextField
                  label="Name"
                  size="small"
                  variant="outlined"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                />
                <TextField
                  label="Endpoint"
                  size="small"
                  variant="outlined"
                  style={{ minWidth: 320 }}
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                />
                <Button variant="contained" color="primary" onClick={createServer}>
                  Create STREAMABLE_HTTP
                </Button>
              </div>
              <pre className={classes.mono}>
                {JSON.stringify(servers, null, 2)}
              </pre>
            </>
          )}

          {tab === 1 && (
            <pre className={classes.mono}>{JSON.stringify(tools, null, 2)}</pre>
          )}

          {tab === 2 && (
            <>
              <div className={classes.row}>
                <TextField
                  select
                  label="Server"
                  size="small"
                  variant="outlined"
                  style={{ minWidth: 220 }}
                  value={selectedServerId}
                  onChange={(e) => setSelectedServerId(e.target.value)}
                >
                  {servers.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Tool"
                  size="small"
                  variant="outlined"
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                />
              </div>
              <TextField
                label="Args JSON"
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                value={argsJson}
                onChange={(e) => setArgsJson(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <div className={classes.row}>
                <Button
                  variant="outlined"
                  onClick={() =>
                    run(() => connectMcpServer(selectedServerId))
                  }
                >
                  Connect
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => run(() => healthMcpServer(selectedServerId))}
                >
                  Health
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => run(() => syncMcpServer(selectedServerId))}
                >
                  Sync Catalog
                </Button>
                <Button
                  variant="outlined"
                  onClick={() =>
                    run(() =>
                      previewMcpTool({
                        serverId: selectedServerId,
                        toolName,
                        args: parseArgs(),
                      })
                    )
                  }
                >
                  Preview
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() =>
                    run(() =>
                      executeMcpTool({
                        serverId: selectedServerId,
                        toolName,
                        args: parseArgs(),
                        mode: "dry_run",
                      })
                    )
                  }
                >
                  Dry-run READ
                </Button>
                <Button
                  variant="contained"
                  onClick={() =>
                    run(() =>
                      executeMcpTool({
                        serverId: selectedServerId,
                        toolName,
                        args: parseArgs(),
                        mode: "execute",
                        confirmed: true,
                      })
                    )
                  }
                >
                  Execute (confirm)
                </Button>
              </div>
              <pre className={classes.mono}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </>
          )}

          {tab === 3 && (
            <>
              <div className={classes.row}>
                <Button
                  variant="outlined"
                  onClick={() =>
                    run(() =>
                      simulateMcpPolicy({
                        serverId: selectedServerId,
                        toolName,
                        args: parseArgs(),
                        mode: "execute",
                      })
                    )
                  }
                >
                  Policy Simulator
                </Button>
                <Button
                  variant="outlined"
                  onClick={() =>
                    run(() =>
                      simulateMcpFallback({
                        classification: "WRITE",
                        mcpStartedExecution: true,
                        mcpResultAmbiguous: true,
                      })
                    )
                  }
                >
                  Fallback Simulator
                </Button>
                <Button
                  variant="outlined"
                  onClick={() =>
                    run(() =>
                      normalizeMcpResult({
                        content: [{ type: "text", text: "ok" }],
                      })
                    )
                  }
                >
                  Result Normalizer
                </Button>
                <Button
                  variant="outlined"
                  onClick={() =>
                    run(() =>
                      inspectMcpDispatch({
                        actionType: "SEARCH",
                        objective: "customer ana",
                        metadata: { capability: "SEARCH_CUSTOMER" },
                      })
                    )
                  }
                >
                  Dispatch Inspector
                </Button>
              </div>
              <pre className={classes.mono}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </>
          )}

          {tab === 4 && (
            <pre className={classes.mono}>
              {JSON.stringify(executions, null, 2)}
            </pre>
          )}

          {tab === 5 && (
            <>
              <div className={classes.row}>
                <TextField
                  label="Goal"
                  size="small"
                  variant="outlined"
                  style={{ minWidth: 320 }}
                  value={replayGoal}
                  onChange={(e) => setReplayGoal(e.target.value)}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() =>
                    run(() =>
                      replayMcpRuntime({
                        goalText: replayGoal,
                        serverId: selectedServerId,
                        toolName,
                        args: parseArgs(),
                      })
                    )
                  }
                >
                  Replay MCP
                </Button>
              </div>
              <pre className={classes.mono}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </>
          )}

          {tab === 6 && (
            <>
              <TextField
                label="Config JSON"
                fullWidth
                multiline
                rows={12}
                variant="outlined"
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
              />
              <Button
                style={{ marginTop: 12 }}
                variant="contained"
                color="primary"
                onClick={() =>
                  run(async () => {
                    const config = JSON.parse(configJson);
                    return updateMcpConfig(config);
                  })
                }
              >
                Save Config
              </Button>
              <Typography
                variant="caption"
                color="textSecondary"
                display="block"
                style={{ marginTop: 8 }}
              >
                liveIntegrationEnabled sempre false nesta fase.
              </Typography>
            </>
          )}
        </Box>
      </Paper>
    </MainContainer>
  );
}
