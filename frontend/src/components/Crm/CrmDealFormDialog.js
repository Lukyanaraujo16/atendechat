import React, { useEffect, useState, useMemo, useRef } from "react";
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
import CircularProgress from "@material-ui/core/CircularProgress";
import Grid from "@material-ui/core/Grid";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ButtonWithSpinner from "../ButtonWithSpinner";

const SOURCE_OPTIONS = ["manual", "whatsapp", "instagram", "other"];

export default function CrmDealFormDialog({
  open,
  onClose,
  onSaved,
  dealId = null,
  defaults = {},
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pipelines, setPipelines] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [values, setValues] = useState({
    title: "",
    pipelineId: "",
    stageId: "",
    contactId: "",
    ticketId: "",
    value: "",
    assignedUserId: "",
    expectedCloseAt: "",
    notes: "",
    source: "manual",
  });

  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => String(p.id) === String(values.pipelineId)),
    [pipelines, values.pipelineId]
  );

  const stages = selectedPipeline?.stages || [];

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [plRes, ctRes, usRes] = await Promise.all([
          api.get("/crm/pipelines"),
          api.get("/contacts/list"),
          api.get("/users/list"),
        ]);
        if (cancelled) return;
        setPipelines(Array.isArray(plRes.data) ? plRes.data : []);
        setContacts(Array.isArray(ctRes.data) ? ctRes.data : []);
        setUsers(Array.isArray(usRes.data) ? usRes.data : []);
      } catch (e) {
        if (!cancelled) toastError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (dealId) {
      (async () => {
        try {
          const { data } = await api.get(`/crm/deals/${dealId}`);
          const ec = data.expectedCloseAt
            ? String(data.expectedCloseAt).slice(0, 10)
            : "";
          setValues({
            title: data.title || "",
            pipelineId: data.pipelineId || "",
            stageId: data.stageId || "",
            contactId: data.contactId ?? "",
            ticketId: data.ticketId ?? "",
            value: data.value != null && data.value !== "" ? String(data.value) : "",
            assignedUserId: data.assignedUserId ?? "",
            expectedCloseAt: ec,
            notes: data.notes || "",
            source: data.source || "manual",
          });
        } catch (e) {
          toastError(e);
        }
      })();
      return;
    }
    const d = defaultsRef.current || {};
    const pl = d.pipelineId || "";
    const st = d.stageId || "";
    const ct = d.contactId ?? "";
    const tk = d.ticketId ?? "";
    setValues({
      title: d.title || "",
      pipelineId: pl,
      stageId: st,
      contactId: ct,
      ticketId: tk,
      value: d.value != null ? String(d.value) : "",
      assignedUserId: d.assignedUserId ?? "",
      expectedCloseAt: d.expectedCloseAt || "",
      notes: d.notes || "",
      source: d.source || "manual",
    });
  }, [open, dealId]);

  useEffect(() => {
    if (!open || dealId) return;
    if (!values.pipelineId && pipelines.length) {
      const def =
        pipelines.find((p) => p.isDefault) || pipelines[0];
      if (def) {
        const firstStage = (def.stages && def.stages[0]) || null;
        setValues((v) => ({
          ...v,
          pipelineId: v.pipelineId || def.id,
          stageId: v.stageId || (firstStage ? firstStage.id : ""),
        }));
      }
    }
  }, [open, dealId, pipelines, values.pipelineId]);

  const handleChange = (field) => (e) => {
    const raw = e.target.value;
    setValues((v) => {
      const next = { ...v, [field]: raw };
      if (field === "pipelineId") {
        const p = pipelines.find((x) => String(x.id) === String(raw));
        const first = p?.stages?.[0];
        next.stageId = first ? first.id : "";
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!values.title.trim()) return;
    if (!values.pipelineId || !values.stageId) return;
    setSaving(true);
    try {
      const payload = {
        title: values.title.trim(),
        pipelineId: Number(values.pipelineId),
        stageId: Number(values.stageId),
        contactId: values.contactId === "" ? null : Number(values.contactId),
        ticketId: values.ticketId === "" ? null : Number(values.ticketId),
        value:
          values.value === "" || values.value == null
            ? null
            : Number(String(values.value).replace(",", ".")),
        assignedUserId:
          values.assignedUserId === "" ? null : Number(values.assignedUserId),
        expectedCloseAt: values.expectedCloseAt
          ? new Date(`${values.expectedCloseAt}T12:00:00`).toISOString()
          : null,
        notes: values.notes || null,
        source: values.source || "manual",
      };
      if (dealId) {
        await api.put(`/crm/deals/${dealId}`, payload);
      } else {
        await api.post("/crm/deals", payload);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {dealId
          ? i18n.t("crm.deal.editTitle")
          : i18n.t("crm.deal.newTitle")}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Grid container justifyContent="center" style={{ padding: 24 }}>
            <CircularProgress size={32} />
          </Grid>
        ) : (
          <Grid container spacing={2} style={{ marginTop: 4 }}>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("crm.deal.fields.title")}
                value={values.title}
                onChange={handleChange("title")}
                variant="outlined"
                fullWidth
                required
                margin="dense"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl variant="outlined" fullWidth margin="dense">
                <InputLabel id="crm-pipeline-lbl">
                  {i18n.t("crm.deal.fields.pipeline")}
                </InputLabel>
                <Select
                  labelId="crm-pipeline-lbl"
                  label={i18n.t("crm.deal.fields.pipeline")}
                  value={values.pipelineId}
                  onChange={handleChange("pipelineId")}
                >
                  {pipelines.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl variant="outlined" fullWidth margin="dense">
                <InputLabel id="crm-stage-lbl">
                  {i18n.t("crm.deal.fields.stage")}
                </InputLabel>
                <Select
                  labelId="crm-stage-lbl"
                  label={i18n.t("crm.deal.fields.stage")}
                  value={values.stageId}
                  onChange={handleChange("stageId")}
                >
                  {stages.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl variant="outlined" fullWidth margin="dense">
                <InputLabel id="crm-contact-lbl">
                  {i18n.t("crm.deal.fields.contact")}
                </InputLabel>
                <Select
                  labelId="crm-contact-lbl"
                  label={i18n.t("crm.deal.fields.contact")}
                  value={values.contactId}
                  onChange={handleChange("contactId")}
                >
                  <MenuItem value="">
                    <em>{i18n.t("crm.deal.fields.contactNone")}</em>
                  </MenuItem>
                  {contacts.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name} — {c.number}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("crm.deal.fields.value")}
                value={values.value}
                onChange={handleChange("value")}
                variant="outlined"
                fullWidth
                margin="dense"
                type="number"
                inputProps={{ step: "0.01" }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl variant="outlined" fullWidth margin="dense">
                <InputLabel id="crm-user-lbl">
                  {i18n.t("crm.deal.fields.assignee")}
                </InputLabel>
                <Select
                  labelId="crm-user-lbl"
                  label={i18n.t("crm.deal.fields.assignee")}
                  value={values.assignedUserId}
                  onChange={handleChange("assignedUserId")}
                >
                  <MenuItem value="">
                    <em>{i18n.t("crm.deal.fields.unassigned")}</em>
                  </MenuItem>
                  {users.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl variant="outlined" fullWidth margin="dense">
                <InputLabel id="crm-src-lbl">
                  {i18n.t("crm.deal.fields.source")}
                </InputLabel>
                <Select
                  labelId="crm-src-lbl"
                  label={i18n.t("crm.deal.fields.source")}
                  value={values.source}
                  onChange={handleChange("source")}
                >
                  {SOURCE_OPTIONS.map((s) => (
                    <MenuItem key={s} value={s}>
                      {i18n.t(`crm.deal.source.${s}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("crm.deal.fields.expectedClose")}
                type="date"
                value={values.expectedCloseAt}
                onChange={handleChange("expectedCloseAt")}
                variant="outlined"
                fullWidth
                margin="dense"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("crm.deal.fields.notes")}
                value={values.notes}
                onChange={handleChange("notes")}
                variant="outlined"
                fullWidth
                margin="dense"
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {i18n.t("crm.common.cancel")}
        </Button>
        <ButtonWithSpinner
          loading={saving}
          color="primary"
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
        >
          {i18n.t("crm.common.save")}
        </ButtonWithSpinner>
      </DialogActions>
    </Dialog>
  );
}
