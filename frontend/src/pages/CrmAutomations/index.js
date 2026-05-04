import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import IconButton from "@material-ui/core/IconButton";
import Divider from "@material-ui/core/Divider";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    maxWidth: 1100,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  suggestionPaper: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  suggestionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
    marginTop: theme.spacing(1),
  },
}));

function defaultForm() {
  return {
    id: null,
    name: "",
    enabled: true,
    triggerType: "stage_changed",
    triggerConfig: { stageId: "", days: 2, priority: "" },
    actionType: "create_follow_up",
    actionConfig: { days: 1, note: "", reason: "" },
  };
}

function buildPayload(form) {
  const triggerConfig = {};
  if (form.triggerType === "stage_changed") {
    triggerConfig.stageId = Number(form.triggerConfig.stageId);
  }
  if (form.triggerType === "stale_for_days") {
    triggerConfig.days = Math.max(1, Number(form.triggerConfig.days) || 1);
    if (form.triggerConfig.stageId !== "" && form.triggerConfig.stageId != null) {
      triggerConfig.stageId = Number(form.triggerConfig.stageId);
    }
    const pr = String(form.triggerConfig.priority || "").trim();
    if (pr) triggerConfig.priority = pr;
  }
  if (form.triggerType === "priority_changed") {
    const pr = String(form.triggerConfig.priority || "").trim();
    if (pr) triggerConfig.priority = pr;
  }

  const actionConfig = {};
  if (form.actionType === "create_follow_up") {
    actionConfig.days = Math.max(0, Number(form.actionConfig.days) || 0);
    const note = String(form.actionConfig.note || "").trim();
    if (note) actionConfig.note = note;
  }
  if (form.actionType === "mark_attention") {
    const reason = String(form.actionConfig.reason || "").trim();
    if (reason) actionConfig.reason = reason;
  }

  return {
    name: String(form.name || "").trim(),
    enabled: form.enabled !== false,
    triggerType: form.triggerType,
    triggerConfig,
    actionType: form.actionType,
    actionConfig,
  };
}

