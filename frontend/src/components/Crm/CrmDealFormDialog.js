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
import Box from "@material-ui/core/Box";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import { format, formatDistanceToNow } from "date-fns";
import { enUS, es, ptBR } from "date-fns/locale";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { getErrorToastOptions } from "../../errors/feedbackToasts";
import ButtonWithSpinner from "../ButtonWithSpinner";

const SOURCE_OPTIONS = ["manual", "whatsapp", "instagram", "other"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

function parseTagsInput(str) {
  if (!str || !String(str).trim()) return [];
  return String(str)
    .split(/[,;]+/)
    .map((s) => s.trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, 10);
}

function formatTagsForInput(arr) {
  if (!Array.isArray(arr) || !arr.length) return "";
  return arr.join(", ");
}

function buildDealCustomFieldsPayload(defs, vals) {
  const o = {};
  for (const f of defs) {
    const raw = vals[f.key];
    if (f.type === "boolean") {
      o[f.key] = Boolean(raw);
      continue;
    }
    if (f.type === "number" || f.type === "currency") {
      if (raw === "" || raw == null) continue;
      const n = Number(String(raw).replace(",", "."));
      if (!Number.isFinite(n)) continue;
      o[f.key] = n;
      continue;
    }
    if (f.type === "date") {
      if (!raw || !String(raw).trim()) continue;
      o[f.key] = String(raw).trim().slice(0, 10);
      continue;
    }
    if (raw != null && String(raw).trim() !== "") {
      o[f.key] = String(raw).trim();
    }
  }
  return o;
}

function validateDealCustomFieldsClient(defs, vals) {
  for (const f of defs) {
    const v = vals[f.key];
    if (f.required) {
      if (f.type === "boolean") {
        if (v !== true && v !== false) {
          return i18n.t("crm.customFields.fieldRequiredNamed", { field: f.label });
        }
      } else if (v === "" || v == null) {
        return i18n.t("crm.customFields.fieldRequiredNamed", { field: f.label });
      }
    }
    if (v === "" || v == null) continue;
    if (f.type === "number" || f.type === "currency") {
      const n = Number(String(v).replace(",", "."));
      if (!Number.isFinite(n)) {
        return i18n.t("crm.customFields.invalidValue");
      }
    }
    if (f.type === "date") {
      const d = new Date(`${String(v).slice(0, 10)}T12:00:00`);
      if (Number.isNaN(d.getTime())) {
        return i18n.t("crm.customFields.invalidValue");
      }
    }
    if (f.type === "select") {
      const opts = Array.isArray(f.options) ? f.options : [];
      if (!opts.includes(String(v))) {
        return i18n.t("crm.customFields.invalidValue");
      }
    }
  }
  return null;
}

function dateToDatetimeLocalInput(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  return dateToDatetimeLocalInput(new Date(iso));
}

function datetimeLocalToIso(local) {
  if (!local || !String(local).trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function dateFnsLocale() {
  const lang = (i18n.language || "pt").toLowerCase();
  if (lang.startsWith("es")) return es;
  if (lang.startsWith("en")) return enUS;
  return ptBR;
}

function formatStageDurationMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  const h = Math.floor(n / 3600000);
  const m = Math.floor((n % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatCrmActivitySummary(row) {
  const meta = row.metadata || {};
  const type = String(row.type || "");
  const loc = dateFnsLocale();
  const actor =
    row.actor && row.actor.name
      ? ` ${i18n.t("crm.history.actorLine", { name: row.actor.name })}`
      : "";

  if (type === "created") {
    return i18n.t("crm.history.types.created") + actor;
  }
  if (type === "updated") {
    return i18n.t("crm.history.types.updated") + actor;
  }
  if (type === "stage_changed") {
    return (
      i18n.t("crm.history.types.stage_changed", {
        from: meta.fromStageName || meta.fromStageId || "—",
        to: meta.toStageName || meta.toStageId || "—",
      }) + actor
    );
  }
  if (type === "priority_changed") {
    const fromP = meta.from ? i18n.t(`crm.priority.${meta.from}`) : "—";
    const toP = meta.to ? i18n.t(`crm.priority.${meta.to}`) : "—";
    return i18n.t("crm.history.types.priority_changed", { from: fromP, to: toP }) + actor;
  }
  if (type === "follow_up_set") {
    let extra = "";
    if (meta.at) {
      try {
        extra = ` (${format(new Date(meta.at), "Pp", { locale: loc })})`;
      } catch (e) {
        extra = "";
      }
    }
    return i18n.t("crm.history.types.follow_up_set") + extra + actor;
  }
  if (type === "follow_up_cleared") {
    return i18n.t("crm.history.types.follow_up_cleared") + actor;
  }
  if (type === "attention_marked") {
    return i18n.t("crm.history.types.attention_marked") + actor;
  }
  if (type === "attention_resolved") {
    return i18n.t("crm.history.types.attention_resolved") + actor;
  }
  if (type === "comment") {
    const text = row.description ? String(row.description) : "";
    return `${i18n.t("crm.history.types.comment")}: ${text}${actor}`;
  }
  if (type === "automation_triggered") {
    return (
      i18n.t("crm.history.types.automation_triggered", {
        rule: meta.ruleName || "",
      }) + actor
    );
  }
  if (type === "custom_fields_updated") {
    if (meta.summary) {
      return i18n.t("crm.history.types.custom_fields_updated_simple") + actor;
    }
    if (Array.isArray(meta.changes) && meta.changes.length) {
      const parts = meta.changes.map((c) => c.label || c.key).join(", ");
      return (
        i18n.t("crm.history.types.custom_fields_updated_detail", {
          fields: parts,
        }) + actor
      );
    }
    return i18n.t("crm.history.types.custom_fields_updated_simple") + actor;
  }
  return type + actor;
}

export default function CrmDealFormDialog({
  open,
  onClose,
  onSaved,
  dealId = null,
  defaults = {},
  terminology = null,
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
    priority: "medium",
    tagsInput: "",
    nextFollowUpLocal: "",
    followUpNote: "",
  });
  const [dealHasAttention, setDealHasAttention] = useState(false);
  const [tab, setTab] = useState(0);
  const [timeline, setTimeline] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [customValues, setCustomValues] = useState({});
  const [dealFetchKey, setDealFetchKey] = useState(0);
  const dealCustomSnapshotRef = useRef({});

  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => String(p.id) === String(values.pipelineId)),
    [pipelines, values.pipelineId]
  );

  const stages = selectedPipeline?.stages || [];

  const dialogTitle = useMemo(() => {
    if (!terminology) {
      return dealId ? i18n.t("crm.deal.editTitle") : i18n.t("crm.deal.newTitle");
    }
    if (dealId) {
      return i18n.t("crm.deal.editItem", { item: terminology.itemSingular });
    }
    return terminology.createButton;
  }, [dealId, terminology]);

  useEffect(() => {
    if (!open) {
      setTab(0);
      setTimeline(null);
      setCommentText("");
      setCustomFieldDefs([]);
      setCustomValues({});
      dealCustomSnapshotRef.current = {};
      setDealFetchKey(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !values.pipelineId) {
      setCustomFieldDefs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/crm/custom-fields", {
          params: { pipelineId: values.pipelineId },
        });
        if (cancelled) return;
        const list = Array.isArray(data) ? data.filter((x) => x.active) : [];
        setCustomFieldDefs(list);
      } catch (e) {
        if (!cancelled) toastError(e);
        if (!cancelled) setCustomFieldDefs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, values.pipelineId]);

  useEffect(() => {
    if (!open) return;
    const snap = dealCustomSnapshotRef.current || {};
    const next = {};
    for (const f of customFieldDefs) {
      const v = snap[f.key];
      if (f.type === "boolean") {
        next[f.key] = v === true || v === "true" || v === 1;
      } else if (v != null && v !== "") {
        next[f.key] =
          f.type === "date" ? String(v).slice(0, 10) : String(v);
      } else {
        next[f.key] = "";
      }
    }
    setCustomValues(next);
  }, [open, customFieldDefs, dealFetchKey]);

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
          const [{ data }, { data: tl }] = await Promise.all([
            api.get(`/crm/deals/${dealId}`),
            api.get(`/crm/deals/${dealId}/timeline`),
          ]);
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
            priority: data.priority || "medium",
            tagsInput: formatTagsForInput(data.tags),
            nextFollowUpLocal: isoToDatetimeLocal(data.nextFollowUpAt),
            followUpNote: data.followUpNote || "",
          });
          setDealHasAttention(Boolean(data.attentionAt));
          setTimeline(tl);
          dealCustomSnapshotRef.current =
            data.customFields && typeof data.customFields === "object"
              ? { ...data.customFields }
              : {};
          setDealFetchKey((k) => k + 1);
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
      priority: d.priority || "medium",
      tagsInput: d.tagsInput != null ? String(d.tagsInput) : "",
      nextFollowUpLocal: d.nextFollowUpAt
        ? isoToDatetimeLocal(d.nextFollowUpAt)
        : "",
      followUpNote: d.followUpNote || "",
    });
    setDealHasAttention(false);
    dealCustomSnapshotRef.current = {};
    setDealFetchKey((k) => k + 1);
  }, [open, dealId]);

  useEffect(() => {
    if (!open || dealId) return;
    if (!values.pipelineId && pipelines.length) {
      const def = pipelines.find((p) => p.isDefault) || pipelines[0];
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
        const firstSort = p?.stages
          ? [...p.stages].sort((a, b) => a.position - b.position)
          : [];
        const first = firstSort[0];
        next.stageId = first ? first.id : "";
      }
      return next;
    });
  };

  const applyFollowUpPreset = (daysFromToday) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    d.setHours(9, 0, 0, 0);
    setValues((v) => ({
      ...v,
      nextFollowUpLocal: dateToDatetimeLocalInput(d),
    }));
  };

  const clearFollowUp = () => {
    setValues((v) => ({ ...v, nextFollowUpLocal: "", followUpNote: "" }));
  };

  const handleResolveAttentionOnly = async () => {
    if (!dealId) return;
    setSaving(true);
    try {
      await api.put(`/crm/deals/${dealId}/resolve-attention`);
      setDealHasAttention(false);
      try {
        const { data: tl } = await api.get(`/crm/deals/${dealId}/timeline`);
        setTimeline(tl);
      } catch (ignore) {
        /* noop */
      }
      if (onSaved) onSaved();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!dealId || !commentText.trim()) return;
    setSaving(true);
    try {
      await api.post(`/crm/deals/${dealId}/activities/comment`, {
        comment: commentText.trim(),
      });
      setCommentText("");
      const { data: tl } = await api.get(`/crm/deals/${dealId}/timeline`);
      setTimeline(tl);
      if (onSaved) onSaved();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!values.title.trim()) return;
    if (!values.pipelineId || !values.stageId) return;
    if (customFieldDefs.length > 0) {
      const err = validateDealCustomFieldsClient(customFieldDefs, customValues);
      if (err) {
        toast.error(err, getErrorToastOptions());
        return;
      }
    }
    setSaving(true);
    try {
      const tags = parseTagsInput(values.tagsInput);
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
        priority: values.priority || "medium",
        tags,
        nextFollowUpAt: datetimeLocalToIso(values.nextFollowUpLocal),
        followUpNote:
          values.followUpNote && String(values.followUpNote).trim()
            ? String(values.followUpNote).trim()
            : null,
      };
      if (customFieldDefs.length > 0) {
        payload.customFields = buildDealCustomFieldsPayload(
          customFieldDefs,
          customValues
        );
      }
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={dealId ? "md" : "sm"}>
      <DialogTitle>{dialogTitle}</DialogTitle>
      {dealId ? (
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.08)" }}
        >
          <Tab label={i18n.t("crm.history.detailsTab")} />
          <Tab label={i18n.t("crm.history.tab")} />
        </Tabs>
      ) : null}
      <DialogContent>
        {loading ? (
          <Grid container justifyContent="center" style={{ padding: 24 }}>
            <CircularProgress size={32} />
          </Grid>
        ) : (
          <>
            <Box style={{ display: tab === 0 || !dealId ? "block" : "none" }}>
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
                  {stages
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((s) => (
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
                <InputLabel id="crm-prio-lbl">
                  {i18n.t("crm.deal.fields.priority")}
                </InputLabel>
                <Select
                  labelId="crm-prio-lbl"
                  label={i18n.t("crm.deal.fields.priority")}
                  value={values.priority}
                  onChange={handleChange("priority")}
                >
                  {PRIORITY_OPTIONS.map((pr) => (
                    <MenuItem key={pr} value={pr}>
                      {i18n.t(`crm.priority.${pr}`)}
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
            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("crm.followUp.nextFollowUp")}
                type="datetime-local"
                value={values.nextFollowUpLocal}
                onChange={handleChange("nextFollowUpLocal")}
                variant="outlined"
                fullWidth
                margin="dense"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box display="flex" flexWrap="wrap" alignItems="center" style={{ gap: 8, marginTop: 4 }}>
                <Button size="small" onClick={() => applyFollowUpPreset(0)}>
                  {i18n.t("crm.followUp.presetToday")}
                </Button>
                <Button size="small" onClick={() => applyFollowUpPreset(1)}>
                  {i18n.t("crm.followUp.presetTomorrow")}
                </Button>
                <Button size="small" onClick={() => applyFollowUpPreset(3)}>
                  {i18n.t("crm.followUp.presetIn3Days")}
                </Button>
                <Button size="small" onClick={() => applyFollowUpPreset(7)}>
                  {i18n.t("crm.followUp.presetIn7Days")}
                </Button>
                <Button size="small" onClick={clearFollowUp}>
                  {i18n.t("crm.followUp.clearReminder")}
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("crm.followUp.followUpNote")}
                value={values.followUpNote}
                onChange={handleChange("followUpNote")}
                variant="outlined"
                fullWidth
                margin="dense"
                multiline
                minRows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("crm.deal.fields.tags")}
                value={values.tagsInput}
                onChange={handleChange("tagsInput")}
                variant="outlined"
                fullWidth
                margin="dense"
                placeholder="VIP, Retorno"
                helperText={i18n.t("crm.deal.fields.tagsHint")}
              />
            </Grid>
            {customFieldDefs.length ? (
              <>
                <Grid item xs={12}>
                  <Divider style={{ margin: "8px 0" }} />
                  <Typography variant="subtitle2" color="textSecondary">
                    {i18n.t("crm.deal.fields.customFieldsSection")}
                  </Typography>
                </Grid>
                {customFieldDefs.map((f) => (
                  <Grid item xs={12} sm={f.type === "boolean" ? 12 : 6} key={f.key}>
                    {f.type === "text" ? (
                      <TextField
                        label={f.label}
                        value={customValues[f.key] ?? ""}
                        onChange={(e) =>
                          setCustomValues((cv) => ({
                            ...cv,
                            [f.key]: e.target.value,
                          }))
                        }
                        variant="outlined"
                        fullWidth
                        margin="dense"
                        required={Boolean(f.required)}
                      />
                    ) : null}
                    {f.type === "number" || f.type === "currency" ? (
                      <TextField
                        label={f.label}
                        type="number"
                        value={customValues[f.key] ?? ""}
                        onChange={(e) =>
                          setCustomValues((cv) => ({
                            ...cv,
                            [f.key]: e.target.value,
                          }))
                        }
                        variant="outlined"
                        fullWidth
                        margin="dense"
                        inputProps={{
                          step: f.type === "currency" ? "0.01" : "any",
                        }}
                        required={Boolean(f.required)}
                      />
                    ) : null}
                    {f.type === "date" ? (
                      <TextField
                        label={f.label}
                        type="date"
                        value={customValues[f.key] ?? ""}
                        onChange={(e) =>
                          setCustomValues((cv) => ({
                            ...cv,
                            [f.key]: e.target.value,
                          }))
                        }
                        variant="outlined"
                        fullWidth
                        margin="dense"
                        InputLabelProps={{ shrink: true }}
                        required={Boolean(f.required)}
                      />
                    ) : null}
                    {f.type === "select" ? (
                      <FormControl
                        variant="outlined"
                        fullWidth
                        margin="dense"
                        required={Boolean(f.required)}
                      >
                        <InputLabel id={`cf-sel-${f.key}`}>{f.label}</InputLabel>
                        <Select
                          labelId={`cf-sel-${f.key}`}
                          label={f.label}
                          value={customValues[f.key] ?? ""}
                          onChange={(e) =>
                            setCustomValues((cv) => ({
                              ...cv,
                              [f.key]: e.target.value,
                            }))
                          }
                        >
                          {!f.required ? (
                            <MenuItem value="">
                              <em>—</em>
                            </MenuItem>
                          ) : null}
                          {(Array.isArray(f.options) ? f.options : []).map((opt) => (
                            <MenuItem key={opt} value={opt}>
                              {opt}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : null}
                    {f.type === "boolean" ? (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(customValues[f.key])}
                            onChange={(e) =>
                              setCustomValues((cv) => ({
                                ...cv,
                                [f.key]: e.target.checked,
                              }))
                            }
                            color="primary"
                          />
                        }
                        label={
                          f.label +
                          (f.required
                            ? ` (${i18n.t("crm.customFields.requiredShort")})`
                            : "")
                        }
                      />
                    ) : null}
                  </Grid>
                ))}
              </>
            ) : null}
            <Grid item xs={12}>
              <TextField
                label={i18n.t("crm.deal.fields.notes")}
                value={values.notes}
                onChange={handleChange("notes")}
                variant="outlined"
                fullWidth
                margin="dense"
                multiline
                minRows={3}
              />
            </Grid>
          </Grid>
            </Box>
            {dealId ? (
              <Box style={{ display: tab === 1 ? "block" : "none", marginTop: 8 }}>
                <TextField
                  label={i18n.t("crm.history.commentLabel")}
                  placeholder={i18n.t("crm.history.commentPlaceholder")}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  variant="outlined"
                  fullWidth
                  multiline
                  minRows={2}
                  margin="normal"
                />
                <Button
                  color="primary"
                  variant="outlined"
                  disabled={saving || !commentText.trim()}
                  onClick={handleAddComment}
                  style={{ marginBottom: 16 }}
                >
                  {i18n.t("crm.history.addComment")}
                </Button>
                <Typography variant="subtitle2" gutterBottom>
                  {i18n.t("crm.history.tab")}
                </Typography>
                {!timeline || !timeline.activities || timeline.activities.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    {i18n.t("crm.history.empty")}
                  </Typography>
                ) : (
                  <List dense disablePadding>
                    {(timeline.activities || []).map((row) => (
                      <ListItem key={row.id} alignItems="flex-start">
                        <ListItemText
                          primary={formatCrmActivitySummary(row)}
                          secondary={
                            row.createdAt
                              ? formatDistanceToNow(new Date(row.createdAt), {
                                  addSuffix: true,
                                  locale: dateFnsLocale(),
                                })
                              : ""
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
                <Divider style={{ margin: "16px 0" }} />
                <Typography variant="subtitle2" gutterBottom>
                  {i18n.t("crm.history.stageSection")}
                </Typography>
                {!timeline || !timeline.stageHistory || timeline.stageHistory.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    —
                  </Typography>
                ) : (
                  <List dense disablePadding>
                    {(timeline.stageHistory || []).map((h) => {
                      const fromN =
                        h.fromStage && h.fromStage.name
                          ? h.fromStage.name
                          : h.fromStageId || "—";
                      const toN =
                        h.toStage && h.toStage.name ? h.toStage.name : h.toStageId || "—";
                      const durStr =
                        h.leftAt && h.durationMs != null
                          ? formatStageDurationMs(h.durationMs)
                          : "";
                      return (
                        <ListItem key={h.id}>
                          <ListItemText
                            primary={`${fromN} → ${toN}`}
                            secondary={
                              h.leftAt
                                ? `${format(new Date(h.enteredAt), "Pp", {
                                    locale: dateFnsLocale(),
                                  })} — ${format(new Date(h.leftAt), "Pp", {
                                    locale: dateFnsLocale(),
                                  })}${durStr ? ` · ${durStr}` : ""}`
                                : `${format(new Date(h.enteredAt), "Pp", {
                                    locale: dateFnsLocale(),
                                  })} · ${i18n.t("crm.history.openEnded")}`
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Box>
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {dealId && dealHasAttention ? (
          <Button
            onClick={handleResolveAttentionOnly}
            disabled={saving || loading}
            color="primary"
          >
            {i18n.t("crm.attention.resolve")}
          </Button>
        ) : null}
        <Box flex={1} />
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
