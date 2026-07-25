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
  analyzeLearning,
  approveLearningCandidate,
  evaluateLearningCandidate,
  getLearningConfig,
  getLearningDashboard,
  getLearningReplay,
  listLearningArtifacts,
  listLearningCandidates,
  listLearningGuidance,
  listLearningPatterns,
  promoteLearningCandidate,
  rejectLearningCandidate,
  rollbackLearningArtifact,
  runLearningShadow,
  simulateLearningConflicts,
  simulateLearningDecay,
  simulateLearningPromotion,
  simulateLearningQuality,
  updateLearningConfig,
} from "../../services/automationLearningApi";

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

const DEMO_SAMPLES = [
  {
    sessionId: "s1",
    executionId: "e1",
    capability: "SEARCH_CONTACT",
    runtimeType: "MCP",
    status: "failure",
    errorCode: "ERR_MCP_TIMEOUT",
    recovery: true,
    latencyMs: 6000,
    timestamp: new Date().toISOString(),
  },
  {
    sessionId: "s2",
    executionId: "e2",
    capability: "SEARCH_CONTACT",
    runtimeType: "MCP",
    status: "failure",
    errorCode: "ERR_MCP_TIMEOUT",
    fallbackUsed: true,
    timestamp: new Date().toISOString(),
  },
  {
    sessionId: "s3",
    executionId: "e3",
    capability: "SEARCH_CONTACT",
    runtimeType: "TOOL_RUNTIME",
    status: "success",
    strategy: "search_then_validate",
    timestamp: new Date().toISOString(),
  },
  {
    sessionId: "s4",
    executionId: "e4",
    capability: "SEARCH_CONTACT",
    runtimeType: "MCP",
    status: "failure",
    errorCode: "ERR_MCP_TIMEOUT",
    replan: true,
    humanIntervention: true,
    timestamp: new Date().toISOString(),
  },
  {
    sessionId: "s5",
    executionId: "e5",
    capability: "SEARCH_CONTACT",
    runtimeType: "TOOL_RUNTIME",
    status: "success",
    strategy: "search_then_validate",
    timestamp: new Date().toISOString(),
  },
];

