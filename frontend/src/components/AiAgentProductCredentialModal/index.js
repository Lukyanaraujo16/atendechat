import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Checkbox from "@material-ui/core/Checkbox";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormControl from "@material-ui/core/FormControl";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Paper from "@material-ui/core/Paper";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import Alert from "@material-ui/lab/Alert";
import { makeStyles } from "@material-ui/core/styles";
import {
  AppDialog,
  AppDialogActions,
  AppDialogContent,
  AppDialogTitle,
} from "../../ui";
import {
  createAiAgentProductCredential,
  disableAiAgentProductCredential,
  enableAiAgentProductCredential,
  getAiAgentProductCredential,
  listAiAgentProductCredentials,
  testAiAgentProductCredential,
  updateAiAgentProductCredential,
} from "../../services/aiAgentProductApi";
import { i18n } from "../../translate/i18n";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
];

const emptyForm = (provider = "") => ({
  name: "",
  provider: provider || "",
  apiKey: "",
  isDefault: false,
});

const useStyles = makeStyles((theme) => ({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  card: {
    padding: theme.spacing(2),
  },
}));

function credentialRefOf(credential) {
  return credential?.credentialRef || credential?.ref || null;
}

function credentialFromResponse(response) {
  return response?.credential || response?.data?.credential || response;
}

function credentialsFromResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.credentials)) return response.credentials;
  if (Array.isArray(response?.data?.credentials)) return response.data.credentials;
  return [];
}

function errorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    i18n.t("aiAgentProduct.credentials.errors.generic")
  );
}

