import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
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
import toastError from "../../errors/toastError";
import {
  getAutomationToolMetrics,
  getAutomationToolPolicies,
  getAutomationToolsCatalog,
  listAutomationToolExecutions,
  testAutomationTool,
  testAutomationFunctionCalling,
  updateAutomationToolPolicies,
} from "../../services/automationToolsApi";
import { testEvidence } from "../../services/automationEvidenceApi";
import { testLiveRollout } from "../../services/automationLiveRolloutApi";
import { replayCognitivePlan } from "../../services/automationCognitivePlanningApi";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  mono: {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  filters: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
    alignItems: "center",
  },
  warn: {
    color: theme.palette.warning.dark,
    marginBottom: theme.spacing(1),
  },
}));

const AutomationToolsPage = () => {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [selectedToolId, setSelectedToolId] = useState("system.info");
  const [inputJson, setInputJson] = useState("{}");
  const [adminTestMode, setAdminTestMode] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [fcResult, setFcResult] = useState(null);
  const [fcQuestion, setFcQuestion] = useState("Liste as filas disponíveis");
  const [fcProvider, setFcProvider] = useState("openai");
  const [fcCallName, setFcCallName] = useState("queue_list");
  const [fcCallArgs, setFcCallArgs] = useState('{"limit":10}');
  const [fcTesting, setFcTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [evidenceResult, setEvidenceResult] = useState(null);
  const [evidenceTesting, setEvidenceTesting] = useState(false);
  const [evidenceReply, setEvidenceReply] = useState(
    "O telefone do João é 11999887766."
  );
  const [evidencePhone, setEvidencePhone] = useState("11999887766");
  const [liveTestResult, setLiveTestResult] = useState(null);
  const [planningResult, setPlanningResult] = useState(null);
  const [planningText, setPlanningText] = useState(
    "Quero transferir para um atendente humano"
  );

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAutomationToolsCatalog();
      setCatalog(data);
      if (data?.tools?.[0]?.id) {
        setSelectedToolId(data.tools[0].id);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExecutions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listAutomationToolExecutions({ pageNumber: 1 });
      setExecutions(data?.records || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAutomationToolPolicies();
      setPolicy(data?.policy || null);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const { data } = await getAutomationToolMetrics();
      setMetrics(data);
    } catch {
      setMetrics(null);
    }
  }, []);

  useEffect(() => {
    if (tab === 0) {
      loadCatalog();
      loadMetrics();
    }
    if (tab === 1) loadExecutions();
    if (tab === 2) loadCatalog();
    if (tab === 3) loadCatalog();
    if (tab === 4) loadCatalog();
    if (tab === 5) loadCatalog();
    if (tab === 6) loadPolicies();
  }, [tab, loadCatalog, loadExecutions, loadPolicies, loadMetrics]);

  const selectedManifest = (catalog?.tools || []).find(
    (t) => t.id === selectedToolId
  );
  const isWriteTool = selectedManifest?.sideEffectType === "database_write";

  const runFcTest = async () => {
    if (!adminTestMode) {
      toast.error("Ative o modo de teste explícito.");
      return;
    }
    let args = {};
    try {
      args = fcCallArgs.trim() ? JSON.parse(fcCallArgs) : {};
    } catch {
      toast.error("JSON de argumentos inválido.");
      return;
    }
    setFcTesting(true);
    try {
      const { data } = await testAutomationFunctionCalling({
        adminTestMode: true,
        provider: fcProvider,
        question: fcQuestion,
        simulateCall: { name: fcCallName, arguments: args },
      });
      setFcResult(data?.result || data);
      toast.success("Function Calling tester executado.");
    } catch (err) {
      toastError(err);
    } finally {
      setFcTesting(false);
    }
  };

  const runEvidenceTest = async () => {
    if (!adminTestMode) {
      toast.error("Ative o modo de teste explícito.");
      return;
    }
    setEvidenceTesting(true);
    try {
      const { data } = await testEvidence({
        adminTestMode: true,
        shadowReply: evidenceReply,
        toolCallCount: 1,
        usedTools: true,
        provider: "openai",
        trace: {
          iterations: [
            {
              resolutions: [
                {
                  toolId: "contact.read",
                  status: "success",
                  modelResult: {
                    status: "success",
                    tool: "contact.read",
                    item: { phone: evidencePhone, name: "João" },
                  },
                },
              ],
            },
          ],
        },
      });
      setEvidenceResult(data);
      toast.success("Evidence tester executado.");
    } catch (err) {
      toastError(err);
    } finally {
      setEvidenceTesting(false);
    }
  };

  const runTest = async (mode) => {
    if (!adminTestMode) {
      toast.error("Ative o modo de teste explícito.");
      return;
    }
    if (isWriteTool && !["preview", "dry_run", "execute"].includes(mode)) {
      toast.error("Tools de escrita exigem Preview, Dry Run ou Execute.");
      return;
    }
    if (isWriteTool && mode === "execute" && policy?.allowWrite !== true) {
      toast.error("Execute real exige allowWrite na política da empresa.");
      return;
    }
    let parsed = {};
    try {
      parsed = inputJson.trim() ? JSON.parse(inputJson) : {};
    } catch {
      toast.error("JSON de input inválido.");
      return;
    }
    setTesting(true);
    try {
      const { data } = await testAutomationTool(selectedToolId, {
        adminTestMode: true,
        mode: isWriteTool ? mode : undefined,
        confirmed: isWriteTool && mode === "execute" ? confirmed : false,
        input: parsed,
      });
      setTestResult(data?.result || data);
      toast.success(
        isWriteTool
          ? `Operation ${mode} via Tool → Operation Runtime.`
          : "Teste registrado via Tool Runtime."
      );
    } catch (err) {
      toastError(err);
    } finally {
      setTesting(false);
    }
  };

  const savePolicy = async () => {
    setSaving(true);
    try {
      const { data } = await updateAutomationToolPolicies({
        enabled: policy?.enabled === true,
        maxRiskLevel: policy?.maxRiskLevel || "read_only",
        allowWrite: policy?.allowWrite === true,
        requireConfirmationFor: policy?.requireConfirmationFor || [],
        deniedToolIds: policy?.deniedToolIds || [],
        allowedToolIds: policy?.allowedToolIds || null,
      });
      setPolicy(data?.policy || null);
      toast.success("Política salva (deny-by-default).");
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Ferramentas IA</Title>
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined">
        <Typography variant="body2" color="textSecondary" paragraph>
          Tools 2.1C — leitura + escrita via Operation Runtime. Agente Live ainda
          não executa Tools. Write Tools nunca bypassam o Runtime.
        </Typography>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
        >
          <Tab label="Catálogo" />
          <Tab label="Execuções" />
          <Tab label="Tester" />
          <Tab label="Function Calling" />
          <Tab label="Evidence" />
          <Tab label="Live Rollout" />
          <Tab label="Planning" />
          <Tab label="Políticas" />
        </Tabs>

        <Box mt={2}>
          {tab === 0 &&
            (loading && !catalog ? (
              <TableRowSkeleton columns={7} />
            ) : (
              <>
                <Typography variant="caption" color="textSecondary">
                  Métricas: {metrics?.metrics?.toolExecutions ?? 0} execuções ·{" "}
                  {metrics?.metrics?.toolFailures ?? 0} falhas
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Versão</TableCell>
                      <TableCell>Descrição</TableCell>
                      <TableCell>Categoria</TableCell>
                      <TableCell>Risco</TableCell>
                      <TableCell>Side effect</TableCell>
                      <TableCell>Runtime</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(catalog?.tools || []).map((t) => (
                      <TableRow key={`${t.id}@${t.version}`}>
                        <TableCell>{t.id}</TableCell>
                        <TableCell>{t.version}</TableCell>
                        <TableCell>{t.description}</TableCell>
                        <TableCell>{t.category}</TableCell>
                        <TableCell>{t.riskLevel}</TableCell>
                        <TableCell>{t.sideEffectType}</TableCell>
                        <TableCell>
                          {t.metadata?.operationRuntime
                            ? "Operation"
                            : "Tool"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ))}

          {tab === 1 &&
            (loading ? (
              <TableRowSkeleton columns={6} />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Tool</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Origem</TableCell>
                    <TableCell>Duração</TableCell>
                    <TableCell>Modo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {executions.map((ex) => (
                    <TableRow key={ex.id}>
                      <TableCell>{ex.id}</TableCell>
                      <TableCell>
                        {ex.toolId}@{ex.toolVersion}
                      </TableCell>
                      <TableCell>{ex.status}</TableCell>
                      <TableCell>{ex.source}</TableCell>
                      <TableCell>
                        {ex.durationMs != null ? `${ex.durationMs}ms` : "—"}
                      </TableCell>
                      <TableCell>{ex.controlMode}</TableCell>
                    </TableRow>
                  ))}
                  {!executions.length && (
                    <TableRow>
                      <TableCell colSpan={6}>Nenhuma execução.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ))}

          {tab === 2 && (
            <>
              <Typography className={classes.warn} variant="body2">
                Tester via Tool Runtime. Write Tools: Preview → Dry Run →
                Execute (exige allowWrite + confirmação quando aplicável).
              </Typography>
              <div className={classes.filters}>
                <FormControl variant="outlined" size="small" style={{ minWidth: 280 }}>
                  <InputLabel>Tool</InputLabel>
                  <Select
                    label="Tool"
                    value={selectedToolId}
                    onChange={(e) => setSelectedToolId(e.target.value)}
                  >
                    {(catalog?.tools || []).map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.id}@{t.version} ({t.sideEffectType})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Switch
                      checked={adminTestMode}
                      onChange={(e) => setAdminTestMode(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Modo de teste explícito"
                />
                {isWriteTool && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Confirmado"
                  />
                )}
                {!isWriteTool && (
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={testing || !adminTestMode}
                    onClick={() => runTest("execute")}
                  >
                    Executar leitura
                  </Button>
                )}
                {isWriteTool && (
                  <>
                    <Button
                      variant="outlined"
                      color="primary"
                      disabled={testing || !adminTestMode}
                      onClick={() => runTest("preview")}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="outlined"
                      color="primary"
                      disabled={testing || !adminTestMode}
                      onClick={() => runTest("dry_run")}
                    >
                      Dry Run
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={testing || !adminTestMode}
                      onClick={() => runTest("execute")}
                    >
                      Execute
                    </Button>
                  </>
                )}
              </div>
              {selectedManifest && (
                <Box mb={2}>
                  <Typography variant="subtitle2">Manifest / Schemas</Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      {
                        id: selectedManifest.id,
                        version: selectedManifest.version,
                        riskLevel: selectedManifest.riskLevel,
                        sideEffectType: selectedManifest.sideEffectType,
                        operationRuntime:
                          selectedManifest.metadata?.operationRuntime || false,
                        permissions: selectedManifest.requiredPermissions,
                        features: selectedManifest.requiredFeatures,
                        inputSchema: selectedManifest.inputSchema,
                        outputSchema: selectedManifest.outputSchema,
                      },
                      null,
                      2
                    )}
                  </pre>
                </Box>
              )}
              <TextField
                label="Input JSON"
                variant="outlined"
                fullWidth
                multiline
                rows={4}
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
              />
              {testResult && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Modo: {testResult.mode || "—"} · Tempo:{" "}
                    {testResult.durationMs ??
                      testResult?.internal?.metrics?.durationMs ??
                      "—"}
                    ms
                  </Typography>
                  {testResult.comparison && (
                    <>
                      <Typography variant="subtitle2">
                        Comparação Before → After
                      </Typography>
                      <pre className={classes.mono}>
                        {JSON.stringify(testResult.comparison, null, 2)}
                      </pre>
                    </>
                  )}
                  {testResult.operation && (
                    <>
                      <Typography variant="subtitle2">Operation</Typography>
                      <pre className={classes.mono}>
                        {JSON.stringify(
                          {
                            status: testResult.operation.status,
                            preview: testResult.operation.preview,
                            changedFields: testResult.operation.changedFields,
                            dryRun: testResult.operation.dryRun,
                            transaction: testResult.operation.transaction,
                            rollback: testResult.operation.rollback,
                            modelResult: testResult.operation.modelResult,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </>
                  )}
                  <Typography variant="subtitle2">Output interno</Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(
                      testResult.internal || testResult.result || testResult,
                      null,
                      2
                    )}
                  </pre>
                  <Typography variant="subtitle2">Output modelo</Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(testResult.model || null, null, 2)}
                  </pre>
                  <Typography variant="subtitle2">Diferenças</Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(testResult.diff || null, null, 2)}
                  </pre>
                </Box>
              )}
            </>
          )}

          {tab === 3 && (
            <>
              <Typography className={classes.warn} variant="body2">
                Tester Function Calling (2.1D): seleção → schemas → payload →
                resolve (somente Read Tools). Sem Shadow/Live.
              </Typography>
              <div className={classes.filters}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={adminTestMode}
                      onChange={(e) => setAdminTestMode(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Modo de teste explícito"
                />
                <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
                  <InputLabel>Provider</InputLabel>
                  <Select
                    label="Provider"
                    value={fcProvider}
                    onChange={(e) => setFcProvider(e.target.value)}
                  >
                    <MenuItem value="openai">OpenAI</MenuItem>
                    <MenuItem value="gemini">Gemini</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={fcTesting || !adminTestMode}
                  onClick={runFcTest}
                >
                  Testar FC
                </Button>
              </div>
              <TextField
                label="Pergunta"
                variant="outlined"
                fullWidth
                value={fcQuestion}
                onChange={(e) => setFcQuestion(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <TextField
                label="Tool call name (ex: queue_list)"
                variant="outlined"
                fullWidth
                value={fcCallName}
                onChange={(e) => setFcCallName(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <TextField
                label="Argumentos JSON"
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                value={fcCallArgs}
                onChange={(e) => setFcCallArgs(e.target.value)}
              />
              {fcResult && (
                <Box mt={2}>
                  <Typography variant="subtitle2">
                    Tools selecionadas → Schemas → Payload → Call
                  </Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(fcResult, null, 2)}
                  </pre>
                </Box>
              )}
            </>
          )}

          {tab === 4 && (
            <>
              <Typography className={classes.warn} variant="body2">
                Evidence Tester (2.1F): fatos observáveis, readiness e
                recommendations. Live permanece OFF.
              </Typography>
              <div className={classes.filters}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={adminTestMode}
                      onChange={(e) => setAdminTestMode(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Modo de teste explícito"
                />
                <Button
                  variant="contained"
                  color="primary"
                  disabled={evidenceTesting || !adminTestMode}
                  onClick={runEvidenceTest}
                >
                  Testar Evidence
                </Button>
              </div>
              <TextField
                label="Resposta Shadow"
                variant="outlined"
                fullWidth
                value={evidenceReply}
                onChange={(e) => setEvidenceReply(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <TextField
                label="Telefone no ToolModelResult"
                variant="outlined"
                fullWidth
                value={evidencePhone}
                onChange={(e) => setEvidencePhone(e.target.value)}
              />
              {evidenceResult && (
                <Box mt={2}>
                  <Typography variant="subtitle2">
                    Evidence / Readiness / Recommendations / Thresholds
                  </Typography>
                  <pre className={classes.mono}>
                    {JSON.stringify(evidenceResult, null, 2)}
                  </pre>
                </Box>
              )}
            </>
          )}

          {tab === 5 && (
            <>
              <Typography className={classes.warn} variant="body2">
                Live Rollout Tester (2.2): Eligibility + Canary hash. Write Tools
                OFF.
              </Typography>
              <div className={classes.filters}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={adminTestMode}
                      onChange={(e) => setAdminTestMode(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Modo de teste explícito"
                />
                <Button
                  variant="contained"
                  color="primary"
                  disabled={!adminTestMode}
                  onClick={async () => {
                    try {
                      const { data } = await testLiveRollout({
                        adminTestMode: true,
                        skipReadiness: true,
                        whatsappId: 1,
                        aiAgentId: 1,
                        ticketId: 42,
                        messageId: "tools-tester",
                        provider: "openai",
                        message: {
                          fromMe: false,
                          mediaType: "chat",
                          ticketStatus: "open",
                          userId: null,
                        },
                      });
                      setLiveTestResult(data);
                      toast.success("Live eligibility testado.");
                    } catch (err) {
                      toastError(err);
                    }
                  }}
                >
                  Testar Eligibility/Canary
                </Button>
              </div>
              {liveTestResult && (
                <pre className={classes.mono}>
                  {JSON.stringify(liveTestResult, null, 2)}
                </pre>
              )}
            </>
          )}

          {tab === 6 && (
            <>
              <Typography className={classes.warn} variant="body2">
                Planning Tester (V2.0): Goal → Plan → Replay. Não executa Tools.
              </Typography>
              <TextField
                label="Mensagem"
                value={planningText}
                onChange={(e) => setPlanningText(e.target.value)}
                fullWidth
                variant="outlined"
                size="small"
                style={{ marginBottom: 12 }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={async () => {
                  try {
                    const { data } = await replayCognitivePlan({
                      text: planningText,
                      simulatedOutcomes: {
                        s2: { partial: true, note: "awaiting_confirmation" },
                      },
                    });
                    setPlanningResult(data);
                    toast.success("Planning replay executado (sem tools).");
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Replay Cognitive Plan
              </Button>
              {planningResult && (
                <pre className={classes.mono} style={{ marginTop: 12 }}>
                  {JSON.stringify(planningResult, null, 2)}
                </pre>
              )}
            </>
          )}

          {tab === 7 && (
            <>
              <Typography className={classes.warn} variant="body2">
                Deny-by-default. allowWrite necessário para Execute real de
                escrita.
              </Typography>
              {policy && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={policy.enabled === true}
                          onChange={(e) =>
                            setPolicy({ ...policy, enabled: e.target.checked })
                          }
                          color="primary"
                        />
                      }
                      label="Policy enabled"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={policy.allowWrite === true}
                          onChange={(e) =>
                            setPolicy({
                              ...policy,
                              allowWrite: e.target.checked,
                            })
                          }
                          color="primary"
                        />
                      }
                      label="allowWrite (Execute real)"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl variant="outlined" size="small" fullWidth>
                      <InputLabel>Max risk</InputLabel>
                      <Select
                        label="Max risk"
                        value={policy.maxRiskLevel || "read_only"}
                        onChange={(e) =>
                          setPolicy({
                            ...policy,
                            maxRiskLevel: e.target.value,
                          })
                        }
                      >
                        <MenuItem value="read_only">read_only</MenuItem>
                        <MenuItem value="low">low</MenuItem>
                        <MenuItem value="medium">medium</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={saving}
                      onClick={savePolicy}
                    >
                      Salvar política
                    </Button>
                  </Grid>
                  <Grid item xs={12}>
                    <pre className={classes.mono}>
                      {JSON.stringify(policy, null, 2)}
                    </pre>
                  </Grid>
                </Grid>
              )}
            </>
          )}
        </Box>
      </Paper>
    </MainContainer>
  );
};

export default AutomationToolsPage;
