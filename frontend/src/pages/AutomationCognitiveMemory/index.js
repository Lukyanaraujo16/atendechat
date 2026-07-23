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
  buildCognitiveKnowledge,
  createCognitiveMemory,
  getCognitiveMemoryConfig,
  getCognitiveMemoryDashboard,
  listCognitiveMemory,
  queryCognitiveMemory,
  replayCognitiveMemory,
  updateCognitiveMemoryConfig,
} from "../../services/automationCognitiveMemoryApi";

const MEMORY_TYPES = [
  "WORKING",
  "EPISODIC",
  "SEMANTIC",
  "PROCEDURAL",
  "REFLECTION",
];

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

export default function AutomationCognitiveMemoryPage() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [dash, setDash] = useState(null);
  const [memoryType, setMemoryType] = useState("EPISODIC");
  const [queryText, setQueryText] = useState("produto");
  const [result, setResult] = useState(null);
  const [configJson, setConfigJson] = useState("");
  const [replayText, setReplayText] = useState("Como funciona o produto?");

  const load = useCallback(async () => {
    try {
      const [d, cfg] = await Promise.all([
        getCognitiveMemoryDashboard(),
        getCognitiveMemoryConfig(),
      ]);
      setDash(d.data);
      setConfigJson(JSON.stringify(cfg.data?.config || {}, null, 2));
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <MainContainer>
      <MainHeader>
        <Title>Cognitive Memory (V2.6)</Title>
      </MainHeader>

      <Paper className={classes.paper} variant="outlined">
        <Typography variant="body2" color="textSecondary">
          Cognitive Memory Engine — Working / Episodic / Semantic / Procedural /
          Reflection via Memory Engine. SQL Provider. Sem embeddings / Vector DB.
          Core Cognitivo desacoplado.
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {[
          ["Working", dash?.working],
          ["Episodic", dash?.episodic],
          ["Semantic", dash?.semantic],
          ["Procedural", dash?.procedural],
          ["Reflection", dash?.reflection],
          ["Knowledge Growth", dash?.knowledgeGrowth],
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
          <Tab label="Overview" />
          <Tab label="Knowledge Builder" />
          <Tab label="Memory Explorer" />
          <Tab label="Query Builder" />
          <Tab label="Score Viewer" />
          <Tab label="Knowledge Viewer" />
          <Tab label="Replay" />
          <Tab label="Config" />
        </Tabs>

        <Box style={{ marginTop: 16 }}>
          {tab === 0 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                {
                  metrics: dash?.metrics,
                  storageProvider: dash?.storageProvider,
                  vectorEnabled: dash?.vectorEnabled,
                  usesEmbeddings: dash?.usesEmbeddings,
                },
                null,
                2
              )}
            </pre>
          )}

          {tab === 1 && (
            <Box>
              <Button
                variant="contained"
                color="primary"
                onClick={async () => {
                  try {
                    const built = await buildCognitiveKnowledge({
                      runtimeStatus: "success",
                    });
                    setResult(built.data);
                    const saved = await createCognitiveMemory({
                      feedback: built.data?.feedback,
                    });
                    setResult({ built: built.data, saved: saved.data });
                    load();
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Build + Save Knowledge
              </Button>
            </Box>
          )}

          {tab === 2 && (
            <Box>
              <TextField
                select
                fullWidth
                label="Memory Type filter"
                value={memoryType}
                onChange={(e) => setMemoryType(e.target.value)}
                margin="dense"
              >
                {MEMORY_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    const { data } = await listCognitiveMemory({ limit: 30 });
                    setResult({
                      ...data,
                      filtered: (data.objects || []).filter(
                        (o) => o.memoryType === memoryType
                      ),
                    });
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Explorar Memory
              </Button>
            </Box>
          )}

          {tab === 3 && (
            <Box>
              <TextField
                fullWidth
                label="Texto"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                margin="dense"
              />
              <TextField
                select
                fullWidth
                label="Memory Type"
                value={memoryType}
                onChange={(e) => setMemoryType(e.target.value)}
                margin="dense"
              >
                {MEMORY_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                color="primary"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    const { data } = await queryCognitiveMemory({
                      query: { text: queryText, memoryType, limit: 20 },
                    });
                    setResult(data);
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Executar Query
              </Button>
            </Box>
          )}

          {tab === 4 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                (result?.results || []).map((r) => ({
                  id: r.object?.id,
                  type: r.object?.memoryType,
                  score: r.score,
                  breakdown: r.scoreBreakdown,
                })),
                null,
                2
              )}
            </pre>
          )}

          {tab === 5 && (
            <pre className={classes.mono}>
              {JSON.stringify(
                result?.built?.objects ||
                  result?.objects ||
                  result?.saved?.objects ||
                  result,
                null,
                2
              )}
            </pre>
          )}

          {tab === 6 && (
            <Box>
              <TextField
                fullWidth
                label="Texto para replay"
                value={replayText}
                onChange={(e) => setReplayText(e.target.value)}
                margin="dense"
              />
              <Button
                variant="contained"
                color="primary"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    const { data } = await replayCognitiveMemory({
                      text: replayText,
                    });
                    setResult(data);
                    load();
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Replay Feedback→Memory
              </Button>
            </Box>
          )}

          {tab === 7 && (
            <Box>
              <TextField
                fullWidth
                multiline
                minRows={12}
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                className={classes.mono}
              />
              <Button
                variant="contained"
                color="primary"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  try {
                    const parsed = JSON.parse(configJson);
                    await updateCognitiveMemoryConfig(parsed);
                    load();
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Salvar Config
              </Button>
            </Box>
          )}

          {result && tab !== 4 && tab !== 5 && (
            <Box mt={2}>
              <Typography variant="subtitle2">Último resultado</Typography>
              <pre className={classes.mono}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </Box>
          )}
        </Box>
      </Paper>
    </MainContainer>
  );
}
