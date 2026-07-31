/**
 * Painéis de administração agent-scoped (Fase 2.10).
 * Product API only — sem endpoints legados.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import {
  AppPrimaryButton,
  AppSecondaryButton,
  AppNeutralButton,
  AppEmptyState,
} from "../../ui";
import {
  getAiAgentProductConfiguration,
  getAiAgentProductConfigurationOptions,
  putAiAgentProductConfiguration,
  getAiAgentProductKnowledge,
  putAiAgentProductKnowledge,
} from "../../services/aiAgentProductApi";
import {
  aiAgentProductConfigurationToWizardFormState,
  filterAiAgentWizardCredentialsByProvider,
  filterAiAgentWizardModelsByProvider,
  mapAiAgentWizardProductOptions,
  validateAiAgentWizardCommercialSetup,
  validateAiAgentWizardIdentity,
  wizardFormStateToProductConfigurationPayload,
  wizardFormStateToProductIdentityPayload,
} from "../AiAgentWizard/aiAgentWizardProductMapper";
import { hasWizardValidationErrors } from "../AiAgentWizard/aiAgentWizardValidation";
import { aiAgentSectionPath, aiAgentSimulatorPath } from "../../config/aiAgentFeature";
import { KNOWLEDGE_BASE_ROUTE_PATH } from "../../config/knowledgeBaseFeature";
import { notifyAiAgentProductAgentsChanged } from "../../utils/aiAgentProductAgentsCache";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    maxWidth: 720,
  },
  banner: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,193,7,0.12)"
        : "rgba(255,243,205,1)",
    border: `1px solid ${theme.palette.divider}`,
  },
  field: {
    marginTop: theme.spacing(1),
  },
  faqRow: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  meta: {
    color: theme.palette.text.secondary,
  },
  kbRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}));

function mapConfigError(err) {
  const code = err?.response?.data?.error || err?.response?.data?.message;
  if (code === "ERR_AI_AGENT_PRODUCT_UPDATE_NOT_ALLOWED_WHILE_ACTIVE") {
    return i18n.t("aiAgentProduct.admin.errors.activeLocked");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED") {
    return i18n.t("aiAgentProduct.configurationErrors.agentRefRequired");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND") {
    return i18n.t("aiAgentProduct.configurationErrors.agentNotFound");
  }
  return null;
}

export function AiAgentActiveLockBanner({
  editableWhileActive,
  canMutate,
  onDeactivate,
  busy,
}) {
  const classes = useStyles();
  if (editableWhileActive !== false) return null;
  return (
    <Box
      className={classes.banner}
      role="status"
      data-testid="ai-agent-active-lock-banner"
    >
      <Typography variant="body2">
        {i18n.t("aiAgentProduct.admin.activeLockDescription")}
      </Typography>
      {canMutate && onDeactivate ? (
        <Box className={classes.actions}>
          <AppSecondaryButton
            onClick={onDeactivate}
            disabled={busy}
            data-testid="ai-agent-admin-deactivate"
          >
            {i18n.t("aiAgentProduct.commands.deactivate")}
          </AppSecondaryButton>
        </Box>
      ) : null}
    </Box>
  );
}

export function AiAgentIdentityPanel({
  agentRef,
  canMutate,
  editableWhileActive,
  onSaved,
}) {
  const classes = useStyles();
  const agentRefKey = String(agentRef || "").trim();
  const liveRef = useRef(agentRefKey);
  liveRef.current = agentRefKey;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    identityName: "",
    identityDescription: "",
    fallbackMessage: "",
    handoffMessage: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const load = useCallback(async () => {
    if (!agentRefKey) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAiAgentProductConfiguration(agentRefKey);
      if (liveRef.current !== agentRefKey) return;
      const mapped = aiAgentProductConfigurationToWizardFormState(
        data?.configuration,
        null
      );
      setForm({
        identityName: mapped.identityName || "",
        identityDescription: mapped.identityDescription || "",
        fallbackMessage: mapped.fallbackMessage || "",
        handoffMessage: mapped.handoffMessage || "",
      });
    } catch (err) {
      if (liveRef.current !== agentRefKey) return;
      setError(mapConfigError(err) || i18n.t("aiAgentProduct.error.description"));
    } finally {
      if (liveRef.current === agentRefKey) setLoading(false);
    }
  }, [agentRefKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!canMutate || saving) return;
    const errors = validateAiAgentWizardIdentity(form);
    if (hasWizardValidationErrors(errors)) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      await putAiAgentProductConfiguration(
        wizardFormStateToProductIdentityPayload(form),
        agentRefKey
      );
      if (liveRef.current !== agentRefKey) return;
      notifyAiAgentProductAgentsChanged();
      toast.success(i18n.t("aiAgentProduct.admin.saved"));
      if (onSaved) await onSaved();
    } catch (err) {
      if (liveRef.current !== agentRefKey) return;
      const mapped = mapConfigError(err);
      if (mapped) toast.error(mapped);
      else toastError(err);
    } finally {
      if (liveRef.current === agentRefKey) setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4} role="status">
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (error) {
    return (
      <AppEmptyState
        title={i18n.t("aiAgentProduct.error.title")}
        description={error}
      >
        <AppSecondaryButton onClick={load}>
          {i18n.t("aiAgentProduct.actions.retry")}
        </AppSecondaryButton>
      </AppEmptyState>
    );
  }

  const locked = !canMutate;

  return (
    <Box className={classes.panel} data-testid="ai-agent-identity-panel">
      <Typography variant="h6" component="h2">
        {i18n.t("aiAgentProduct.admin.sections.identity")}
      </Typography>
      <Typography variant="body2" className={classes.meta}>
        {i18n.t("aiAgentProduct.admin.identityHint")}
      </Typography>
      <TextField
        className={classes.field}
        label={i18n.t("aiAgentProduct.admin.fields.name")}
        value={form.identityName}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, identityName: e.target.value }))
        }
        error={Boolean(fieldErrors.identityName)}
        fullWidth
        disabled={locked}
        inputProps={{ "data-testid": "ai-agent-identity-name" }}
      />
      <TextField
        className={classes.field}
        label={i18n.t("aiAgentProduct.admin.fields.description")}
        value={form.identityDescription}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, identityDescription: e.target.value }))
        }
        fullWidth
        multiline
        minRows={2}
        disabled={locked}
      />
      <TextField
        className={classes.field}
        label={i18n.t("aiAgentProduct.admin.fields.fallback")}
        value={form.fallbackMessage}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, fallbackMessage: e.target.value }))
        }
        fullWidth
        multiline
        minRows={2}
        disabled={locked}
      />
      <TextField
        className={classes.field}
        label={i18n.t("aiAgentProduct.admin.fields.handoff")}
        value={form.handoffMessage}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, handoffMessage: e.target.value }))
        }
        fullWidth
        multiline
        minRows={2}
        disabled={locked}
      />
      {canMutate ? (
        <Box className={classes.actions}>
          <AppPrimaryButton
            onClick={handleSave}
            disabled={saving}
            data-testid="ai-agent-identity-save"
          >
            {saving
              ? i18n.t("aiAgentProduct.admin.saving")
              : i18n.t("aiAgentProduct.admin.save")}
          </AppPrimaryButton>
        </Box>
      ) : null}
    </Box>
  );
}

export function AiAgentIntelligencePanel({
  agentRef,
  canMutate,
  editableWhileActive,
  onDeactivate,
  commandBusy,
  onSaved,
  onOpenCredentials,
}) {
  const classes = useStyles();
  const agentRefKey = String(agentRef || "").trim();
  const liveRef = useRef(agentRefKey);
  liveRef.current = agentRefKey;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [optionsRaw, setOptionsRaw] = useState(null);
  const [form, setForm] = useState(null);
  const [commercialError, setCommercialError] = useState(null);

  const structuralLocked =
    !canMutate || editableWhileActive === false;

  const options = useMemo(
    () => mapAiAgentWizardProductOptions(optionsRaw),
    [optionsRaw]
  );
  const models = filterAiAgentWizardModelsByProvider(
    options.models,
    form?.provider
  );
  const credentials = filterAiAgentWizardCredentialsByProvider(
    options.credentials,
    form?.provider
  ).filter((item) => item.enabled);

  const load = useCallback(async () => {
    if (!agentRefKey) return;
    setLoading(true);
    setError(null);
    try {
      const [configData, opts] = await Promise.all([
        getAiAgentProductConfiguration(agentRefKey),
        getAiAgentProductConfigurationOptions(agentRefKey),
      ]);
      if (liveRef.current !== agentRefKey) return;
      setOptionsRaw(opts);
      setForm(
        aiAgentProductConfigurationToWizardFormState(
          configData?.configuration,
          opts
        )
      );
    } catch (err) {
      if (liveRef.current !== agentRefKey) return;
      setError(mapConfigError(err) || i18n.t("aiAgentProduct.error.description"));
    } finally {
      if (liveRef.current === agentRefKey) setLoading(false);
    }
  }, [agentRefKey]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (partial) => setForm((prev) => ({ ...(prev || {}), ...partial }));

  const handleSave = async () => {
    if (structuralLocked || saving || !form) return;
    const validation = validateAiAgentWizardCommercialSetup(form, optionsRaw);
    if (validation) {
      setCommercialError(validation.errorKey);
      return;
    }
    setCommercialError(null);
    setSaving(true);
    try {
      const payload = wizardFormStateToProductConfigurationPayload(form, {
        forCreate: false,
        includeConnections: false,
      });
      await putAiAgentProductConfiguration(payload, agentRefKey);
      if (liveRef.current !== agentRefKey) return;
      notifyAiAgentProductAgentsChanged();
      toast.success(i18n.t("aiAgentProduct.admin.saved"));
      if (onSaved) await onSaved();
      await load();
    } catch (err) {
      if (liveRef.current !== agentRefKey) return;
      const mapped = mapConfigError(err);
      if (mapped) toast.error(mapped);
      else toastError(err);
    } finally {
      if (liveRef.current === agentRefKey) setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <Box display="flex" justifyContent="center" py={4} role="status">
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (error) {
    return (
      <AppEmptyState
        title={i18n.t("aiAgentProduct.error.title")}
        description={error}
      >
        <AppSecondaryButton onClick={load}>
          {i18n.t("aiAgentProduct.actions.retry")}
        </AppSecondaryButton>
      </AppEmptyState>
    );
  }

  const faqs = Array.isArray(form.frequentlyAskedQuestions)
    ? form.frequentlyAskedQuestions
    : [];

  return (
    <Box className={classes.panel} data-testid="ai-agent-intelligence-panel">
      <Typography variant="h6" component="h2">
        {i18n.t("aiAgentProduct.admin.sections.intelligence")}
      </Typography>
      <Typography variant="body2" className={classes.meta}>
        {i18n.t("aiAgentProduct.admin.intelligenceHint")}
      </Typography>

      <AiAgentActiveLockBanner
        editableWhileActive={editableWhileActive}
        canMutate={canMutate}
        onDeactivate={onDeactivate}
        busy={Boolean(commandBusy) || saving}
      />

      <TextField
        className={classes.field}
        select
        label={i18n.t("aiAgentProduct.admin.fields.provider")}
        value={form.provider || ""}
        onChange={(e) =>
          patch({
            provider: e.target.value,
            model: "",
            credentialRef: "",
          })
        }
        fullWidth
        disabled={structuralLocked}
        inputProps={{ "data-testid": "ai-agent-provider-select" }}
      >
        {(options.providers || []).map((provider) => (
          <MenuItem
            key={provider.value}
            value={provider.value}
            disabled={!provider.available}
          >
            {provider.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        className={classes.field}
        select
        label={i18n.t("aiAgentProduct.admin.fields.model")}
        value={form.model || ""}
        onChange={(e) => patch({ model: e.target.value })}
        fullWidth
        disabled={structuralLocked || !form.provider}
        inputProps={{ "data-testid": "ai-agent-model-select" }}
      >
        {models.map((model) => (
          <MenuItem key={model.value} value={model.value}>
            {model.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        className={classes.field}
        select
        label={i18n.t("aiAgentProduct.admin.fields.credential")}
        value={form.credentialRef || ""}
        onChange={(e) => patch({ credentialRef: e.target.value })}
        fullWidth
        disabled={structuralLocked || !form.provider}
        inputProps={{ "data-testid": "ai-agent-credential-select" }}
      >
        {credentials.map((credential) => (
          <MenuItem key={credential.ref} value={credential.ref}>
            {credential.name}
            {credential.maskedKey ? ` (${credential.maskedKey})` : ""}
          </MenuItem>
        ))}
      </TextField>
      {canMutate ? (
        <AppNeutralButton onClick={onOpenCredentials} disabled={saving}>
          {i18n.t("aiAgentProduct.secondary.manageCredentials")}
        </AppNeutralButton>
      ) : null}

      <TextField
        className={classes.field}
        label={i18n.t("aiAgentProduct.admin.fields.objective")}
        value={form.companyDescription || ""}
        onChange={(e) => patch({ companyDescription: e.target.value })}
        fullWidth
        multiline
        minRows={2}
        disabled={structuralLocked}
      />
      <TextField
        className={classes.field}
        label={i18n.t("aiAgentProduct.admin.fields.instructions")}
        value={form.customInstructions || ""}
        onChange={(e) => patch({ customInstructions: e.target.value })}
        fullWidth
        multiline
        minRows={4}
        disabled={structuralLocked}
        inputProps={{ "data-testid": "ai-agent-instructions" }}
      />
      <TextField
        className={classes.field}
        label={i18n.t("aiAgentProduct.admin.fields.tone")}
        value={form.tone || ""}
        onChange={(e) => patch({ tone: e.target.value })}
        fullWidth
        disabled={structuralLocked}
      />
      <TextField
        className={classes.field}
        label={i18n.t("aiAgentProduct.admin.fields.handoffRules")}
        value={form.handoffRules || ""}
        onChange={(e) => patch({ handoffRules: e.target.value })}
        fullWidth
        multiline
        minRows={2}
        disabled={structuralLocked}
      />

      <Typography variant="subtitle1" component="h3">
        {i18n.t("aiAgentProduct.admin.faqTitle")}
      </Typography>
      {faqs.length === 0 ? (
        <Typography variant="body2" className={classes.meta}>
          {i18n.t("aiAgentProduct.admin.faqEmpty")}
        </Typography>
      ) : null}
      {faqs.map((item, index) => (
        <Box
          key={`faq-${index}`}
          className={classes.faqRow}
          data-testid={`ai-agent-faq-${index}`}
        >
          <TextField
            label={i18n.t("aiAgentProduct.admin.fields.faqQuestion")}
            value={item.question || ""}
            onChange={(e) => {
              const next = [...faqs];
              next[index] = { ...next[index], question: e.target.value };
              patch({ frequentlyAskedQuestions: next });
            }}
            fullWidth
            disabled={structuralLocked}
          />
          <TextField
            label={i18n.t("aiAgentProduct.admin.fields.faqAnswer")}
            value={item.answer || ""}
            onChange={(e) => {
              const next = [...faqs];
              next[index] = { ...next[index], answer: e.target.value };
              patch({ frequentlyAskedQuestions: next });
            }}
            fullWidth
            multiline
            minRows={2}
            disabled={structuralLocked}
          />
          {!structuralLocked ? (
            <AppNeutralButton
              onClick={() => {
                const next = faqs.filter((_, i) => i !== index);
                patch({ frequentlyAskedQuestions: next });
              }}
            >
              {i18n.t("aiAgentProduct.admin.removeFaq")}
            </AppNeutralButton>
          ) : null}
        </Box>
      ))}
      {!structuralLocked ? (
        <AppSecondaryButton
          onClick={() =>
            patch({
              frequentlyAskedQuestions: [
                ...faqs,
                { question: "", answer: "" },
              ],
            })
          }
          data-testid="ai-agent-faq-add"
        >
          {i18n.t("aiAgentProduct.admin.addFaq")}
        </AppSecondaryButton>
      ) : null}

      {commercialError ? (
        <Typography color="error" role="alert">
          {i18n.t(`aiAgent.wizard.product.${commercialError}`)}
        </Typography>
      ) : null}

      {!structuralLocked ? (
        <Box className={classes.actions}>
          <AppPrimaryButton
            onClick={handleSave}
            disabled={saving}
            data-testid="ai-agent-intelligence-save"
          >
            {saving
              ? i18n.t("aiAgentProduct.admin.saving")
              : i18n.t("aiAgentProduct.admin.save")}
          </AppPrimaryButton>
        </Box>
      ) : null}
    </Box>
  );
}

export function AiAgentKnowledgePanel({
  agentRef,
  canMutate,
  editableWhileActive,
  onDeactivate,
  commandBusy,
}) {
  const classes = useStyles();
  const history = useHistory();
  const agentRefKey = String(agentRef || "").trim();
  const liveRef = useRef(agentRefKey);
  liveRef.current = agentRefKey;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [links, setLinks] = useState([]);
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState([]);

  const locked = !canMutate || editableWhileActive === false;

  const load = useCallback(async () => {
    if (!agentRefKey) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAiAgentProductKnowledge(agentRefKey);
      if (liveRef.current !== agentRefKey) return;
      const linked = Array.isArray(data?.links) ? data.links : [];
      setLinks(linked);
      setAvailable(Array.isArray(data?.availableBases) ? data.availableBases : []);
      setSelected(linked.map((item) => String(item.ref)));
    } catch (err) {
      if (liveRef.current !== agentRefKey) return;
      setError(mapConfigError(err) || i18n.t("aiAgentProduct.error.description"));
    } finally {
      if (liveRef.current === agentRefKey) setLoading(false);
    }
  }, [agentRefKey]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (ref) => {
    if (locked) return;
    setSelected((prev) =>
      prev.includes(ref) ? prev.filter((item) => item !== ref) : [...prev, ref]
    );
  };

  const handleSave = async () => {
    if (locked || saving) return;
    setSaving(true);
    try {
      await putAiAgentProductKnowledge(
        { knowledgeBaseRefs: selected },
        agentRefKey
      );
      if (liveRef.current !== agentRefKey) return;
      notifyAiAgentProductAgentsChanged();
      toast.success(i18n.t("aiAgentProduct.admin.saved"));
      await load();
    } catch (err) {
      if (liveRef.current !== agentRefKey) return;
      const mapped = mapConfigError(err);
      if (mapped) toast.error(mapped);
      else toastError(err);
    } finally {
      if (liveRef.current === agentRefKey) setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4} role="status">
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (error) {
    return (
      <AppEmptyState
        title={i18n.t("aiAgentProduct.error.title")}
        description={error}
      >
        <AppSecondaryButton onClick={load}>
          {i18n.t("aiAgentProduct.actions.retry")}
        </AppSecondaryButton>
      </AppEmptyState>
    );
  }

  return (
    <Box className={classes.panel} data-testid="ai-agent-knowledge-panel">
      <Typography variant="h6" component="h2">
        {i18n.t("aiAgentProduct.admin.sections.knowledge")}
      </Typography>
      <Typography variant="body2" className={classes.meta}>
        {i18n.t("aiAgentProduct.admin.knowledgeHint")}
      </Typography>

      <AiAgentActiveLockBanner
        editableWhileActive={editableWhileActive}
        canMutate={canMutate}
        onDeactivate={onDeactivate}
        busy={Boolean(commandBusy) || saving}
      />

      <Typography variant="subtitle1" component="h3">
        {i18n.t("aiAgentProduct.admin.linkedBases")}
      </Typography>
      {links.length === 0 ? (
        <Typography variant="body2" className={classes.meta}>
          {i18n.t("aiAgentProduct.admin.linkedBasesEmpty")}
        </Typography>
      ) : (
        links.map((link) => (
          <Box key={link.ref} className={classes.kbRow}>
            <Box>
              <Typography variant="subtitle2">{link.name}</Typography>
              <Typography variant="caption" className={classes.meta}>
                {i18n.t("aiAgentProduct.admin.indexedDocs", {
                  count: link.indexedDocuments ?? 0,
                })}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={
                link.enabled
                  ? i18n.t("aiAgentProduct.admin.enabled")
                  : i18n.t("aiAgentProduct.admin.disabled")
              }
            />
          </Box>
        ))
      )}

      <Typography variant="subtitle1" component="h3">
        {i18n.t("aiAgentProduct.admin.availableBases")}
      </Typography>
      {available.length === 0 ? (
        <Typography variant="body2" className={classes.meta}>
          {i18n.t("aiAgentProduct.admin.availableBasesEmpty")}
        </Typography>
      ) : (
        available.map((base) => (
          <FormControlLabel
            key={base.ref}
            control={
              <Checkbox
                checked={selected.includes(String(base.ref))}
                onChange={() => toggle(String(base.ref))}
                disabled={locked}
                color="primary"
                inputProps={{
                  "data-testid": `ai-agent-kb-toggle-${base.ref}`,
                }}
              />
            }
            label={base.name}
          />
        ))
      )}

      <Box className={classes.actions}>
        {!locked ? (
          <AppPrimaryButton
            onClick={handleSave}
            disabled={saving}
            data-testid="ai-agent-knowledge-save"
          >
            {saving
              ? i18n.t("aiAgentProduct.admin.saving")
              : i18n.t("aiAgentProduct.admin.saveLinks")}
          </AppPrimaryButton>
        ) : null}
        <AppNeutralButton
          onClick={() =>
            history.push(
              `${KNOWLEDGE_BASE_ROUTE_PATH}?fromAgent=${encodeURIComponent(
                agentRefKey
              )}`
            )
          }
          data-testid="ai-agent-knowledge-library"
        >
          {i18n.t("aiAgentProduct.admin.openLibrary")}
        </AppNeutralButton>
        <AppNeutralButton
          onClick={() =>
            history.push(aiAgentSectionPath(agentRefKey, "intelligence"))
          }
        >
          {i18n.t("aiAgentProduct.admin.editFaq")}
        </AppNeutralButton>
      </Box>
    </Box>
  );
}

export function AiAgentTestsPanel({ agentRef }) {
  const classes = useStyles();
  const history = useHistory();
  const agentRefKey = String(agentRef || "").trim();
  return (
    <Box className={classes.panel} data-testid="ai-agent-tests-panel">
      <Typography variant="h6" component="h2">
        {i18n.t("aiAgentProduct.admin.sections.tests")}
      </Typography>
      <Typography variant="body2" className={classes.meta}>
        {i18n.t("aiAgentProduct.admin.testsHint")}
      </Typography>
      <AppPrimaryButton
        onClick={() => history.push(aiAgentSimulatorPath(agentRefKey))}
        data-testid="ai-agent-open-simulator"
      >
        {i18n.t("aiAgentProduct.secondary.openSimulator")}
      </AppPrimaryButton>
    </Box>
  );
}

export function AiAgentSettingsPanel({
  summary,
  canMutate,
  onCommand,
  commandBusy,
  onOpenCredentials,
}) {
  const classes = useStyles();
  return (
    <Box className={classes.panel} data-testid="ai-agent-settings-panel">
      <Typography variant="h6" component="h2">
        {i18n.t("aiAgentProduct.admin.sections.settings")}
      </Typography>
      <Typography variant="body2" className={classes.meta}>
        {i18n.t("aiAgentProduct.admin.settingsHint")}
      </Typography>
      <Typography variant="body2">
        {i18n.t("aiAgentProduct.admin.currentMode", {
          mode: summary?.modeMeta?.label || summary?.mode || "—",
        })}
      </Typography>
      <Box className={classes.actions}>
        {canMutate && summary?.status === "active" ? (
          <AppSecondaryButton
            onClick={() => onCommand?.("deactivate")}
            disabled={Boolean(commandBusy)}
          >
            {i18n.t("aiAgentProduct.commands.deactivate")}
          </AppSecondaryButton>
        ) : null}
        {canMutate && summary?.status !== "active" ? (
          <>
            <AppSecondaryButton
              onClick={() => onCommand?.("activate_shadow")}
              disabled={Boolean(commandBusy)}
            >
              {i18n.t("aiAgentProduct.commands.activate_shadow")}
            </AppSecondaryButton>
            <AppSecondaryButton
              onClick={() => onCommand?.("activate_live")}
              disabled={Boolean(commandBusy)}
            >
              {i18n.t("aiAgentProduct.commands.activate_live")}
            </AppSecondaryButton>
          </>
        ) : null}
        <AppNeutralButton onClick={onOpenCredentials}>
          {i18n.t("aiAgentProduct.secondary.manageCredentials")}
        </AppNeutralButton>
      </Box>
      <Typography variant="caption" className={classes.meta}>
        {i18n.t("aiAgentProduct.admin.toolsDeferred")}
      </Typography>
    </Box>
  );
}