export default function AiAgentProductCredentialModal({
  open,
  onClose,
  onSuccess,
  initialCredentialRef = null,
  preferredProvider = "",
  mode = "manage",
}) {
  const classes = useStyles();
  const [credentials, setCredentials] = useState([]);
  const [view, setView] = useState("list");
  const [editingRef, setEditingRef] = useState(null);
  const [form, setForm] = useState(() => emptyForm(preferredProvider));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingRef, setTestingRef] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listAiAgentProductCredentials();
      setCredentials(credentialsFromResponse(response));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const openCreate = useCallback(() => {
    setEditingRef(null);
    setForm(emptyForm(preferredProvider));
    setTestResult(null);
    setError("");
    setView("form");
  }, [preferredProvider]);

  const openEdit = useCallback(async (credentialRef) => {
    setLoading(true);
    setError("");
    setTestResult(null);
    try {
      const response = await getAiAgentProductCredential(credentialRef);
      const credential = credentialFromResponse(response);
      setEditingRef(credentialRef);
      setForm({
        name: credential?.name || "",
        provider: credential?.provider || "",
        apiKey: "",
        isDefault: credential?.isDefault === true,
      });
      setView("form");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setCredentials([]);
    setDisableTarget(null);
    setTestResult(null);
    setError("");
    if (initialCredentialRef) {
      openEdit(initialCredentialRef);
    } else if (mode === "create") {
      openCreate();
    } else {
      setView("list");
      loadList();
    }
  }, [
    initialCredentialRef,
    loadList,
    mode,
    open,
    openCreate,
    openEdit,
  ]);

  const notifySuccess = async (response, fallbackRef) => {
    const credential = credentialFromResponse(response);
    const credentialRef = credentialRefOf(credential) || fallbackRef;
    if (onSuccess) await onSuccess({ credentialRef, credential });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.provider || (!editingRef && !form.apiKey.trim())) {
      setError(i18n.t("aiAgentProduct.credentials.errors.required"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        provider: form.provider,
        isDefault: form.isDefault,
      };
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
      const response = editingRef
        ? await updateAiAgentProductCredential(editingRef, payload)
        : await createAiAgentProductCredential(payload);
      setForm((current) => ({ ...current, apiKey: "" }));
      await notifySuccess(response, editingRef);
      if (mode === "create") {
        onClose();
      } else {
        setView("list");
        setEditingRef(null);
        await loadList();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (credentialRef) => {
    setTestingRef(credentialRef);
    setTestResult(null);
    setError("");
    try {
      const response = await testAiAgentProductCredential(credentialRef);
      setTestResult({
        credentialRef,
        success: response?.success !== false && response?.valid !== false,
        message: response?.message,
      });
    } catch (err) {
      setTestResult({
        credentialRef,
        success: false,
        message: errorMessage(err),
      });
    } finally {
      setTestingRef(null);
    }
  };

  const handleEnable = async (credentialRef) => {
    setSaving(true);
    setError("");
    try {
      const response = await enableAiAgentProductCredential(credentialRef);
      await notifySuccess(response, credentialRef);
      await loadList();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    const credentialRef = credentialRefOf(disableTarget);
    if (!credentialRef) return;
    setSaving(true);
    setError("");
    try {
      const response = await disableAiAgentProductCredential(credentialRef);
      setDisableTarget(null);
      await notifySuccess(response, credentialRef);
      await loadList();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const renderForm = () => (
    <Box className={classes.stack}>
      <TextField
        label={i18n.t("aiAgentProduct.credentials.fields.name")}
        value={form.name}
        onChange={(event) =>
          setForm((current) => ({ ...current, name: event.target.value }))
        }
        variant="outlined"
        fullWidth
        required
      />
      <FormControl variant="outlined" fullWidth required>
        <InputLabel>{i18n.t("aiAgentProduct.credentials.fields.provider")}</InputLabel>
        <Select
          value={form.provider}
          onChange={(event) =>
            setForm((current) => ({ ...current, provider: event.target.value }))
          }
          label={i18n.t("aiAgentProduct.credentials.fields.provider")}
        >
          {PROVIDERS.map((provider) => (
            <MenuItem key={provider.value} value={provider.value}>
              {provider.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label={i18n.t("aiAgentProduct.credentials.fields.apiKey")}
        value={form.apiKey}
        onChange={(event) =>
          setForm((current) => ({ ...current, apiKey: event.target.value }))
        }
        variant="outlined"
        fullWidth
        required={!editingRef}
        type="password"
        autoComplete="new-password"
        helperText={
          editingRef
            ? i18n.t("aiAgentProduct.credentials.fields.keepKey")
            : undefined
        }
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={form.isDefault}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isDefault: event.target.checked,
              }))
            }
            color="primary"
          />
        }
        label={i18n.t("aiAgentProduct.credentials.fields.isDefault")}
      />
    </Box>
  );

  const renderList = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      );
    }
    if (!credentials.length) {
      return (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={openCreate}
              data-testid="ai-agent-product-credential-add"
            >
              {i18n.t("aiAgentProduct.credentials.actions.add")}
            </Button>
          }
        >
          {i18n.t("aiAgentProduct.credentials.empty")}
        </Alert>
      );
    }
    return (
      <Box className={classes.stack}>
        {credentials.map((credential) => {
          const credentialRef = credentialRefOf(credential);
          const enabled = credential.enabled !== false;
          const result =
            testResult?.credentialRef === credentialRef ? testResult : null;
          return (
            <Paper key={credentialRef} variant="outlined" className={classes.card}>
              <Box className={classes.row}>
                <Box>
                  <Typography variant="subtitle1">{credential.name}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {credential.provider}
                    {credential.maskedKey ? ` · ${credential.maskedKey}` : ""}
                    {credential.isDefault
                      ? ` · ${i18n.t("aiAgentProduct.credentials.defaultBadge")}`
                      : ""}
                  </Typography>
                </Box>
                <Typography variant="caption" color="textSecondary">
                  {i18n.t(
                    enabled
                      ? "aiAgentProduct.credentials.status.enabled"
                      : "aiAgentProduct.credentials.status.disabled"
                  )}
                </Typography>
              </Box>
              <Box className={classes.actions} mt={2}>
                <Button size="small" onClick={() => openEdit(credentialRef)}>
                  {i18n.t("aiAgentProduct.credentials.actions.edit")}
                </Button>
                <Button
                  size="small"
                  onClick={() => handleTest(credentialRef)}
                  disabled={testingRef === credentialRef || saving}
                  data-testid="ai-agent-product-credential-test"
                >
                  {testingRef === credentialRef
                    ? i18n.t("aiAgentProduct.credentials.actions.testing")
                    : i18n.t("aiAgentProduct.credentials.actions.test")}
                </Button>
                {enabled ? (
                  <Button
                    size="small"
                    color="secondary"
                    onClick={() => setDisableTarget(credential)}
                    disabled={saving}
                    data-testid="ai-agent-product-credential-disable"
                  >
                    {i18n.t("aiAgentProduct.credentials.actions.disable")}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    color="primary"
                    onClick={() => handleEnable(credentialRef)}
                    disabled={saving}
                    data-testid="ai-agent-product-credential-enable"
                  >
                    {i18n.t("aiAgentProduct.credentials.actions.enable")}
                  </Button>
                )}
              </Box>
              {result ? (
                <Alert severity={result.success ? "success" : "error"}>
                  {result.message ||
                    i18n.t(
                      result.success
                        ? "aiAgentProduct.credentials.test.success"
                        : "aiAgentProduct.credentials.test.failure"
                    )}
                </Alert>
              ) : null}
            </Paper>
          );
        })}
      </Box>
    );
  };

  return (
    <AppDialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      data-testid="ai-agent-product-credential-modal"
    >
      <AppDialogTitle
        subtitle={i18n.t("aiAgentProduct.credentials.subtitle")}
      >
        {i18n.t("aiAgentProduct.credentials.title")}
      </AppDialogTitle>
      <AppDialogContent>
        <Box className={classes.stack}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {disableTarget ? (
            <Alert
              severity="warning"
              action={
                <Box className={classes.actions}>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => setDisableTarget(null)}
                    disabled={saving}
                  >
                    {i18n.t("aiAgentProduct.credentials.actions.cancel")}
                  </Button>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={handleDisable}
                    disabled={saving}
                  >
                    {i18n.t("aiAgentProduct.credentials.confirmDisable.action")}
                  </Button>
                </Box>
              }
            >
              {i18n.t("aiAgentProduct.credentials.confirmDisable.message", {
                name: disableTarget.name,
              })}
            </Alert>
          ) : null}
          {view === "form" ? renderForm() : renderList()}
        </Box>
      </AppDialogContent>
      <AppDialogActions>
        {view === "list" && credentials.length ? (
          <Button
            color="primary"
            onClick={openCreate}
            disabled={saving}
            data-testid="ai-agent-product-credential-add"
          >
            {i18n.t("aiAgentProduct.credentials.actions.add")}
          </Button>
        ) : null}
        {view === "form" && mode === "manage" && !initialCredentialRef ? (
          <Button onClick={() => setView("list")} disabled={saving}>
            {i18n.t("aiAgentProduct.credentials.actions.back")}
          </Button>
        ) : null}
        <Button onClick={onClose} disabled={saving}>
          {i18n.t("aiAgentProduct.credentials.actions.close")}
        </Button>
        {view === "form" ? (
          <Button
            color="primary"
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            data-testid="ai-agent-product-credential-save"
          >
            {saving
              ? i18n.t("aiAgentProduct.credentials.actions.saving")
              : i18n.t("aiAgentProduct.credentials.actions.save")}
          </Button>
        ) : null}
      </AppDialogActions>
    </AppDialog>
  );
}
