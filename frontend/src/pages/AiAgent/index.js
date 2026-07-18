import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  CircularProgress,
  TextField,
  MenuItem,
  Grid,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { makeStyles } from "@material-ui/core/styles";
import {
  DeleteOutline,
  Edit,
  FileCopy,
  OpenInNew,
  RateReview,
  Visibility,
  Stars as GuidedIcon,
  Settings,
  ChatBubbleOutline,
  MenuBook,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import AiAgentModal from "../../components/AiAgentModal";
import AiAgentCreateChoiceModal from "../../components/AiAgentCreateChoiceModal";
import AiProviderCredentialModal from "../../components/AiProviderCredentialModal";
import AiAgentShadowDetailsModal from "../../components/AiAgentShadowDetailsModal";
import AiAgentShadowReviewModal from "../../components/AiAgentShadowReviewModal";
import AiAgentKnowledgePanel from "../../components/AiAgentKnowledgePanel";
import { AppEmptyState } from "../../ui";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlanFlags from "../../hooks/usePlanFlags";
import { canUseKnowledgeBase } from "../../utils/canUseKnowledgeBase";
import {
  extractShadowKnowledge,
  shadowKnowledgeSummary,
} from "../../utils/aiAgentKnowledgeObservability";
import { i18n } from "../../translate/i18n";
import { resolveProviderLabel } from "../../config/aiProviderModels";
import {
  resolveShadowErrorLabel,
  resolveShadowStatusLabel,
} from "../../config/aiAgentShadowObservability";
import toastError from "../../errors/toastError";
import {
  deleteAiAgent,
  getAiAgentProfile,
  getAiAgentShadowSuggestionsSummary,
  listAiAgentShadowSuggestions,
  listAiAgents,
} from "../../services/aiAgentApi";
import { AI_AGENT_SIMULATOR_ROUTE_PATH, AI_AGENT_WIZARD_ROUTE_PATH } from "../../config/aiAgentFeature";
import {
  deleteAiProviderCredential,
  listAiProviderCredentials,
  testAiProviderCredential,
} from "../../services/aiProviderCredentialApi";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  phaseAlert: {
    marginBottom: theme.spacing(2),
  },
  subtitle: {
    marginTop: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  shadowSection: {
    marginTop: theme.spacing(3),
  },
  credentialsSection: {
    marginTop: theme.spacing(3),
  },
  shadowBadge: {
    marginLeft: theme.spacing(1),
  },
  summaryCard: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    height: "100%",
  },
  filterBar: {
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  actionIcon: {
    opacity: 0.55,
    "&:hover": {
      opacity: 1,
    },
  },
}));

const DEFAULT_SHADOW_FILTERS = {
  shadowStatus: "",
  shadowProvider: "",
  shadowModel: "",
  aiAgentId: "",
  errorCode: "",
  suggestionSource: "",
  knowledgeUsage: "",
};

