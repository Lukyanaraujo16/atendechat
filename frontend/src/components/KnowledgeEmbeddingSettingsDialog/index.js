import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from "@material-ui/core";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import {
  getKnowledgeEmbeddingSettings,
  testKnowledgeEmbeddingSettings,
  updateKnowledgeEmbeddingSettings,
  batchIndexKnowledgeDocuments,
} from "../../services/knowledgeBaseApi";
import { listAiProviderCredentials } from "../../services/aiProviderCredentialApi";

export default function KnowledgeEmbeddingSettingsDialog({
  open,
  onClose,
  outdatedCount = 0,
  onSaved,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [vectorStoreDriver, setVectorStoreDriver] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("text-embedding-3-small");
  const [credentialId, setCredentialId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(120);
  const [minChunkSize, setMinChunkSize] = useState(40);
  const [batchSize, setBatchSize] = useState(16);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [settingsRes, credsRes] = await Promise.all([
          getKnowledgeEmbeddingSettings(),
          listAiProviderCredentials(),
        ]);
        if (cancelled) return;
        const s = settingsRes.data?.settings || {};
        setAvailableModels(settingsRes.data?.availableModels || []);
        setVectorStoreDriver(settingsRes.data?.vectorStoreDriver || "");
        setProvider(s.provider || "openai");
        setModel(s.model || "text-embedding-3-small");
        setCredentialId(s.credentialId || "");
        setEnabled(s.enabled !== false);
        setChunkSize(s.chunkSize || 800);
        setChunkOverlap(s.chunkOverlap || 120);
        setMinChunkSize(s.minChunkSize || 40);
        setBatchSize(s.batchSize || 16);
        setCredentials(credsRes.data || []);
      } catch (err) {
        if (!cancelled) toastError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const modelsForProvider = availableModels.filter((m) => m.provider === provider);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateKnowledgeEmbeddingSettings({
        provider,
        model,
        credentialId: credentialId || null,
        enabled,
        chunkSize: Number(chunkSize),
        chunkOverlap: Number(chunkOverlap),
        minChunkSize: Number(minChunkSize),
        batchSize: Number(batchSize),
      });
      toast.success(i18n.t("knowledgeBase.toasts.settingsSaved"));
      if (res.data?.outdatedMarked > 0) {
        toast.info(
          i18n.t("knowledgeBase.toasts.outdatedMarked", {
            count: res.data.outdatedMarked,
          })
        );
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      const res = await testKnowledgeEmbeddingSettings({
        provider,
        model,
        credentialId: credentialId || null,
      });
      if (res.data?.ok) toast.success(res.data.message);
      else toast.error(res.data?.message || "Falha no teste");
    } catch (err) {
      toastError(err);
    }
  };

  const handleReindexOutdated = async () => {
    if (!outdatedCount) return;
    if (
      !window.confirm(
        i18n.t("knowledgeBase.confirmBatchIndex", { count: outdatedCount })
      )
    ) {
      return;
    }
    try {
      const res = await batchIndexKnowledgeDocuments({
        mode: "outdated",
        confirmCount: outdatedCount,
      });
      toast.success(
        i18n.t("knowledgeBase.toasts.batchQueued", {
          count: res.data?.enqueued || 0,
        })
      );
      if (onSaved) onSaved();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{i18n.t("knowledgeBase.settings.title")}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Typography>{i18n.t("knowledgeBase.settings.loading")}</Typography>
        ) : (
          <>
            <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
              {i18n.t("knowledgeBase.settings.vectorStore")}: {vectorStoreDriver || "—"}
            </Typography>
            <FormControl fullWidth margin="dense" variant="outlined">
              <InputLabel>Provider</InputLabel>
              <Select
                value={provider}
                label="Provider"
                onChange={(e) => {
                  setProvider(e.target.value);
                  const first = availableModels.find(
                    (m) => m.provider === e.target.value
                  );
                  if (first) setModel(first.model);
                }}
              >
                <MenuItem value="openai">OpenAI</MenuItem>
                <MenuItem value="gemini">Gemini</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense" variant="outlined">
              <InputLabel>{i18n.t("knowledgeBase.settings.model")}</InputLabel>
              <Select
                value={model}
                label={i18n.t("knowledgeBase.settings.model")}
                onChange={(e) => setModel(e.target.value)}
              >
                {modelsForProvider.map((m) => (
                  <MenuItem key={m.model} value={m.model}>
                    {m.model} ({m.dimensions}d)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense" variant="outlined">
              <InputLabel>{i18n.t("knowledgeBase.settings.credential")}</InputLabel>
              <Select
                value={credentialId}
                label={i18n.t("knowledgeBase.settings.credential")}
                onChange={(e) => setCredentialId(e.target.value)}
              >
                <MenuItem value="">—</MenuItem>
                {credentials
                  .filter((c) => c.provider === provider && c.enabled)
                  .map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name || `#${c.id}`} ({c.maskedKey})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <TextField
              margin="dense"
              fullWidth
              type="number"
              label={i18n.t("knowledgeBase.settings.chunkSize")}
              value={chunkSize}
              onChange={(e) => setChunkSize(e.target.value)}
            />
            <TextField
              margin="dense"
              fullWidth
              type="number"
              label={i18n.t("knowledgeBase.settings.chunkOverlap")}
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(e.target.value)}
            />
            <TextField
              margin="dense"
              fullWidth
              type="number"
              label={i18n.t("knowledgeBase.settings.minChunkSize")}
              value={minChunkSize}
              onChange={(e) => setMinChunkSize(e.target.value)}
            />
            <TextField
              margin="dense"
              fullWidth
              type="number"
              label={i18n.t("knowledgeBase.settings.batchSize")}
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  color="primary"
                />
              }
              label={i18n.t("knowledgeBase.settings.enabled")}
            />
            {outdatedCount > 0 ? (
              <Typography variant="body2" color="secondary" style={{ marginTop: 8 }}>
                {i18n.t("knowledgeBase.settings.outdatedWarning", {
                  count: outdatedCount,
                })}
              </Typography>
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleTest} disabled={loading || saving}>
          {i18n.t("knowledgeBase.buttons.testCredential")}
        </Button>
        {outdatedCount > 0 ? (
          <Button onClick={handleReindexOutdated} color="secondary">
            {i18n.t("knowledgeBase.buttons.reindexOutdated")}
          </Button>
        ) : null}
        <Button onClick={onClose}>{i18n.t("knowledgeBase.buttons.cancel")}</Button>
        <Button
          color="primary"
          variant="contained"
          onClick={handleSave}
          disabled={loading || saving}
        >
          {i18n.t("knowledgeBase.buttons.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
