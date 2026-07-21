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
  updateAutomationToolPolicies,
} from "../../services/automationToolsApi";

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
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (tab === 3) loadPolicies();
  }, [tab, loadCatalog, loadExecutions, loadPolicies, loadMetrics]);

  const selectedManifest = (catalog?.tools || []).find(
    (t) => t.id === selectedToolId
  );

  const runTest = async () => {
    if (!adminTestMode) {
      toast.error("Ative o modo de teste explícito.");
      return;
    }
    if (selectedManifest && selectedManifest.riskLevel !== "read_only") {
      toast.error("Tester só permite Tools read_only nesta fase.");
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
        input: parsed,
      });
      setTestResult(data?.result || data);
      toast.success("Teste registrado via Tool Runtime.");
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
        allowWrite: false,
        requireConfirmationFor: policy?.requireConfirmationFor || [],
        deniedToolIds: policy?.deniedToolIds || [],
        allowedToolIds: policy?.allowedToolIds || null,
      });
      setPolicy(data?.policy || null);
      toast.success("Política salva (deny-by-default; escrita bloqueada).");
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
          Fundação Tools 2.1A. Sem Tools operacionais de negócio. Sem execução
          produtiva. Tester apenas read_only via Runtime.
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
                      <TableCell>Modos</TableCell>
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
                          {[
                            t.supportsObserve && "observe",
                            t.supportsShadow && "shadow",
                            t.supportsActive && "active",
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {selectedManifest && (
                  <Box mt={2}>
                    <Typography variant="subtitle2">Manifest (amostra)</Typography>
                    <pre className={classes.mono}>
                      {JSON.stringify(
                        {
                          id: selectedManifest.id,
                          version: selectedManifest.version,
                          capabilities: selectedManifest.capabilities,
                          permissions: selectedManifest.requiredPermissions,
                          features: selectedManifest.requiredFeatures,
                          timeout: selectedManifest.timeoutPolicy,
                          retry: selectedManifest.retryPolicy,
                          experimental: selectedManifest.experimental,
                          deprecated: selectedManifest.deprecated,
                          exposeToModel: selectedManifest.exposeToModel,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </Box>
                )}
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
                Tester exige modo explícito. Somente Tools read_only. Sem bypass
                do Runtime. Sem escrita nesta fase.
              </Typography>
              <div className={classes.filters}>
                <FormControl variant="outlined" size="small" style={{ minWidth: 240 }}>
                  <InputLabel>Tool</InputLabel>
                  <Select
                    label="Tool"
                    value={selectedToolId}
                    onChange={(e) => setSelectedToolId(e.target.value)}
                  >
                    {(catalog?.tools || [])
                      .filter((t) => t.riskLevel === "read_only")
                      .map((t) => (
                        <MenuItem key={t.id} value={t.id}>
                          {t.id}@{t.version}
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
                <Button
                  variant="contained"
                  color="primary"
                  disabled={testing || !adminTestMode}
                  onClick={runTest}
                >
                  Executar teste
                </Button>
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
                    Tempo: {testResult.durationMs ?? testResult?.internal?.metrics?.durationMs ?? "—"}ms
                  </Typography>
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
                    {JSON.stringify(
                      testResult.model ||
                        testResult?.result?.modelResult ||
                        null,
                      null,
                      2
                    )}
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
                Deny-by-default. allowWrite permanece false nesta fase.
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
