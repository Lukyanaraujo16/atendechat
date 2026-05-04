import React, { useCallback, useEffect, useState } from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import IconButton from "@material-ui/core/IconButton";
import EditIcon from "@material-ui/icons/Edit";
import BlockIcon from "@material-ui/icons/Block";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { getErrorToastOptions } from "../../errors/feedbackToasts";

const FIELD_TYPES = ["text", "number", "currency", "date", "select", "boolean"];

function emptyForm() {
  return {
    label: "",
    type: "text",
    optionsStr: "",
    required: false,
    visibleOnCard: false,
    position: 0,
    active: true,
  };
}

export default function CrmCustomFieldsDialog({
  open,
  onClose,
  pipelineId,
  pipelineName,
  onSaved,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const { data } = await api.get("/crm/custom-fields", {
        params: { pipelineId },
      });
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      setRows(list);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    if (open && pipelineId) {
      load();
    }
  }, [open, pipelineId, load]);

  useEffect(() => {
    if (!open) {
      setEditorOpen(false);
      setEditingId(null);
      setForm(emptyForm());
      setRows([]);
    }
  }, [open]);

  const openCreate = () => {
    setEditingId(null);
    const nextPos =
      rows.length > 0
        ? Math.max(...rows.map((r) => Number(r.position) || 0)) + 1
        : 0;
    setForm({ ...emptyForm(), position: nextPos });
    setEditorOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      label: row.label || "",
      type: row.type || "text",
      optionsStr: Array.isArray(row.options) ? row.options.join("\n") : "",
      required: Boolean(row.required),
      visibleOnCard: Boolean(row.visibleOnCard),
      position: row.position ?? 0,
      active: row.active !== false,
    });
    setEditorOpen(true);
  };

  const parseOptions = () => {
    return form.optionsStr
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
  };

  const handleSaveField = async () => {
    const label = String(form.label || "").trim();
    if (!label) {
      toast.error(i18n.t("crm.customFields.labelRequired"), getErrorToastOptions());
      return;
    }
    if (form.type === "select") {
      const opts = parseOptions();
      if (opts.length < 1) {
        toast.error(i18n.t("crm.customFields.optionsRequired"), getErrorToastOptions());
        return;
      }
    }
    if (!pipelineId) return;
    setSaving(true);
    try {
      const base = {
        label,
        type: form.type,
        required: form.required,
        visibleOnCard: form.visibleOnCard,
        position: Number(form.position) || 0,
      };
      if (editingId) {
        const body = { ...base, active: form.active };
        if (form.type === "select") {
          body.options = parseOptions();
        }
        await api.put(`/crm/custom-fields/${editingId}`, body);
      } else {
        const body = {
          ...base,
          pipelineId: Number(pipelineId),
        };
        if (form.type === "select") {
          body.options = parseOptions();
        }
        await api.post("/crm/custom-fields", body);
      }
      toast.success(i18n.t("crm.customFields.saveSuccess"), getErrorToastOptions());
      setEditorOpen(false);
      await load();
      if (onSaved) onSaved();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (row) => {
    if (
      !window.confirm(i18n.t("crm.customFields.deactivateConfirm", { label: row.label }))
    ) {
      return;
    }
    try {
      await api.delete(`/crm/custom-fields/${row.id}`);
      await load();
      if (onSaved) onSaved();
    } catch (e) {
      toastError(e);
    }
  };

  const subtitle =
    pipelineName && pipelineId
      ? `${pipelineName} (#${pipelineId})`
      : pipelineId
        ? `#${pipelineId}`
        : "";

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>
          {i18n.t("crm.customFields.title")}
          {subtitle ? (
            <Typography variant="caption" color="textSecondary" component="div">
              {subtitle}
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress size={32} />
            </Box>
          ) : rows.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("crm.customFields.listEmpty")}
            </Typography>
          ) : (
            <Box display="flex" flexDirection="column" style={{ gap: 10 }}>
              {rows.map((row) => (
                <Box
                  key={row.id}
                  display="flex"
                  alignItems="flex-start"
                  style={{
                    gap: 8,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <Box flex={1} minWidth={0}>
                    <Typography variant="subtitle2">{row.label}</Typography>
                    <Typography variant="caption" color="textSecondary" display="block">
                      {i18n.t(`crm.customFields.types.${row.type || "text"}`)} ·{" "}
                      {row.key}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block">
                      {[
                        row.required ? i18n.t("crm.customFields.required") : null,
                        row.visibleOnCard ? i18n.t("crm.customFields.visibleOnCard") : null,
                        row.active ? i18n.t("crm.customFields.active") : i18n.t("crm.customFields.inactive"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => openEdit(row)}
                    aria-label={i18n.t("crm.customFields.editField")}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {row.active !== false ? (
                    <IconButton
                      size="small"
                      onClick={() => handleDeactivate(row)}
                      aria-label={i18n.t("crm.customFields.deactivate")}
                    >
                      <BlockIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={openCreate} color="primary" disabled={!pipelineId}>
            {i18n.t("crm.customFields.newField")}
          </Button>
          <Box flex={1} />
          <Button onClick={onClose}>{i18n.t("crm.common.cancel")}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={editorOpen}
        onClose={() => !saving && setEditorOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editingId
            ? i18n.t("crm.customFields.editField")
            : i18n.t("crm.customFields.newField")}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" style={{ gap: 12, marginTop: 8 }}>
            <TextField
              label={i18n.t("crm.customFields.fieldLabel")}
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              variant="outlined"
              fullWidth
              required
              margin="dense"
            />
            <FormControl variant="outlined" fullWidth margin="dense">
              <InputLabel id="cf-type-lbl">{i18n.t("crm.customFields.type")}</InputLabel>
              <Select
                labelId="cf-type-lbl"
                label={i18n.t("crm.customFields.type")}
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value, optionsStr: "" }))
                }
              >
                {FIELD_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {i18n.t(`crm.customFields.types.${t}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {form.type === "select" ? (
              <TextField
                label={i18n.t("crm.customFields.options")}
                value={form.optionsStr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, optionsStr: e.target.value }))
                }
                variant="outlined"
                fullWidth
                margin="dense"
                multiline
                minRows={3}
                helperText={i18n.t("crm.customFields.optionsHint")}
              />
            ) : null}
            <TextField
              label={i18n.t("crm.customFields.position")}
              type="number"
              value={form.position}
              onChange={(e) =>
                setForm((f) => ({ ...f, position: e.target.value }))
              }
              variant="outlined"
              fullWidth
              margin="dense"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.required}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, required: e.target.checked }))
                  }
                  color="primary"
                />
              }
              label={i18n.t("crm.customFields.required")}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.visibleOnCard}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, visibleOnCard: e.target.checked }))
                  }
                  color="primary"
                />
              }
              label={i18n.t("crm.customFields.visibleOnCard")}
            />
            {editingId ? (
              <FormControlLabel
                control={
                  <Switch
                    checked={form.active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, active: e.target.checked }))
                    }
                    color="primary"
                  />
                }
                label={i18n.t("crm.customFields.active")}
              />
            ) : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)} disabled={saving}>
            {i18n.t("crm.common.cancel")}
          </Button>
          <Button
            onClick={handleSaveField}
            color="primary"
            variant="contained"
            disabled={saving}
          >
            {i18n.t("crm.common.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