export default function CrmAutomationsPage() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const canEdit = user?.profile === "admin" || user?.supportMode === true;

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const stageOptions = useMemo(() => {
    const out = [];
    (pipelines || []).forEach((p) => {
      (p.stages || []).forEach((s) => {
        out.push({
          id: s.id,
          label: `${p.name} — ${s.name}`,
        });
      });
    });
    return out;
  }, [pipelines]);

  const actionChoices = useMemo(() => {
    if (form.triggerType === "stale_for_days") {
      return ["mark_attention", "notify_user"];
    }
    return ["create_follow_up", "mark_attention", "notify_user"];
  }, [form.triggerType]);

  const triggerLabel = (t) =>
    i18n.t(`crm.automation.triggers.${t}`, { defaultValue: t });
  const actionLabel = (a) =>
    i18n.t(`crm.automation.actions.${a}`, { defaultValue: a });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([
        api.get("/crm/automation-rules"),
        api.get("/crm/pipelines"),
      ]);
      setRules(Array.isArray(rRes.data) ? rRes.data : []);
      setPipelines(Array.isArray(pRes.data) ? pRes.data : []);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openNew = () => {
    setForm(defaultForm());
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    const tc = row.triggerConfig || {};
    const ac = row.actionConfig || {};
    setForm({
      id: row.id,
      name: row.name || "",
      enabled: row.enabled !== false,
      triggerType: row.triggerType || "stage_changed",
      triggerConfig: {
        stageId: tc.stageId != null ? String(tc.stageId) : "",
        days: tc.days != null ? Number(tc.days) : 2,
        priority: tc.priority != null ? String(tc.priority) : "",
      },
      actionType: row.actionType || "notify_user",
      actionConfig: {
        days: ac.days != null ? Number(ac.days) : 1,
        note: ac.note != null ? String(ac.note) : "",
        reason: ac.reason != null ? String(ac.reason) : "",
      },
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
  };

  const saveRule = async () => {
    if (!canEdit) return;
    if (form.triggerType === "stage_changed") {
      const sid = Number(form.triggerConfig.stageId);
      if (!Number.isFinite(sid)) {
        toastError(new Error(i18n.t("crm.automation.validationStage")));
        return;
      }
    }
    const effectiveAction = actionChoices.includes(form.actionType)
      ? form.actionType
      : actionChoices[0];
    const payload = buildPayload({ ...form, actionType: effectiveAction });
    if (!payload.name) {
      toastError(new Error(i18n.t("crm.automation.validationName")));
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/crm/automation-rules/${form.id}`, payload);
      } else {
        await api.post("/crm/automation-rules", payload);
      }
      setDialogOpen(false);
      await loadAll();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (row) => {
    if (!canEdit) return;
    if (!window.confirm(i18n.t("crm.automation.deleteConfirm"))) return;
    try {
      await api.delete(`/crm/automation-rules/${row.id}`);
      await loadAll();
    } catch (e) {
      toastError(e);
    }
  };

  const applySuggestion = (kind) => {
    const base = defaultForm();
    if (kind === "stage_followup") {
      base.name = "Follow-up após etapa";
      base.triggerType = "stage_changed";
      base.triggerConfig.stageId =
        stageOptions[0] != null ? String(stageOptions[0].id) : "";
      base.actionType = "create_follow_up";
      base.actionConfig.days = 1;
      base.actionConfig.note = "Entrar em contacto novamente";
    } else if (kind === "stale_attention") {
      base.name = "Parado — atenção";
      base.triggerType = "stale_for_days";
      base.triggerConfig.days = 3;
      base.actionType = "mark_attention";
    } else if (kind === "urgent_notify") {
      base.name = "Prioridade urgente";
      base.triggerType = "priority_changed";
      base.triggerConfig.priority = "urgent";
      base.actionType = "notify_user";
    }
    setForm(base);
    setDialogOpen(true);
  };

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        <Button component={Link} to="/crm" variant="outlined">
          {i18n.t("crm.automation.backToBoard")}
        </Button>
        <Typography variant="h5" style={{ fontWeight: 600, flex: "1 1 auto" }}>
          {i18n.t("crm.automation.title")}
        </Typography>
        {canEdit ? (
          <Button color="primary" variant="contained" onClick={openNew}>
            {i18n.t("crm.automation.addRule")}
          </Button>
        ) : null}
      </Box>

      {!canEdit ? (
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("crm.automation.readOnlyHint")}
        </Typography>
      ) : null}

      <Paper className={classes.suggestionPaper} elevation={0} variant="outlined">
        <Typography variant="subtitle2">{i18n.t("crm.automation.suggestions.title")}</Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {i18n.t("crm.automation.suggestions.intro")}
        </Typography>
        <Box className={classes.suggestionRow}>
          <Button size="small" variant="outlined" onClick={() => applySuggestion("stage_followup")}>
            {i18n.t("crm.automation.suggestions.stageFollowup")} — {i18n.t("crm.automation.suggestions.use")}
          </Button>
          <Button size="small" variant="outlined" onClick={() => applySuggestion("stale_attention")}>
            {i18n.t("crm.automation.suggestions.staleAttention")} — {i18n.t("crm.automation.suggestions.use")}
          </Button>
          <Button size="small" variant="outlined" onClick={() => applySuggestion("urgent_notify")}>
            {i18n.t("crm.automation.suggestions.urgentNotify")} — {i18n.t("crm.automation.suggestions.use")}
          </Button>
        </Box>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={36} />
        </Box>
      ) : (
        <Paper variant="outlined">
          <Box px={2} pt={2}>
            <Typography variant="subtitle1">{i18n.t("crm.automation.listTitle")}</Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{i18n.t("crm.automation.name")}</TableCell>
                <TableCell>{i18n.t("crm.automation.trigger")}</TableCell>
                <TableCell>{i18n.t("crm.automation.action")}</TableCell>
                <TableCell>{i18n.t("crm.automation.enabled")}</TableCell>
                <TableCell align="right">{i18n.t("crm.automation.actionsCol")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!rules.length ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="textSecondary">
                      {i18n.t("crm.automation.empty")}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{triggerLabel(r.triggerType)}</TableCell>
                    <TableCell>{actionLabel(r.actionType)}</TableCell>
                    <TableCell>{r.enabled === false ? "—" : "✓"}</TableCell>
                    <TableCell align="right">
                      {canEdit ? (
                        <>
                          <IconButton size="small" onClick={() => openEdit(r)} aria-label="edit">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => deleteRule(r)} aria-label="delete">
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? i18n.t("crm.automation.editRule") : i18n.t("crm.automation.addRule")}</DialogTitle>
        <DialogContent>
          <TextField
            label={i18n.t("crm.automation.name")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            fullWidth
            margin="normal"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.enabled !== false}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                color="primary"
              />
            }
            label={i18n.t("crm.automation.enabled")}
          />
          <TextField
            select
            label={i18n.t("crm.automation.trigger")}
            value={form.triggerType}
            onChange={(e) => {
              const v = e.target.value;
              setForm((f) => {
                let actionType = f.actionType;
                if (v === "stale_for_days" && actionType === "create_follow_up") {
                  actionType = "mark_attention";
                }
                return { ...f, triggerType: v, actionType };
              });
            }}
            fullWidth
            margin="normal"
          >
            <MenuItem value="stage_changed">{triggerLabel("stage_changed")}</MenuItem>
            <MenuItem value="stale_for_days">{triggerLabel("stale_for_days")}</MenuItem>
            <MenuItem value="priority_changed">{triggerLabel("priority_changed")}</MenuItem>
          </TextField>

          {form.triggerType === "stage_changed" ? (
            <TextField
              select
              label={i18n.t("crm.automation.fields.stageId")}
              value={form.triggerConfig.stageId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  triggerConfig: { ...f.triggerConfig, stageId: e.target.value },
                }))
              }
              fullWidth
              margin="normal"
            >
              {stageOptions.map((o) => (
                <MenuItem key={o.id} value={String(o.id)}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          {form.triggerType === "stale_for_days" ? (
            <>
              <TextField
                label={i18n.t("crm.automation.fields.daysStale")}
                type="number"
                inputProps={{ min: 1, max: 365 }}
                value={form.triggerConfig.days}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    triggerConfig: {
                      ...f.triggerConfig,
                      days: Number(e.target.value),
                    },
                  }))
                }
                fullWidth
                margin="normal"
              />
              <TextField
                select
                label={`${i18n.t("crm.automation.fields.stageId")} (${i18n.t("crm.filters.all")})`}
                value={form.triggerConfig.stageId === "" ? "" : String(form.triggerConfig.stageId)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    triggerConfig: {
                      ...f.triggerConfig,
                      stageId: e.target.value,
                    },
                  }))
                }
                fullWidth
                margin="normal"
              >
                <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
                {stageOptions.map((o) => (
                  <MenuItem key={o.id} value={String(o.id)}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={`${i18n.t("crm.filters.priority")} (${i18n.t("crm.filters.all")})`}
                value={form.triggerConfig.priority || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    triggerConfig: {
                      ...f.triggerConfig,
                      priority: e.target.value,
                    },
                  }))
                }
                fullWidth
                margin="normal"
              >
                <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
                <MenuItem value="low">{i18n.t("crm.priority.low")}</MenuItem>
                <MenuItem value="medium">{i18n.t("crm.priority.medium")}</MenuItem>
                <MenuItem value="high">{i18n.t("crm.priority.high")}</MenuItem>
                <MenuItem value="urgent">{i18n.t("crm.priority.urgent")}</MenuItem>
              </TextField>
            </>
          ) : null}

          {form.triggerType === "priority_changed" ? (
            <TextField
              select
              label={i18n.t("crm.automation.fields.priorityTrigger")}
              value={form.triggerConfig.priority || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  triggerConfig: {
                    ...f.triggerConfig,
                    priority: e.target.value,
                  },
                }))
              }
              fullWidth
              margin="normal"
            >
              <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
              <MenuItem value="low">{i18n.t("crm.priority.low")}</MenuItem>
              <MenuItem value="medium">{i18n.t("crm.priority.medium")}</MenuItem>
              <MenuItem value="high">{i18n.t("crm.priority.high")}</MenuItem>
              <MenuItem value="urgent">{i18n.t("crm.priority.urgent")}</MenuItem>
            </TextField>
          ) : null}

          <Divider style={{ margin: "16px 0" }} />

          <TextField
            select
            label={i18n.t("crm.automation.action")}
            value={actionChoices.includes(form.actionType) ? form.actionType : actionChoices[0]}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                actionType: e.target.value,
              }))
            }
            fullWidth
            margin="normal"
          >
            {actionChoices.map((a) => (
              <MenuItem key={a} value={a}>
                {actionLabel(a)}
              </MenuItem>
            ))}
          </TextField>

          {form.actionType === "create_follow_up" ? (
            <>
              <TextField
                label={i18n.t("crm.automation.fields.daysFollowUp")}
                type="number"
                inputProps={{ min: 0, max: 365 }}
                value={form.actionConfig.days}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    actionConfig: {
                      ...f.actionConfig,
                      days: Number(e.target.value),
                    },
                  }))
                }
                fullWidth
                margin="normal"
              />
              <TextField
                label={i18n.t("crm.automation.fields.noteFollowUp")}
                value={form.actionConfig.note}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    actionConfig: {
                      ...f.actionConfig,
                      note: e.target.value,
                    },
                  }))
                }
                fullWidth
                margin="normal"
                multiline
                minRows={2}
              />
            </>
          ) : null}

          {form.actionType === "mark_attention" ? (
            <TextField
              label={i18n.t("crm.automation.fields.attentionReason")}
              value={form.actionConfig.reason}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  actionConfig: {
                    ...f.actionConfig,
                    reason: e.target.value,
                  },
                }))
              }
              fullWidth
              margin="normal"
              helperText={i18n.t("crm.automation.markAttentionHelper")}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            {i18n.t("crm.common.cancel")}
          </Button>
          <Button color="primary" variant="contained" onClick={saveRule} disabled={saving || !canEdit}>
            {i18n.t("crm.common.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