export default function AutomationLearningEnginePage() {
  const classes = useStyles();
  const { canManage, canReplay, readOnlyManage } = useAgentOsConsolePermissions();
  const [tab, setTab] = useState(0);
  const [dash, setDash] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [result, setResult] = useState(null);
  const [configJson, setConfigJson] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const load = useCallback(async () => {
    try {
      const [d, c, p, a, cfg] = await Promise.all([
        getLearningDashboard(),
        listLearningCandidates(),
        listLearningPatterns(),
        listLearningArtifacts(),
        getLearningConfig(),
      ]);
      setDash(d.data);
      setCandidates(c.data?.candidates || []);
      setPatterns(p.data?.patterns || []);
      setArtifacts(a.data?.artifacts || []);
      setConfigJson(JSON.stringify(cfg.data?.config || {}, null, 2));
      if (!selectedId && (c.data?.candidates || [])[0]) {
        setSelectedId(c.data.candidates[0].id);
      }
    } catch (err) {
      toastError(err);
    }
  }, [selectedId]);

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
        <Title>Learning Engine (V2.8)</Title>
      </MainHeader>

      <AgentOsReadOnlyBanner visible={readOnlyManage} />

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Observar → Analisar → Candidato → Avaliar → Aprovar → Promover (shadow)
          → Monitorar. Sem Live, sem auto-promotion, sem alteração de
          Planner/Runtime real. autoPromotion=
          {String(dash?.autoPromotionEnabled)} live=
          {String(dash?.liveIntegrationEnabled)}
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {[
          ["Analyses", dash?.analyses],
          ["Patterns", dash?.patterns],
          ["Candidates", dash?.candidates],
          ["Ready", dash?.readyForReview],
          ["Approved", dash?.approved],
          ["Promoted", dash?.promoted],
          ["Rejected", dash?.rejected],
          ["Rollbacks", dash?.rollbacks],
          ["Conflicts", dash?.conflicts],
          [
            "Confidence",
            dash?.averageConfidence != null
              ? dash.averageConfidence.toFixed(2)
              : "—",
          ],
          [
            "Quality",
            dash?.dataQuality != null ? dash.dataQuality.toFixed(2) : "—",
          ],
          ["Shadow Δ", dash?.shadowImprovements],
        ].map(([label, value]) => (
          <Grid item xs={6} md={2} key={label}>
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
          <Tab label="Analyze" />
          <Tab label="Patterns" />
          <Tab label="Candidates" />
          <Tab label="Shadow / Promote" />
          <Tab label="Artifacts" />
          <Tab label="Tester" />
          <Tab label="Config" />
        </Tabs>

        <Box style={{ marginTop: 16 }}>
          {tab === 0 && (
            <>
              <AgentOsIf when={canManage}>
                <div className={classes.row}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() =>
                      run(() =>
                        analyzeLearning({
                          mode: "MANUAL",
                          scopeType: "TENANT",
                          scopeId: "demo",
                          samples: DEMO_SAMPLES,
                        })
                      )
                    }
                  >
                    Run Manual Analysis
                  </Button>
                </div>
              </AgentOsIf>
              <pre className={classes.mono}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </>
          )}

          {tab === 1 && (
            <pre className={classes.mono}>
              {JSON.stringify(patterns, null, 2)}
            </pre>
          )}

          {tab === 2 && (
            <>
              <TextField
                label="Candidate ID"
                size="small"
                variant="outlined"
                fullWidth
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <div className={classes.row}>
                <AgentOsIf when={canManage}>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      run(() => evaluateLearningCandidate(selectedId))
                    }
                  >
                    Evaluate
                  </Button>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() =>
                      run(() => approveLearningCandidate(selectedId))
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      run(() => rejectLearningCandidate(selectedId, "tester"))
                    }
                  >
                    Reject
                  </Button>
                </AgentOsIf>
              </div>
              <pre className={classes.mono}>
                {JSON.stringify(candidates, null, 2)}
              </pre>
            </>
          )}

          {tab === 3 && (
            <>
              <div className={classes.row}>
                <AgentOsIf when={canManage}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() =>
                      run(() => promoteLearningCandidate(selectedId, "SHADOW"))
                    }
                  >
                    Promote Shadow
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      run(() =>
                        runLearningShadow({
                          candidateId: selectedId,
                          sourceExecutionId: "e1",
                          originalDecision: { runtimeType: "MCP" },
                        })
                      )
                    }
                  >
                    Shadow Compare
                  </Button>
                </AgentOsIf>
                <AgentOsIf when={canReplay}>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      run(() => getLearningReplay(selectedId))
                    }
                  >
                    Replay
                  </Button>
                </AgentOsIf>
              </div>
              <pre className={classes.mono}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </>
          )}

          {tab === 4 && (
            <>
              <AgentOsIf when={canManage}>
                <div className={classes.row}>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      run(() =>
                        rollbackLearningArtifact(
                          artifacts[0]?.id,
                          "tester rollback"
                        )
                      )
                    }
                  >
                    Rollback first artifact
                  </Button>
                </div>
              </AgentOsIf>
              <pre className={classes.mono}>
                {JSON.stringify(artifacts, null, 2)}
              </pre>
            </>
          )}

          {tab === 5 && (
            <>
              <AgentOsIf when={canManage}>
                <div className={classes.row}>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      run(() =>
                        simulateLearningQuality({
                          sampleSize: 2,
                          successCount: 1,
                          failureCount: 1,
                          evidence: [],
                          uniqueSessions: 1,
                          uniqueCapabilities: 1,
                        })
                      )
                    }
                  >
                    Quality (insufficient)
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      run(() =>
                        simulateLearningConflicts({ candidateId: selectedId })
                      )
                    }
                  >
                    Conflicts
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      run(() =>
                        simulateLearningPromotion({
                          candidateId: selectedId,
                          requestedMode: "SHADOW",
                        })
                      )
                    }
                  >
                    Promotion Policy
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() =>
                      run(() =>
                        simulateLearningDecay({ candidateId: selectedId })
                      )
                    }
                  >
                    Decay
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => run(() => listLearningGuidance())}
                  >
                    Guidance Preview
                  </Button>
                </div>
              </AgentOsIf>
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
                rows={14}
                variant="outlined"
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                disabled={!canManage}
              />
              <AgentOsIf when={canManage}>
                <Button
                  style={{ marginTop: 12 }}
                  variant="contained"
                  color="primary"
                  onClick={() =>
                    run(async () => {
                      const config = JSON.parse(configJson);
                      return updateLearningConfig(config);
                    })
                  }
                >
                  Save Config
                </Button>
              </AgentOsIf>
              <Typography variant="caption" display="block" style={{ marginTop: 8 }}>
                autoPromotionEnabled e liveIntegrationEnabled sempre forçados
                para false no backend.
              </Typography>
            </>
          )}
        </Box>
      </Paper>
    </MainContainer>
  );
}