const AiAgent = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const planFlags = usePlanFlags();
  const knowledgeBaseAvailable = canUseKnowledgeBase(user, planFlags);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
  const [legacyConvertOpen, setLegacyConvertOpen] = useState(false);
  const [legacyConvertAgentId, setLegacyConvertAgentId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [shadowRows, setShadowRows] = useState([]);
  const [shadowLoading, setShadowLoading] = useState(true);
  const [shadowPage, setShadowPage] = useState(1);
  const [shadowHasMore, setShadowHasMore] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [selectedCredentialId, setSelectedCredentialId] = useState(null);
  const [credentialDeleteId, setCredentialDeleteId] = useState(null);
  const [credentialConfirmOpen, setCredentialConfirmOpen] = useState(false);
  const [credentialTestLoadingId, setCredentialTestLoadingId] = useState(null);
  const [shadowFilters, setShadowFilters] = useState(DEFAULT_SHADOW_FILTERS);
  const [shadowSummary, setShadowSummary] = useState(null);
  const [shadowDetailsRow, setShadowDetailsRow] = useState(null);
  const [shadowReviewRow, setShadowReviewRow] = useState(null);
  const [knowledgePanelAgent, setKnowledgePanelAgent] = useState(null);

  const shadowQueryParams = useMemo(() => {
    const params = { pageNumber: 1 };
    Object.entries(shadowFilters).forEach(([key, value]) => {
      if (value !== "" && value != null) params[key] = value;
    });
    return params;
  }, [shadowFilters]);

  const fetchShadowSummary = useCallback(async () => {
    try {
      const { data } = await getAiAgentShadowSuggestionsSummary(shadowQueryParams);
      setShadowSummary(data || null);
    } catch {
      setShadowSummary(null);
    }
  }, [shadowQueryParams]);

  const fetchShadowSuggestions = useCallback(async (page = 1, append = false) => {
    setShadowLoading(true);
    try {
      const { data } = await listAiAgentShadowSuggestions({
        ...shadowQueryParams,
        pageNumber: page,
      });
      const records = Array.isArray(data?.records) ? data.records : [];
      setShadowRows((prev) => (append ? [...prev, ...records] : records));
      setShadowHasMore(!!data?.hasMore);
      setShadowPage(page);
    } catch (err) {
      toastError(err);
    } finally {
      setShadowLoading(false);
    }
  }, [shadowQueryParams]);

  const fetchCredentials = useCallback(async () => {
    setCredentialsLoading(true);
    try {
      const { data } = await listAiProviderCredentials();
      setCredentials(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
      setCredentials([]);
    } finally {
      setCredentialsLoading(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await listAiAgents();
      setAgents(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchCredentials();
  }, [fetchAgents, fetchCredentials]);

  useEffect(() => {
    fetchShadowSuggestions(1, false);
    fetchShadowSummary();
  }, [fetchShadowSuggestions, fetchShadowSummary]);

  const handleOpenCreateChoice = () => {
    setCreateChoiceOpen(true);
  };

  const handleOpenNew = () => {
    setSelectedId(null);
    setModalOpen(true);
  };

  const handleStartGuidedWizard = () => {
    setCreateChoiceOpen(false);
    history.push(AI_AGENT_WIZARD_ROUTE_PATH);
  };

  const handleStartAdvancedCreate = () => {
    setCreateChoiceOpen(false);
    handleOpenNew();
  };

  const handleEditGuided = async (id) => {
    try {
      const { data } = await getAiAgentProfile(id);
      if (data?.profile?.setupMode === "guided") {
        history.push(`${AI_AGENT_WIZARD_ROUTE_PATH}/${id}`);
        return;
      }
      setLegacyConvertAgentId(id);
      setLegacyConvertOpen(true);
    } catch (err) {
      toastError(err);
    }
  };

  const handleEditAdvanced = (id) => {
    setSelectedId(id);
    setModalOpen(true);
  };

  const handleSimulate = (id) => {
    history.push(AI_AGENT_SIMULATOR_ROUTE_PATH.replace(":agentId", String(id)));
  };

  const handleConfirmLegacyConvert = () => {
    if (!legacyConvertAgentId) return;
    const id = legacyConvertAgentId;
    setLegacyConvertOpen(false);
    setLegacyConvertAgentId(null);
    history.push(`${AI_AGENT_WIZARD_ROUTE_PATH}/${id}`);
  };

  const handleAskDelete = (id) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteAiAgent(deletingId);
      toast.success(i18n.t("aiAgent.toasts.deleted"));
      setConfirmOpen(false);
      setDeletingId(null);
      await fetchAgents();
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenNewCredential = () => {
    setSelectedCredentialId(null);
    setCredentialModalOpen(true);
  };

  const handleEditCredential = (id) => {
    setSelectedCredentialId(id);
    setCredentialModalOpen(true);
  };

  const handleAskDeleteCredential = (id) => {
    setCredentialDeleteId(id);
    setCredentialConfirmOpen(true);
  };

  const handleConfirmDeleteCredential = async () => {
    if (!credentialDeleteId) return;
    try {
      await deleteAiProviderCredential(credentialDeleteId);
      toast.success(i18n.t("aiAgent.credentials.toasts.deleted"));
      setCredentialConfirmOpen(false);
      setCredentialDeleteId(null);
      await fetchCredentials();
    } catch (err) {
      toastError(err);
    }
  };

  const handleTestCredential = async (id) => {
    setCredentialTestLoadingId(id);
    try {
      await testAiProviderCredential(id);
      toast.success(i18n.t("aiAgent.credentials.toasts.testOk"));
    } catch (err) {
      toastError(err);
    } finally {
      setCredentialTestLoadingId(null);
    }
  };

  const handleCopySuggestion = async (text) => {
    if (!text?.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(i18n.t("aiAgent.shadowSection.actions.copySuccess"));
    } catch {
      toast.error(i18n.t("aiAgent.shadowSection.actions.copyError"));
    }
  };

  const handleOpenTicket = (row) => {
    if (!row?.ticketUuid) return;
    history.push(`/tickets/${row.ticketUuid}`);
  };

  const handleShadowFilterChange = (field, value) => {
    setShadowFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleRefreshShadow = () => {
    fetchShadowSuggestions(1, false);
    fetchShadowSummary();
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={i18n.t("aiAgent.confirmDelete.title")}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
      >
        {i18n.t("aiAgent.confirmDelete.message")}
      </ConfirmationModal>

      <ConfirmationModal
        title={i18n.t("aiAgent.credentials.confirmDelete.title")}
        open={credentialConfirmOpen}
        onClose={() => setCredentialConfirmOpen(false)}
        onConfirm={handleConfirmDeleteCredential}
      >
        {i18n.t("aiAgent.credentials.confirmDelete.message")}
      </ConfirmationModal>

      <AiProviderCredentialModal
        open={credentialModalOpen}
        onClose={() => setCredentialModalOpen(false)}
        credentialId={selectedCredentialId}
        onSaved={fetchCredentials}
      />

      <AiAgentCreateChoiceModal
        open={createChoiceOpen}
        onClose={() => setCreateChoiceOpen(false)}
        onChooseGuided={handleStartGuidedWizard}
        onChooseAdvanced={handleStartAdvancedCreate}
      />

      <ConfirmationModal
        title={i18n.t("aiAgent.wizard.choice.convertConfirmTitle")}
        open={legacyConvertOpen}
        onClose={() => setLegacyConvertOpen(false)}
        onConfirm={handleConfirmLegacyConvert}
      >
        {i18n.t("aiAgent.wizard.choice.convertConfirmMessage")}
      </ConfirmationModal>

      <AiAgentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        agentId={selectedId}
        onSaved={fetchAgents}
      />

      <AiAgentShadowDetailsModal
        open={Boolean(shadowDetailsRow)}
        onClose={() => setShadowDetailsRow(null)}
        row={shadowDetailsRow}
      />

      <AiAgentShadowReviewModal
        open={Boolean(shadowReviewRow)}
        onClose={() => setShadowReviewRow(null)}
        row={shadowReviewRow}
        onSaved={handleRefreshShadow}
      />

      <AiAgentKnowledgePanel
        open={Boolean(knowledgePanelAgent)}
        onClose={() => setKnowledgePanelAgent(null)}
        agentId={knowledgePanelAgent?.id}
        agentName={knowledgePanelAgent?.name}
      />

      <MainHeader>
        <Box>
          <Title>{i18n.t("aiAgent.title")}</Title>
          <Typography variant="body2" className={classes.subtitle}>
            {i18n.t("aiAgent.subtitle")}
          </Typography>
        </Box>
        <MainHeaderButtonsWrapper>
          <Button variant="contained" color="primary" onClick={handleOpenCreateChoice}>
            {i18n.t("aiAgent.buttons.createAttendant")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Alert severity="info" className={classes.phaseAlert}>
          {i18n.t("aiAgent.phaseWarning")}
        </Alert>
        <Alert severity="warning" className={classes.phaseAlert}>
          {i18n.t("aiAgent.dryRunWarning")}
        </Alert>

        {loading ? (
          <Table size="small">
            <TableBody>
              <TableRowSkeleton columns={6} />
            </TableBody>
          </Table>
        ) : loadError ? (
          <AppEmptyState title={i18n.t("aiAgent.empty.loadError")}>
            <Button color="primary" variant="outlined" onClick={fetchAgents}>
              {i18n.t("aiAgent.buttons.retry")}
            </Button>
          </AppEmptyState>
        ) : agents.length === 0 ? (
          <AppEmptyState
            title={i18n.t("aiAgent.empty.title")}
            description={i18n.t("aiAgent.empty.description")}
          >
            <Button color="primary" variant="contained" onClick={handleOpenCreateChoice}>
              {i18n.t("aiAgent.buttons.createAttendant")}
            </Button>
          </AppEmptyState>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("aiAgent.table.name")}</TableCell>
                <TableCell>{i18n.t("aiAgent.table.model")}</TableCell>
                <TableCell align="center">
                  {i18n.t("aiAgent.table.enabled")}
                </TableCell>
                <TableCell align="right">
                  {i18n.t("aiAgent.table.temperature")}
                </TableCell>
                <TableCell align="right">
                  {i18n.t("aiAgent.table.maxTokens")}
                </TableCell>
                <TableCell align="center">
                  {i18n.t("aiAgent.table.actions")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <Typography variant="body2">{agent.name}</Typography>
                    {agent.description ? (
                      <Typography variant="caption" color="textSecondary">
                        {agent.description}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{agent.model}</TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={
                        agent.enabled
                          ? i18n.t("aiAgent.status.active")
                          : i18n.t("aiAgent.status.inactive")
                      }
                      color={agent.enabled ? "primary" : "default"}
                    />
                  </TableCell>
                  <TableCell align="right">{agent.temperature}</TableCell>
                  <TableCell align="right">{agent.maxTokens}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={i18n.t("aiAgent.buttons.editGuided")}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditGuided(agent.id)}
                        className={classes.actionIcon}
                      >
                        <GuidedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("aiAgent.buttons.editAdvanced")}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditAdvanced(agent.id)}
                        className={classes.actionIcon}
                      >
                        <Settings fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("aiAgent.buttons.simulateConversation")}>
                      <IconButton
                        size="small"
                        onClick={() => handleSimulate(agent.id)}
                        className={classes.actionIcon}
                      >
                        <ChatBubbleOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {knowledgeBaseAvailable ? (
                      <Tooltip title={i18n.t("aiAgent.buttons.configureKnowledge")}>
                        <IconButton
                          size="small"
                          onClick={() => setKnowledgePanelAgent(agent)}
                          className={classes.actionIcon}
                        >
                          <MenuBook fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    <Tooltip title={i18n.t("aiAgent.buttons.delete")}>
                      <IconButton
                        size="small"
                        onClick={() => handleAskDelete(agent.id)}
                        className={classes.actionIcon}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Divider className={classes.credentialsSection} />
        <Box className={classes.credentialsSection}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="h6">{i18n.t("aiAgent.credentials.title")}</Typography>
              <Typography variant="body2" color="textSecondary">
                {i18n.t("aiAgent.credentials.subtitle")}
              </Typography>
            </Box>
            <Button variant="outlined" color="primary" onClick={handleOpenNewCredential}>
              {i18n.t("aiAgent.credentials.buttons.new")}
            </Button>
          </Box>
          {credentialsLoading ? (
            <Table size="small">
              <TableBody>
                <TableRowSkeleton columns={5} />
              </TableBody>
            </Table>
          ) : credentials.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("aiAgent.credentials.empty")}
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("aiAgent.credentials.table.name")}</TableCell>
                  <TableCell>{i18n.t("aiAgent.credentials.table.provider")}</TableCell>
                  <TableCell>{i18n.t("aiAgent.credentials.table.key")}</TableCell>
                  <TableCell align="center">{i18n.t("aiAgent.credentials.table.status")}</TableCell>
                  <TableCell align="center">{i18n.t("aiAgent.table.actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {credentials.map((cred) => (
                  <TableRow key={cred.id}>
                    <TableCell>
                      {cred.name}
                      {cred.isDefault ? (
                        <Chip
                          size="small"
                          label={i18n.t("aiAgent.credentials.defaultBadge")}
                          className={classes.shadowBadge}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell>{resolveProviderLabel(cred.provider)}</TableCell>
                    <TableCell>{cred.maskedKey || "—"}</TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={
                          cred.enabled
                            ? i18n.t("aiAgent.status.active")
                            : i18n.t("aiAgent.status.inactive")
                        }
                        color={cred.enabled ? "primary" : "default"}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={i18n.t("aiAgent.credentials.buttons.test")}>
                        <span>
                          <IconButton
                            size="small"
                            disabled={credentialTestLoadingId === cred.id}
                            onClick={() => handleTestCredential(cred.id)}
                          >
                            {credentialTestLoadingId === cred.id ? (
                              <CircularProgress size={18} />
                            ) : (
                              <Typography variant="caption">✓</Typography>
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={i18n.t("aiAgent.buttons.edit")}>
                        <IconButton size="small" onClick={() => handleEditCredential(cred.id)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={i18n.t("aiAgent.buttons.delete")}>
                        <IconButton size="small" onClick={() => handleAskDeleteCredential(cred.id)}>
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>

        <Divider className={classes.shadowSection} />
        <Box className={classes.shadowSection}>
          <Typography variant="h6" gutterBottom>
            {i18n.t("aiAgent.shadowSection.title")}
          </Typography>
          <Alert severity="warning" className={classes.phaseAlert}>
            {i18n.t("aiAgent.shadowSection.warning")}
          </Alert>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            {i18n.t("aiAgent.shadowSection.evaluationHint")}
          </Typography>

          <Grid container spacing={2} className={classes.filterBar}>
            {[
              { key: "total", label: i18n.t("aiAgent.shadowSection.summary.total"), value: shadowSummary?.total },
              { key: "generated", label: i18n.t("aiAgent.shadowSection.summary.generated"), value: shadowSummary?.generated },
              { key: "failed", label: i18n.t("aiAgent.shadowSection.summary.failed"), value: shadowSummary?.failed },
              { key: "openai", label: "OpenAI", value: shadowSummary?.providers?.openai },
              { key: "gemini", label: "Google Gemini", value: shadowSummary?.providers?.gemini },
              { key: "good", label: i18n.t("aiAgent.shadowSection.summary.goodReviews"), value: shadowSummary?.reviews?.good },
              { key: "bad", label: i18n.t("aiAgent.shadowSection.summary.badReviews"), value: shadowSummary?.reviews?.bad },
            ].map((card) => (
              <Grid item xs={6} sm={4} md={3} lg={2} key={card.key}>
                <Box className={classes.summaryCard}>
                  <Typography variant="caption" color="textSecondary">
                    {card.label}
                  </Typography>
                  <Typography variant="h6">{card.value ?? 0}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={1} className={classes.filterBar}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                variant="outlined"
                label={i18n.t("aiAgent.shadowSection.filters.provider")}
                value={shadowFilters.shadowProvider}
                onChange={(e) => handleShadowFilterChange("shadowProvider", e.target.value)}
              >
                <MenuItem value="">{i18n.t("aiAgent.shadowSection.filters.all")}</MenuItem>
                <MenuItem value="openai">OpenAI</MenuItem>
                <MenuItem value="gemini">Google Gemini</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                variant="outlined"
                label={i18n.t("aiAgent.shadowSection.filters.status")}
                value={shadowFilters.shadowStatus}
                onChange={(e) => handleShadowFilterChange("shadowStatus", e.target.value)}
              >
                <MenuItem value="">{i18n.t("aiAgent.shadowSection.filters.all")}</MenuItem>
                <MenuItem value="generated">{resolveShadowStatusLabel("generated")}</MenuItem>
                <MenuItem value="failed">{resolveShadowStatusLabel("failed")}</MenuItem>
                <MenuItem value="skipped">{resolveShadowStatusLabel("skipped")}</MenuItem>
                <MenuItem value="rate_limited">{resolveShadowStatusLabel("rate_limited")}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                variant="outlined"
                label={i18n.t("aiAgent.shadowSection.filters.agent")}
                value={shadowFilters.aiAgentId}
                onChange={(e) => handleShadowFilterChange("aiAgentId", e.target.value)}
              >
                <MenuItem value="">{i18n.t("aiAgent.shadowSection.filters.all")}</MenuItem>
                {agents.map((agent) => (
                  <MenuItem key={agent.id} value={String(agent.id)}>
                    {agent.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                variant="outlined"
                label={i18n.t("aiAgent.shadowSection.filters.source")}
                value={shadowFilters.suggestionSource}
                onChange={(e) => handleShadowFilterChange("suggestionSource", e.target.value)}
              >
                <MenuItem value="">{i18n.t("aiAgent.shadowSection.filters.all")}</MenuItem>
                <MenuItem value="model">model</MenuItem>
                <MenuItem value="fallback">fallback</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                size="small"
                variant="outlined"
                label={i18n.t("aiAgent.knowledge.shadow.knowledgeFilter")}
                value={shadowFilters.knowledgeUsage || ""}
                onChange={(e) =>
                  handleShadowFilterChange("knowledgeUsage", e.target.value)
                }
              >
                <MenuItem value="">
                  {i18n.t("aiAgent.shadowSection.filters.all")}
                </MenuItem>
                <MenuItem value="with">
                  {i18n.t("aiAgent.knowledge.shadow.filterWith")}
                </MenuItem>
                <MenuItem value="without">
                  {i18n.t("aiAgent.knowledge.shadow.filterWithout")}
                </MenuItem>
                <MenuItem value="empty">
                  {i18n.t("aiAgent.knowledge.shadow.filterEmpty")}
                </MenuItem>
                <MenuItem value="error">
                  {i18n.t("aiAgent.knowledge.shadow.filterError")}
                </MenuItem>
              </TextField>
            </Grid>
          </Grid>

          {shadowLoading && shadowRows.length === 0 ? (
            <Table size="small">
              <TableBody>
                <TableRowSkeleton columns={10} />
              </TableBody>
            </Table>
          ) : shadowRows.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("aiAgent.shadowSection.empty")}
            </Typography>
          ) : (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.date")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.agent")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.ticket")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.provider")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.status")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.error")}</TableCell>
                    <TableCell>{i18n.t("aiAgent.shadowSection.table.suggestion")}</TableCell>
                    <TableCell align="right">{i18n.t("aiAgent.shadowSection.table.tokens")}</TableCell>
                    <TableCell align="right">{i18n.t("aiAgent.shadowSection.table.latency")}</TableCell>
                    <TableCell align="center">{i18n.t("aiAgent.table.actions")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shadowRows.map((row) => {
                    const shadowKnowledge = extractShadowKnowledge(row);
                    const knowledgeInfo = shadowKnowledgeSummary(shadowKnowledge);
                    return (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>{row.aiAgentName || row.aiAgentId || "-"}</TableCell>
                      <TableCell>#{row.ticketId ?? "-"}</TableCell>
                      <TableCell>
                        {row.provider ? resolveProviderLabel(row.provider) : "-"}
                        {row.model ? (
                          <Typography variant="caption" display="block" color="textSecondary">
                            {row.model}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={resolveShadowStatusLabel(row.shadowStatus)} />
                        <Chip
                          size="small"
                          color="default"
                          className={classes.shadowBadge}
                          label={i18n.t("aiAgent.shadowSection.notSentBadge")}
                        />
                        {row.review?.rating ? (
                          <Chip
                            size="small"
                            color={row.review.rating === "good" ? "primary" : "default"}
                            className={classes.shadowBadge}
                            label={row.review.rating}
                          />
                        ) : null}
                        {knowledgeInfo ? (
                          <Chip
                            size="small"
                            color="default"
                            className={classes.shadowBadge}
                            label={i18n.t("aiAgent.knowledge.shadow.used", {
                              count: knowledgeInfo.sourceCount ?? 0,
                              score:
                                knowledgeInfo.maxScore != null
                                  ? Number(knowledgeInfo.maxScore).toFixed(2)
                                  : "—",
                            })}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell>{resolveShadowErrorLabel(row.errorCode)}</TableCell>
                      <TableCell style={{ maxWidth: 240 }}>
                        <Typography variant="body2" noWrap title={row.suggestedReply || ""}>
                          {row.suggestedReply || "-"}
                        </Typography>
                        {row.suggestionSource === "fallback" ? (
                          <Typography variant="caption" color="textSecondary">
                            ({i18n.t("aiAgent.shadowSection.fallbackSource")})
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell align="right">{row.totalTokens ?? "-"}</TableCell>
                      <TableCell align="right">{row.latencyMs ?? "-"}</TableCell>
                      <TableCell align="center">
                        <Tooltip title={i18n.t("aiAgent.shadowSection.actions.copy")}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!row.suggestedReply}
                              onClick={() => handleCopySuggestion(row.suggestedReply)}
                            >
                              <FileCopy fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={i18n.t("aiAgent.shadowSection.actions.openTicket")}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!row.ticketUuid}
                              onClick={() => handleOpenTicket(row)}
                            >
                              <OpenInNew fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={i18n.t("aiAgent.shadowSection.actions.details")}>
                          <IconButton size="small" onClick={() => setShadowDetailsRow(row)}>
                            <Visibility fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={i18n.t("aiAgent.shadowSection.actions.review")}>
                          <IconButton size="small" onClick={() => setShadowReviewRow(row)}>
                            <RateReview fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {shadowHasMore ? (
                <Box marginTop={2}>
                  <Button
                    variant="outlined"
                    color="primary"
                    disabled={shadowLoading}
                    onClick={() => fetchShadowSuggestions(shadowPage + 1, true)}
                  >
                    {i18n.t("aiAgent.shadowSection.loadMore")}
                  </Button>
                </Box>
              ) : null}
            </>
          )}
        </Box>
      </Paper>
    </MainContainer>
  );
};

export default AiAgent;
