import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
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
import { AppEmptyState } from "../../ui";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { toastAgentOsActionError } from "../../utils/agentOsActionError";
import { listAiAgents } from "../../services/aiAgentApi";
import {
  getAiAgentAnalyticsDashboard,
  getAiAgentHealth,
  getAiAgentPromptDiff,
  getAiAgentReplay,
  listAiAgentReplays,
  listAiKnowledgeGaps,
  listAiKnowledgeSuggestions,
  updateAiKnowledgeGap,
  updateAiKnowledgeSuggestion,
} from "../../services/aiAgentAnalyticsApi";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  card: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    height: "100%",
  },
  filters: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
  },
  mono: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  diffAdd: { backgroundColor: "rgba(46, 125, 50, 0.12)" },
  diffRemove: { backgroundColor: "rgba(198, 40, 40, 0.12)" },
}));

function MetricCard({ label, value }) {
  const classes = useStyles();
  return (
    <Paper className={classes.card} elevation={0}>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="h5">{value ?? "—"}</Typography>
    </Paper>
  );
}

const AiAgentAnalyticsPage = () => {
  const classes = useStyles();
  const { canManage, readOnlyManage } = useAgentOsConsolePermissions();
  const [tab, setTab] = useState(0);
  const [agents, setAgents] = useState([]);
  const [aiAgentId, setAiAgentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [replays, setReplays] = useState([]);
  const [health, setHealth] = useState(null);
  const [replayDetail, setReplayDetail] = useState(null);
  const [diffLeft, setDiffLeft] = useState("");
  const [diffRight, setDiffRight] = useState("");
  const [diffResult, setDiffResult] = useState(null);

  const t = useCallback(
    (key, fallback) => {
      const full = `aiAgentAnalytics.${key}`;
      const value = i18n.t(full);
      return value === full ? fallback : value;
    },
    []
  );

  useEffect(() => {
    listAiAgents()
      .then(({ data }) => {
        const rows = Array.isArray(data?.agents)
          ? data.agents
          : Array.isArray(data)
            ? data
            : [];
        setAgents(rows);
      })
      .catch(() => setAgents([]));
  }, []);

  const agentFilter = useMemo(
    () => (aiAgentId ? { aiAgentId: Number(aiAgentId) } : {}),
    [aiAgentId]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAiAgentAnalyticsDashboard(agentFilter);
      setDashboard(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [agentFilter]);

  const loadGaps = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listAiKnowledgeGaps({
        ...agentFilter,
        resolved: false,
        sort: "frequency",
      });
      setGaps(data?.gaps || data?.records || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [agentFilter]);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listAiKnowledgeSuggestions({
        ...agentFilter,
        status: "pending",
      });
      setSuggestions(data?.suggestions || data?.records || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [agentFilter]);

  const loadReplays = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listAiAgentReplays(agentFilter);
      setReplays(data?.replays || data?.records || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [agentFilter]);

  const loadHealth = useCallback(async () => {
    if (!aiAgentId) {
      setHealth(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await getAiAgentHealth({ aiAgentId: Number(aiAgentId) });
      setHealth(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [aiAgentId]);

  useEffect(() => {
    if (tab === 0) loadDashboard();
    if (tab === 1) loadGaps();
    if (tab === 2) loadSuggestions();
    if (tab === 3) loadReplays();
    if (tab === 4) loadHealth();
  }, [tab, loadDashboard, loadGaps, loadSuggestions, loadReplays, loadHealth]);

  const handleResolveGap = async (gap, action) => {
    try {
      await updateAiKnowledgeGap(gap.id, { action });
      toast.success(t("gapUpdated", "Gap atualizado"));
      loadGaps();
    } catch (err) {
      toastAgentOsActionError(err);
    }
  };

  const handleSuggestionStatus = async (row, status) => {
    try {
      await updateAiKnowledgeSuggestion(row.id, { status });
      toast.success(t("suggestionUpdated", "Sugestão atualizada"));
      loadSuggestions();
    } catch (err) {
      toastAgentOsActionError(err);
    }
  };

  const openReplay = async (id) => {
    try {
      const { data } = await getAiAgentReplay(id);
      setReplayDetail(data?.replay || data);
    } catch (err) {
      toastError(err);
    }
  };

  const runPromptDiff = async () => {
    if (!diffLeft || !diffRight) {
      toast.warn(t("selectTwoReplays", "Selecione dois replays"));
      return;
    }
    try {
      const { data } = await getAiAgentPromptDiff({
        leftId: Number(diffLeft),
        rightId: Number(diffRight),
      });
      setDiffResult(data);
    } catch (err) {
      toastError(err);
    }
  };

  const totals = {
    totalInteractions: dashboard?.interactions?.total,
    knowledgeHits: dashboard?.retrieval?.hits,
    knowledgeMisses: dashboard?.retrieval?.misses,
    handoffs: dashboard?.handoffs,
  };
  const gapTop = dashboard?.gapTop10 || [];
  const docsTop = dashboard?.documentsTop10 || [];

  return (
    <MainContainer>
      <MainHeader>
        <Title>{t("title", "Analytics IA")}</Title>
      </MainHeader>
      <AgentOsReadOnlyBanner visible={readOnlyManage} />
      <Paper className={classes.mainPaper} variant="outlined">
        <Typography variant="body2" color="textSecondary" paragraph>
          {t(
            "subtitle",
            "Observabilidade e aprendizado assistido. Nenhuma alteração automática em documentos, prompts ou embeddings."
          )}
        </Typography>

        <div className={classes.filters}>
          <FormControl variant="outlined" size="small" style={{ minWidth: 220 }}>
            <InputLabel>{t("agent", "Agente")}</InputLabel>
            <Select
              label={t("agent", "Agente")}
              value={aiAgentId}
              onChange={(e) => setAiAgentId(e.target.value)}
            >
              <MenuItem value="">{t("allAgents", "Todos")}</MenuItem>
              {agents.map((a) => (
                <MenuItem key={a.id} value={String(a.id)}>
                  {a.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
        >
          <Tab label={t("tabDashboard", "Dashboard")} />
          <Tab label={t("tabGaps", "Knowledge Gaps")} />
          <Tab label={t("tabSuggestions", "Sugestões")} />
          <Tab label={t("tabReplay", "Replay")} />
          <Tab label={t("tabHealth", "Saúde")} />
        </Tabs>

        <Box mt={2}>
          {tab === 0 && (
            <>
              {loading ? (
                <TableRowSkeleton columns={4} />
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label={t("interactions", "Interações")}
                      value={totals.totalInteractions}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label={t("knowledgeHits", "Knowledge hits")}
                      value={totals.knowledgeHits}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label={t("knowledgeMisses", "Knowledge misses")}
                      value={totals.knowledgeMisses}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <MetricCard
                      label={t("handoffs", "Handoffs")}
                      value={totals.handoffs}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("gapsTop", "Gaps Top 10")}
                    </Typography>
                    {(gapTop || []).length === 0 ? (
                      <AppEmptyState title={t("empty", "Sem dados")} />
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>{t("question", "Pergunta")}</TableCell>
                            <TableCell>{t("frequency", "Freq.")}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {gapTop.map((g) => (
                            <TableRow key={g.id || g.questionHash}>
                              <TableCell>{g.questionPreview}</TableCell>
                              <TableCell>{g.frequency}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("docsTop", "Documentos Top 10")}
                    </Typography>
                    {(docsTop || []).length === 0 ? (
                      <AppEmptyState title={t("empty", "Sem dados")} />
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>{t("retrievals", "Retrievals")}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {docsTop.map((d) => (
                            <TableRow key={d.documentId || d.id}>
                              <TableCell>
                                {d.document?.title || d.documentId}
                              </TableCell>
                              <TableCell>{d.retrievalCount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Grid>
                </Grid>
              )}
            </>
          )}

          {tab === 1 && (
            <>
              {loading ? (
                <TableRowSkeleton columns={5} />
              ) : gaps.length === 0 ? (
                <AppEmptyState title={t("noGaps", "Nenhum gap aberto")} />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("question", "Pergunta")}</TableCell>
                      <TableCell>{t("reason", "Motivo")}</TableCell>
                      <TableCell>{t("frequency", "Freq.")}</TableCell>
                      <TableCell>{t("channel", "Canal")}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {gaps.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>{g.questionPreview}</TableCell>
                        <TableCell>
                          <Chip size="small" label={g.reason} />
                        </TableCell>
                        <TableCell>{g.frequency}</TableCell>
                        <TableCell>{g.channel}</TableCell>
                        <TableCell align="right">
                          <AgentOsIf when={canManage}>
                            <Button
                              size="small"
                              onClick={() => handleResolveGap(g, "ignore")}
                            >
                              {t("ignore", "Ignorar")}
                            </Button>
                          </AgentOsIf>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}

          {tab === 2 && (
            <>
              {loading ? (
                <TableRowSkeleton columns={4} />
              ) : suggestions.length === 0 ? (
                <AppEmptyState
                  title={t("noSuggestions", "Nenhuma sugestão pendente")}
                />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t("origin", "Origem")}</TableCell>
                      <TableCell>{t("question", "Pergunta")}</TableCell>
                      <TableCell>{t("reason", "Motivo")}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {suggestions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.origin}</TableCell>
                        <TableCell>{s.questionPreview}</TableCell>
                        <TableCell>{s.reason}</TableCell>
                        <TableCell align="right">
                          <AgentOsIf when={canManage}>
                            <Button
                              size="small"
                              color="primary"
                              onClick={() =>
                                handleSuggestionStatus(s, "accepted")
                              }
                            >
                              {t("accept", "Aceitar")}
                            </Button>
                            <Button
                              size="small"
                              onClick={() =>
                                handleSuggestionStatus(s, "rejected")
                              }
                            >
                              {t("reject", "Rejeitar")}
                            </Button>
                          </AgentOsIf>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <Typography variant="caption" color="textSecondary" display="block">
                {t(
                  "suggestionHint",
                  "Aceitar não cria documentos automaticamente — apenas registra a decisão humana."
                )}
              </Typography>
            </>
          )}

          {tab === 3 && (
            <>
              <div className={classes.filters}>
                <TextField
                  size="small"
                  variant="outlined"
                  label="Replay A"
                  value={diffLeft}
                  onChange={(e) => setDiffLeft(e.target.value)}
                />
                <TextField
                  size="small"
                  variant="outlined"
                  label="Replay B"
                  value={diffRight}
                  onChange={(e) => setDiffRight(e.target.value)}
                />
                <Button variant="outlined" onClick={runPromptDiff}>
                  {t("promptDiff", "Prompt Diff")}
                </Button>
              </div>
              {diffResult?.promptDiff && (
                <Paper variant="outlined" style={{ padding: 12, marginBottom: 16 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Prompt Diff
                  </Typography>
                  <div className={classes.mono}>
                    {(diffResult.promptDiff || []).slice(0, 80).map((line, idx) => (
                      <div
                        key={idx}
                        className={
                          line.type === "add"
                            ? classes.diffAdd
                            : line.type === "remove"
                              ? classes.diffRemove
                              : undefined
                        }
                      >
                        {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}{" "}
                        {line.text}
                      </div>
                    ))}
                  </div>
                </Paper>
              )}
              {loading ? (
                <TableRowSkeleton columns={5} />
              ) : replays.length === 0 ? (
                <AppEmptyState title={t("noReplays", "Nenhum replay")} />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>{t("channel", "Canal")}</TableCell>
                      <TableCell>{t("decision", "Decisão")}</TableCell>
                      <TableCell>{t("model", "Modelo")}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {replays.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.id}</TableCell>
                        <TableCell>{r.channel}</TableCell>
                        <TableCell>{r.decision}</TableCell>
                        <TableCell>{r.model}</TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => openReplay(r.id)}>
                            {t("open", "Abrir")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}

          {tab === 4 && (
            <>
              {!aiAgentId ? (
                <AppEmptyState
                  title={t("selectAgentHealth", "Selecione um agente para ver a saúde")}
                />
              ) : loading ? (
                <TableRowSkeleton columns={3} />
              ) : health ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <MetricCard
                      label={t("healthScore", "Health Score")}
                      value={health.health?.score ?? "—"}
                    />
                    <Typography variant="caption" color="textSecondary">
                      {health.health?.formula}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t("checks", "Verificações")}
                    </Typography>
                    {(health.checks || []).length === 0 ? (
                      <AppEmptyState title={t("healthy", "Sem alertas")} />
                    ) : (
                      (health.checks || []).map((c) => (
                        <Box key={c.code} mb={1}>
                          <Chip
                            size="small"
                            label={c.severity}
                            color={
                              c.severity === "critical" ? "secondary" : "default"
                            }
                          />{" "}
                          {c.message}
                        </Box>
                      ))
                    )}
                  </Grid>
                </Grid>
              ) : null}
            </>
          )}
        </Box>
      </Paper>

      <Dialog
        open={Boolean(replayDetail)}
        onClose={() => setReplayDetail(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {t("replay", "Replay")} #{replayDetail?.id}
        </DialogTitle>
        <DialogContent>
          {replayDetail && (
            <div className={classes.mono}>
              {JSON.stringify(
                {
                  decision: replayDetail.decision,
                  handoff: replayDetail.handoff,
                  provider: replayDetail.provider,
                  model: replayDetail.model,
                  latencyMs: replayDetail.latencyMs,
                  messagePreview: replayDetail.messagePreview,
                  responsePreview: replayDetail.responsePreview,
                  snapshot: replayDetail.snapshot,
                },
                null,
                2
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplayDetail(null)}>
            {t("close", "Fechar")}
          </Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default AiAgentAnalyticsPage;
