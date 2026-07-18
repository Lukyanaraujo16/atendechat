import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  Switch,
  TextField,
  Typography,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import ConfirmationModal from "../ConfirmationModal";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import {
  getAiAgentKnowledgeBases,
  getAiAgentKnowledgeSettings,
  syncAiAgentKnowledgeBases,
  testAiAgentKnowledgeRetrieval,
  updateAiAgentKnowledgeSettings,
} from "../../services/aiAgentApi";

const useStyles = makeStyles((theme) => ({
  section: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  baseRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    flexWrap: "wrap",
  },
  priorityField: {
    width: 88,
  },
  testResult: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    maxHeight: 320,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  sourceItem: {
    marginBottom: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  contextPreview: {
    whiteSpace: "pre-wrap",
    fontSize: "0.85rem",
    fontFamily: "monospace",
    marginTop: theme.spacing(1),
  },
}));

const DEFAULT_SETTINGS = {
  enabled: false,
  enabledInSimulator: false,
  enabledInShadow: false,
  enabledInLive: false,
  topK: 6,
  minimumScore: 0.35,
  maxContextCharacters: 6000,
  maxContextTokens: 1500,
  maxChunksPerDocument: 2,
  maxChunksPerBase: 4,
  allowAnswerWithoutKnowledge: true,
  handoffWhenKnowledgeMissing: false,
};

function resolveStatusLabel(status) {
  if (!status) return "—";
  const key = `aiAgent.knowledge.status.${status}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : status;
}

function resolveSkipReason(reason) {
  if (!reason) return "—";
  const key = `aiAgent.knowledge.skipReasons.${reason}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : reason;
}

function buildLinkState(availableBases, links) {
  const linkMap = new Map(
    (links || []).map((link) => [link.knowledgeBaseId, link])
  );
  const state = {};
  (availableBases || []).forEach((base) => {
    const existing = linkMap.get(base.id);
    state[base.id] = {
      selected: Boolean(existing),
      enabled: existing?.enabled !== false,
      priority: existing?.priority ?? 100,
    };
  });
  return state;
}

function linksFromState(linkState) {
  return Object.entries(linkState)
    .filter(([, value]) => value.selected)
    .map(([knowledgeBaseId, value]) => ({
      knowledgeBaseId: Number(knowledgeBaseId),
      enabled: value.enabled,
      priority: Number(value.priority) || 100,
    }));
}

