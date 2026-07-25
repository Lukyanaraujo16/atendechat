import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Grid,
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
import AgentOsReadOnlyBanner from "../../components/AgentOsReadOnlyBanner";
import AgentOsIf from "../../components/AgentOsIf";
import useAgentOsConsolePermissions from "../../hooks/useAgentOsConsolePermissions";
import toastError from "../../errors/toastError";
import { toastAgentOsActionError } from "../../utils/agentOsActionError";
import {
  activateAgent,
  archiveAgent,
  createAgent,
  createCoordination,
  deactivateAgent,
  getMultiAgentConfig,
  getMultiAgentDashboard,
  getMultiAgentReplay,
  healthAgent,
  listAgents,
  listDelegations,
  listHandoffs,
  listRoutingDecisions,
  previewDelegation,
  previewHandoff,
  simulateDelegation,
  simulateFallback,
  simulateFullFlow,
  simulateHandoff,
  simulateMemoryPolicy,
  simulateRouting,
  suspendAgent,
  updateMultiAgentConfig,
} from "../../services/automationMultiAgentApi";

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

export default function AutomationMultiAgentPage() {
  const classes = useStyles();
  const { canManage, canReplay, readOnlyManage } = useAgentOsConsolePermissions();
  const [tab, setTab] = useState(0);
  const [dash, setDash] = useState(null);
  const [agents, setAgents] = useState([]);
  const [result, setResult] = useState(null);
  const [configJson, setConfigJson] = useState("");
  const [agentName, setAgentName] = useState("Agente Suporte");
  const [agentSlug, setAgentSlug] = useState("suporte");
  const [specialization, setSpecialization] = useState("SUPPORT");
  const [selectedId, setSelectedId] = useState("");
  const [targetId, setTargetId] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, a, cfg] = await Promise.all([
        getMultiAgentDashboard(),
        listAgents(),
        getMultiAgentConfig(),
      ]);
      setDash(d.data);
      const list = a.data?.agents || [];
      setAgents(list);
      setConfigJson(JSON.stringify(cfg.data?.config || {}, null, 2));
      if (!selectedId && list[0]) setSelectedId(list[0].id);
      if (!targetId && list[1]) setTargetId(list[1].id);
    } catch (err) {
      toastError(err);
    }
  }, [selectedId, targetId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn) => {
    try {
      const data = await fn();
      setResult(data?.data ?? data);
      await load();
    } catch (err) {
      toastAgentOsActionError(err);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Multi-Agent Runtime (V2.9)</Title>
      </MainHeader>

      <AgentOsReadOnlyBanner visible={readOnlyManage} />

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Kernel AgentOS compartilhado. Agentes = especializações configuráveis.
          Sem Live, sem autonomia contínua. live=
          {String(dash?.liveIntegrationEnabled)} coordinatorSim=
          {String(dash?.coordinatorSimulationOnly)} sharedKernel=
          {String(dash?.sharedKernel)}
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {[
          ["Agents", dash?.agents],
          ["Active", dash?.active],
          ["Healthy", dash?.healthy],
          ["Degraded", dash?.degraded],
          ["Routing", dash?.routingRequests],
          [
            "Routing OK",
            dash?.routingSuccessRate != null
              ? `${Math.round(dash.routingSuccessRate * 100)}%`
              : "—",
          ],
          ["Delegations", dash?.delegations],
          ["Handoffs", dash?.handoffs],
          ["Fallbacks", dash?.fallbacks],
          ["Human", dash?.humanInterventions],
          ["Loops", dash?.loopsBlocked],
          ["Conflicts", dash?.resultConflicts],
        ].map(([label, value]) => (
          <Grid item xs={6} sm={4} md={2} key={label}>
            <Metric label={label} value={value} classes={classes} />
          </Grid>
        ))}
      </Grid>

      <Paper className={classes.paper} variant="outlined" style={{ marginTop: 16 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
        >
          <Tab label="Agentes" />
          <Tab label="Routing / Selection" />
          <Tab label="Delegation / Handoff" />
          <Tab label="Coordinator / Tester" />
          <Tab label="Config" />
          <Tab label="Replay" />
        </Tabs>

        <Box mt={2}>
          {tab === 0 && (
            <>
              <Box className={classes.row}>
                <TextField
                  label="Nome"
                  size="small"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
                <TextField
                  label="Slug"
                  size="small"
                  value={agentSlug}
                  onChange={(e) => setAgentSlug(e.target.value)}
                />
                <TextField
                  label="Specialization"
                  size="small"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                />
                <AgentOsIf when={canManage}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() =>
                      run(() =>
                        createAgent({
                          name: agentName,
                          slug: agentSlug,
                          specialization,
                          role: "SPECIALIST",
                          status: "ACTIVE",
                          capabilities: ["SEARCH_CONTACT"],
                          allowedToolIds: ["tool_search"],
                          allowedMcpServerIds: ["mcp_demo"],
                          isDefault: agents.length === 0,
                        })
                      )
                    }
                  >
                    Criar
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!selectedId}
                    onClick={() => run(() => activateAgent(selectedId))}
                  >
                    Ativar
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!selectedId}
                    onClick={() => run(() => deactivateAgent(selectedId))}
                  >
                    Desativar
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!selectedId}
                    onClick={() => run(() => suspendAgent(selectedId))}
                  >
                    Suspender
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!selectedId}
                    onClick={() => run(() => archiveAgent(selectedId))}
                  >
                    Arquivar
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!selectedId}
                    onClick={() => run(() => healthAgent(selectedId))}
                  >
                    Health
                  </Button>
                </AgentOsIf>
              </Box>
              <Typography variant="subtitle2">Selecionado: {selectedId || "—"}</Typography>
              <Typography variant="subtitle2">Destino: {targetId || "—"}</Typography>
              <pre className={classes.mono}>
                {JSON.stringify(agents, null, 2)}
              </pre>
              <Box className={classes.row}>
                {agents.map((a) => (
                  <Button
                    key={a.id}
                    size="small"
                    variant={selectedId === a.id ? "contained" : "outlined"}
                    onClick={() => setSelectedId(a.id)}
                    onDoubleClick={() => setTargetId(a.id)}
                  >
                    {a.name} ({a.status})
                  </Button>
                ))}
              </Box>
            </>
          )}

          {tab === 1 && (
            <Box className={classes.row}>
              <AgentOsIf when={canManage}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() =>
                    run(() =>
                      simulateRouting({
                        sourceType: "ADMIN_SIMULATION",
                        requiredCapabilities: ["SEARCH_CONTACT"],
                        preferredSpecialization: "SUPPORT",
                        requestedAgentId: selectedId || undefined,
                      })
                    )
                  }
                >
                  Simular routing
                </Button>
              </AgentOsIf>
              <Button
                variant="outlined"
                onClick={() =>
                  run(() => listRoutingDecisions())
                }
              >
                Decisões
              </Button>
            </Box>
          )}

          {tab === 2 && (
            <Box className={classes.row}>
              <AgentOsIf when={canManage}>
                <Button
                  variant="outlined"
                  disabled={!selectedId || !targetId}
                  onClick={() =>
                    run(() =>
                      previewDelegation({
                        sourceAgentId: selectedId,
                        requestedTargetAgentId: targetId,
                        requiredCapabilities: ["SEARCH_CONTACT"],
                        task: "Buscar contato",
                        goal: "Suporte",
                      })
                    )
                  }
                >
                  Preview delegation
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={!selectedId || !targetId}
                  onClick={() =>
                    run(() =>
                      simulateDelegation({
                        sourceAgentId: selectedId,
                        requestedTargetAgentId: targetId,
                        requiredCapabilities: ["SEARCH_CONTACT"],
                        task: "Buscar contato",
                        goal: "Suporte",
                        approved: true,
                      })
                    )
                  }
                >
                  Simular delegation
                </Button>
                <Button
                  variant="outlined"
                  disabled={!selectedId || !targetId}
                  onClick={() =>
                    run(() =>
                      previewHandoff({
                        sourceAgentId: selectedId,
                        requestedTargetAgentId: targetId,
                        reason: "especialista",
                      })
                    )
                  }
                >
                  Preview handoff
                </Button>
                <Button
                  variant="contained"
                  disabled={!selectedId || !targetId}
                  onClick={() =>
                    run(() =>
                      simulateHandoff({
                        sourceAgentId: selectedId,
                        requestedTargetAgentId: targetId,
                        reason: "especialista",
                        approved: true,
                      })
                    )
                  }
                >
                  Simular handoff
                </Button>
              </AgentOsIf>
              <Button variant="outlined" onClick={() => run(() => listDelegations())}>
                Listar delegações
              </Button>
              <Button variant="outlined" onClick={() => run(() => listHandoffs())}>
                Listar handoffs
              </Button>
            </Box>
          )}

          {tab === 3 && (
            <AgentOsIf when={canManage}>
              <Box className={classes.row}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => run(() => simulateFullFlow({}))}
                >
                  Fluxo completo (sim)
                </Button>
                <Button
                  variant="outlined"
                  disabled={!selectedId}
                  onClick={() =>
                    run(() =>
                      createCoordination({
                        coordinatorAgentId: selectedId,
                        rootGoalId: "goal_demo",
                        tasks: [
                          {
                            title: "Vendas",
                            requiredCapabilities: ["SEARCH_CONTACT"],
                            preferredSpecialization: "SALES",
                          },
                          {
                            title: "Suporte",
                            requiredCapabilities: ["SEARCH_CONTACT"],
                            preferredSpecialization: "SUPPORT",
                          },
                        ],
                      })
                    )
                  }
                >
                  Coordination plan
                </Button>
                <Button
                  variant="outlined"
                  disabled={!selectedId}
                  onClick={() =>
                    run(() =>
                      simulateMemoryPolicy({
                        agentId: selectedId,
                        scope: "AGENT_PRIVATE",
                      })
                    )
                  }
                >
                  Memory policy
                </Button>
                <Button
                  variant="outlined"
                  onClick={() =>
                    run(() =>
                      simulateFallback({
                        preferredAgentId: selectedId || null,
                        capability: "SEARCH_CONTACT",
                      })
                    )
                  }
                >
                  Fallback
                </Button>
              </Box>
            </AgentOsIf>
          )}

          {tab === 4 && (
            <>
              <TextField
                fullWidth
                multiline
                rows={12}
                variant="outlined"
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                disabled={!canManage}
              />
              <Box className={classes.row} style={{ marginTop: 8 }}>
                <AgentOsIf when={canManage}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() =>
                      run(() =>
                        updateMultiAgentConfig(JSON.parse(configJson || "{}"))
                      )
                    }
                  >
                    Salvar config
                  </Button>
                </AgentOsIf>
              </Box>
            </>
          )}

          {tab === 5 && (
            <Box className={classes.row}>
              <AgentOsIf when={canReplay}>
                <Button
                  variant="contained"
                  disabled={!selectedId}
                  onClick={() => run(() => getMultiAgentReplay(selectedId))}
                >
                  Replay do agente selecionado
                </Button>
              </AgentOsIf>
            </Box>
          )}
        </Box>
      </Paper>

      {result && (
        <Paper className={classes.paper} variant="outlined">
          <Typography variant="subtitle1">Resultado</Typography>
          <pre className={classes.mono}>{JSON.stringify(result, null, 2)}</pre>
        </Paper>
      )}
    </MainContainer>
  );
}