export default function AiAgentKnowledgePanel({
  open,
  onClose,
  agentId,
  agentName,
}) {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [availableBases, setAvailableBases] = useState([]);
  const [linkState, setLinkState] = useState({});
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const selectedLinkCount = useMemo(
    () => Object.values(linkState).filter((item) => item.selected).length,
    [linkState]
  );

  const loadData = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const [basesRes, settingsRes] = await Promise.all([
        getAiAgentKnowledgeBases(agentId),
        getAiAgentKnowledgeSettings(agentId),
      ]);
      const bases = basesRes.data?.availableBases || [];
      const links = basesRes.data?.links || [];
      setAvailableBases(bases);
      setLinkState(buildLinkState(bases, links));
      setSettings({
        ...DEFAULT_SETTINGS,
        ...(settingsRes.data?.settings || {}),
      });
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (!open) return;
    setTestQuery("");
    setTestResult(null);
    loadData();
  }, [open, loadData]);

  const handleSettingsChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleLiveToggle = (checked) => {
    if (!checked) {
      handleSettingsChange("enabledInLive", false);
      return;
    }
    if (!settings.enabledInSimulator || !settings.enabledInShadow) {
      setLiveConfirmOpen(true);
      return;
    }
    handleSettingsChange("enabledInLive", true);
  };

  const handleConfirmLive = () => {
    setLiveConfirmOpen(false);
    handleSettingsChange("enabledInLive", true);
  };

  const handleToggleBase = (baseId, selected) => {
    setLinkState((prev) => ({
      ...prev,
      [baseId]: {
        ...prev[baseId],
        selected,
      },
    }));
  };

  const handleBaseField = (baseId, field, value) => {
    setLinkState((prev) => ({
      ...prev,
      [baseId]: {
        ...prev[baseId],
        [field]: value,
      },
    }));
  };

  const handleSaveSettings = async () => {
    if (!agentId) return;
    setSavingSettings(true);
    try {
      await updateAiAgentKnowledgeSettings(agentId, settings);
      toast.success(i18n.t("aiAgent.knowledge.toasts.settingsSaved"));
    } catch (err) {
      toastError(err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveLinks = async () => {
    if (!agentId) return;
    setSavingLinks(true);
    try {
      const { data } = await syncAiAgentKnowledgeBases(agentId, {
        links: linksFromState(linkState),
      });
      const bases = data?.availableBases || availableBases;
      const links = data?.links || [];
      setAvailableBases(bases);
      setLinkState(buildLinkState(bases, links));
      toast.success(i18n.t("aiAgent.knowledge.toasts.linksSaved"));
    } catch (err) {
      toastError(err);
    } finally {
      setSavingLinks(false);
    }
  };

  const handleRunTest = async () => {
    const query = testQuery.trim();
    if (!query || !agentId) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data } = await testAiAgentKnowledgeRetrieval(agentId, {
        query,
        topK: settings.topK,
        minimumScore: settings.minimumScore,
      });
      setTestResult(data);
    } catch (err) {
      toastError(err);
    } finally {
      setTestLoading(false);
    }
  };

  const showNoBasesAlert = settings.enabled && selectedLinkCount === 0;
  const showLiveChannelsAlert =
    settings.enabledInLive &&
    (!settings.enabledInSimulator || !settings.enabledInShadow);

  return (
    <>
      <ConfirmationModal
        title={i18n.t("aiAgent.knowledge.liveConfirm.title")}
        open={liveConfirmOpen}
        onClose={() => setLiveConfirmOpen(false)}
        onConfirm={handleConfirmLive}
      >
        {i18n.t("aiAgent.knowledge.liveConfirm.message")}
      </ConfirmationModal>

      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle>
          {i18n.t("aiAgent.knowledge.title")}
          {agentName ? (
            <Typography variant="body2" color="textSecondary">
              {agentName}
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <Typography>{i18n.t("aiAgent.knowledge.loading")}</Typography>
          ) : (
            <>
              <Alert severity="info">{i18n.t("aiAgent.knowledge.hint")}</Alert>

              <Box className={classes.section}>
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={!!settings.enabled}
                      onChange={(e) =>
                        handleSettingsChange("enabled", e.target.checked)
                      }
                    />
                  }
                  label={i18n.t("aiAgent.knowledge.fields.enabled")}
                />
              </Box>

              <Box className={classes.section}>
                <Typography className={classes.sectionTitle}>
                  {i18n.t("aiAgent.knowledge.channels.title")}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={!!settings.enabledInSimulator}
                      disabled={!settings.enabled}
                      onChange={(e) =>
                        handleSettingsChange(
                          "enabledInSimulator",
                          e.target.checked
                        )
                      }
                    />
                  }
                  label={i18n.t("aiAgent.knowledge.fields.enabledInSimulator")}
                />
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={!!settings.enabledInShadow}
                      disabled={!settings.enabled}
                      onChange={(e) =>
                        handleSettingsChange("enabledInShadow", e.target.checked)
                      }
                    />
                  }
                  label={i18n.t("aiAgent.knowledge.fields.enabledInShadow")}
                />
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={!!settings.enabledInLive}
                      disabled={!settings.enabled}
                      onChange={(e) => handleLiveToggle(e.target.checked)}
                    />
                  }
                  label={i18n.t("aiAgent.knowledge.fields.enabledInLive")}
                />
              </Box>

              {showNoBasesAlert ? (
                <Alert severity="warning" className={classes.section}>
                  {i18n.t("aiAgent.knowledge.alerts.noLinkedBases")}
                </Alert>
              ) : null}
              {showLiveChannelsAlert ? (
                <Alert severity="warning" className={classes.section}>
                  {i18n.t("aiAgent.knowledge.alerts.liveWithoutChannels")}
                </Alert>
              ) : null}

              <Divider />
              <Box className={classes.section}>
                <Typography className={classes.sectionTitle}>
                  {i18n.t("aiAgent.knowledge.bases.title")}
                </Typography>
                {availableBases.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    {i18n.t("aiAgent.knowledge.bases.empty")}
                  </Typography>
                ) : (
                  availableBases.map((base) => {
                    const row = linkState[base.id] || {
                      selected: false,
                      enabled: true,
                      priority: 100,
                    };
                    return (
                      <Box key={base.id} className={classes.baseRow}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              color="primary"
                              checked={row.selected}
                              onChange={(e) =>
                                handleToggleBase(base.id, e.target.checked)
                              }
                            />
                          }
                          label={
                            <span>
                              {base.name}
                              {!base.enabled ? (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="textSecondary"
                                >
                                  {" "}
                                  ({i18n.t("aiAgent.knowledge.bases.disabled")})
                                </Typography>
                              ) : null}
                            </span>
                          }
                        />
                        {row.selected ? (
                          <>
                            <TextField
                              className={classes.priorityField}
                              size="small"
                              type="number"
                              variant="outlined"
                              label={i18n.t("aiAgent.knowledge.bases.priority")}
                              value={row.priority}
                              onChange={(e) =>
                                handleBaseField(base.id, "priority", e.target.value)
                              }
                              inputProps={{ min: 1, max: 10000 }}
                            />
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  color="primary"
                                  checked={row.enabled}
                                  onChange={(e) =>
                                    handleBaseField(
                                      base.id,
                                      "enabled",
                                      e.target.checked
                                    )
                                  }
                                />
                              }
                              label={i18n.t("aiAgent.knowledge.bases.linkEnabled")}
                            />
                          </>
                        ) : null}
                      </Box>
                    );
                  })
                )}
                <Box marginTop={1}>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleSaveLinks}
                    disabled={savingLinks || loading}
                  >
                    {i18n.t("aiAgent.knowledge.buttons.saveLinks")}
                  </Button>
                </Box>
              </Box>

              <Divider />
              <Box className={classes.section}>
                <Typography className={classes.sectionTitle}>
                  {i18n.t("aiAgent.knowledge.retrieval.title")}
                </Typography>
                <Grid container spacing={1}>
                  {[
                    { key: "topK", label: "topK", step: 1 },
                    { key: "minimumScore", label: "minimumScore", step: 0.01 },
                    {
                      key: "maxContextCharacters",
                      label: "maxContextCharacters",
                      step: 100,
                    },
                    {
                      key: "maxContextTokens",
                      label: "maxContextTokens",
                      step: 50,
                    },
                    {
                      key: "maxChunksPerDocument",
                      label: "maxChunksPerDocument",
                      step: 1,
                    },
                    {
                      key: "maxChunksPerBase",
                      label: "maxChunksPerBase",
                      step: 1,
                    },
                  ].map((field) => (
                    <Grid item xs={12} sm={6} key={field.key}>
                      <TextField
                        fullWidth
                        margin="dense"
                        type="number"
                        variant="outlined"
                        size="small"
                        label={i18n.t(
                          `aiAgent.knowledge.fields.${field.label}`
                        )}
                        value={settings[field.key]}
                        onChange={(e) =>
                          handleSettingsChange(field.key, e.target.value)
                        }
                        inputProps={{ step: field.step }}
                      />
                    </Grid>
                  ))}
                </Grid>
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={!!settings.allowAnswerWithoutKnowledge}
                      onChange={(e) =>
                        handleSettingsChange(
                          "allowAnswerWithoutKnowledge",
                          e.target.checked
                        )
                      }
                    />
                  }
                  label={i18n.t(
                    "aiAgent.knowledge.fields.allowAnswerWithoutKnowledge"
                  )}
                />
                <FormControlLabel
                  control={
                    <Switch
                      color="primary"
                      checked={!!settings.handoffWhenKnowledgeMissing}
                      onChange={(e) =>
                        handleSettingsChange(
                          "handoffWhenKnowledgeMissing",
                          e.target.checked
                        )
                      }
                    />
                  }
                  label={i18n.t(
                    "aiAgent.knowledge.fields.handoffWhenKnowledgeMissing"
                  )}
                />
                <Box marginTop={1}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSaveSettings}
                    disabled={savingSettings || loading}
                  >
                    {i18n.t("aiAgent.knowledge.buttons.saveSettings")}
                  </Button>
                </Box>
              </Box>

              <Divider />
              <Box className={classes.section}>
                <Typography className={classes.sectionTitle}>
                  {i18n.t("aiAgent.knowledge.test.title")}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {i18n.t("aiAgent.knowledge.test.subtitle")}
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  variant="outlined"
                  size="small"
                  label={i18n.t("aiAgent.knowledge.test.queryLabel")}
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                />
                <Box marginTop={1}>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleRunTest}
                    disabled={testLoading || !testQuery.trim()}
                  >
                    {i18n.t("aiAgent.knowledge.test.run")}
                  </Button>
                </Box>
                {testResult ? (
                  <Box className={classes.testResult}>
                    <Typography variant="subtitle2">
                      {i18n.t("aiAgent.knowledge.test.status")}:{" "}
                      {resolveStatusLabel(testResult.status)}
                    </Typography>
                    {testResult.skippedReason ? (
                      <Typography variant="body2">
                        {i18n.t("aiAgent.knowledge.test.skipReason")}:{" "}
                        {resolveSkipReason(testResult.skippedReason)}
                      </Typography>
                    ) : null}
                    {testResult.queryUsed ? (
                      <Typography variant="body2">
                        {i18n.t("aiAgent.knowledge.test.queryUsed")}:{" "}
                        {testResult.queryUsed}
                      </Typography>
                    ) : null}
                    {testResult.errorCode ? (
                      <Typography variant="body2" color="error">
                        {i18n.t("aiAgent.knowledge.test.error")}:{" "}
                        {testResult.errorCode}
                        {testResult.errorMessage
                          ? ` — ${testResult.errorMessage}`
                          : ""}
                      </Typography>
                    ) : null}
                    {testResult.metrics ? (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {i18n.t("aiAgent.knowledge.test.metrics")}:{" "}
                        {testResult.metrics.returnedChunkCount ?? 0}{" "}
                        {i18n.t("aiAgent.knowledge.test.chunks")},{" "}
                        {testResult.metrics.durationMs ?? 0}ms
                      </Typography>
                    ) : null}
                    {(testResult.sources || []).length > 0 ? (
                      <Box marginTop={1}>
                        <Typography variant="subtitle2">
                          {i18n.t("aiAgent.knowledge.test.sources")}
                        </Typography>
                        {testResult.sources.map((source) => (
                          <Box
                            key={`${source.documentId}-${source.chunkId}`}
                            className={classes.sourceItem}
                          >
                            <Typography variant="body2">
                              {source.documentTitle || `#${source.documentId}`}
                              {source.sectionTitle
                                ? ` — ${source.sectionTitle}`
                                : ""}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {source.knowledgeBaseName || source.knowledgeBaseId}{" "}
                              · score {Number(source.similarityScore).toFixed(3)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ) : null}
                    {testResult.contextText ? (
                      <>
                        <Typography variant="subtitle2">
                          {i18n.t("aiAgent.knowledge.test.contextText")}
                        </Typography>
                        <Typography
                          variant="body2"
                          className={classes.contextPreview}
                        >
                          {testResult.contextText}
                        </Typography>
                      </>
                    ) : null}
                  </Box>
                ) : null}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{i18n.t("aiAgent.buttons.cancel")}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
