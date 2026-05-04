import React, { useMemo, useCallback } from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import TextField from "@material-ui/core/TextField";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import ListSubheader from "@material-ui/core/ListSubheader";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";

import { i18n } from "../../translate/i18n";
import { UNASSIGNED } from "../../utils/applyCrmAdvancedFilters";

const SOURCE_OPTS = ["manual", "whatsapp", "instagram", "other"];
const PRIORITY_OPTS = ["low", "medium", "high", "urgent"];
const STATUS_OPTS = ["open", "won", "lost"];
const FOLLOWUP_OPTS = ["has", "overdue", "today"];

function newRow() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    field: "",
    operator: "",
    value: "",
  };
}

function operatorsForType(type) {
  switch (type) {
    case "text":
      return ["contains", "equals", "not_equals"];
    case "number":
    case "currency":
      return ["equals", "greater_than", "less_than"];
    case "date":
      return ["equals", "before", "after"];
    case "select":
      return ["equals", "not_equals"];
    case "boolean":
      return ["equals"];
    default:
      return ["equals"];
  }
}

function fieldMeta(field, customDefsByKey) {
  if (!field) return { type: "", operators: [] };
  if (field.startsWith("custom.")) {
    const key = field.slice(7);
    const def = customDefsByKey.get(key);
    if (!def) return { type: "", operators: [] };
    return {
      type: def.type,
      operators: operatorsForType(def.type),
      def,
    };
  }
  if (field === "stageId" || field === "assignedUserId") {
    return { type: "builtin_id", operators: ["equals", "not_equals"] };
  }
  if (field === "priority" || field === "source" || field === "status") {
    return { type: "builtin_str", operators: ["equals", "not_equals"] };
  }
  if (field === "attention") {
    return { type: "boolean_builtin", operators: ["equals"] };
  }
  if (field === "followUp") {
    return { type: "followup", operators: ["equals"] };
  }
  return { type: "", operators: [] };
}

export default function CrmAdvancedFilters({
  open,
  onClose,
  filters,
  onFiltersChange,
  stages = [],
  users = [],
  customFieldDefs = [],
}) {
  const activeCustom = useMemo(
    () => (customFieldDefs || []).filter((d) => d && d.active !== false),
    [customFieldDefs]
  );
  const customDefsByKey = useMemo(
    () => new Map(activeCustom.map((d) => [d.key, d])),
    [activeCustom]
  );

  const systemFieldChoices = useMemo(
    () => [
      { value: "stageId", label: i18n.t("crm.advancedFilters.fields.stageId") },
      {
        value: "assignedUserId",
        label: i18n.t("crm.advancedFilters.fields.assignedUserId"),
      },
      { value: "priority", label: i18n.t("crm.advancedFilters.fields.priority") },
      { value: "source", label: i18n.t("crm.advancedFilters.fields.source") },
      { value: "status", label: i18n.t("crm.advancedFilters.fields.status") },
      { value: "attention", label: i18n.t("crm.advancedFilters.fields.attention") },
      {
        value: "followUp",
        label: i18n.t("crm.advancedFilters.fields.followUp"),
      },
    ],
    []
  );

  const updateRow = useCallback(
    (id, patch) => {
      onFiltersChange(
        (filters || []).map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    [filters, onFiltersChange]
  );

  const removeRow = useCallback(
    (id) => {
      onFiltersChange((filters || []).filter((r) => r.id !== id));
    },
    [filters, onFiltersChange]
  );

  const addRow = useCallback(() => {
    onFiltersChange([...(filters || []), newRow()]);
  }, [filters, onFiltersChange]);

  const clearAll = useCallback(() => {
    onFiltersChange([]);
  }, [onFiltersChange]);

  const setField = useCallback(
    (id, field) => {
      const meta = fieldMeta(field, customDefsByKey);
      const firstOp = meta.operators[0] || "";
      let value = "";
      if (meta.type === "boolean_builtin" || meta.type === "boolean") {
        value = false;
      }
      updateRow(id, { field, operator: firstOp, value });
    },
    [customDefsByKey, updateRow]
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{i18n.t("crm.advancedFilters.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("crm.advancedFilters.hint")}
        </Typography>
        {(filters || []).length === 0 ? (
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ marginBottom: 16 }}
          >
            {i18n.t("crm.advancedFilters.noneYet")}
          </Typography>
        ) : null}
        <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
          {(filters || []).map((row) => {
            const meta = fieldMeta(row.field, customDefsByKey);
            const opChoices = meta.operators || [];
            const safeOp = opChoices.includes(row.operator)
              ? row.operator
              : opChoices[0] || "";
            return (
              <Grid container spacing={2} alignItems="flex-start" key={row.id}>
                <Grid item xs={12} sm={3}>
                  <FormControl variant="outlined" size="small" fullWidth margin="dense">
                    <InputLabel id={`af-f-${row.id}`}>
                      {i18n.t("crm.advancedFilters.field")}
                    </InputLabel>
                    <Select
                      labelId={`af-f-${row.id}`}
                      label={i18n.t("crm.advancedFilters.field")}
                      value={row.field}
                      onChange={(e) => setField(row.id, e.target.value)}
                    >
                      <MenuItem value="" disabled>
                        <em>{i18n.t("crm.advancedFilters.pickField")}</em>
                      </MenuItem>
                      <ListSubheader disableSticky>
                        {i18n.t("crm.advancedFilters.groupSystem")}
                      </ListSubheader>
                      {systemFieldChoices.map((c) => (
                        <MenuItem key={c.value} value={c.value}>
                          {c.label}
                        </MenuItem>
                      ))}
                      {activeCustom.length ? (
                        <ListSubheader disableSticky>
                          {i18n.t("crm.advancedFilters.groupCustom")}
                        </ListSubheader>
                      ) : null}
                      {activeCustom.map((d) => (
                        <MenuItem key={d.key} value={`custom.${d.key}`}>
                          {d.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl
                    variant="outlined"
                    size="small"
                    fullWidth
                    margin="dense"
                    disabled={!row.field}
                  >
                    <InputLabel id={`af-o-${row.id}`}>
                      {i18n.t("crm.advancedFilters.operator")}
                    </InputLabel>
                    <Select
                      labelId={`af-o-${row.id}`}
                      label={i18n.t("crm.advancedFilters.operator")}
                      value={safeOp}
                      onChange={(e) => updateRow(row.id, { operator: e.target.value })}
                    >
                      {opChoices.map((op) => (
                        <MenuItem key={op} value={op}>
                          {i18n.t(`crm.advancedFilters.ops.${op}`)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <ValueInput
                    row={{ ...row, operator: safeOp }}
                    meta={meta}
                    stages={stages}
                    users={users}
                    customDef={meta.def}
                    onChange={(v) => updateRow(row.id, { value: v })}
                  />
                </Grid>
                <Grid item xs={12} sm="auto">
                  <IconButton
                    aria-label={i18n.t("crm.advancedFilters.remove")}
                    onClick={() => removeRow(row.id)}
                    size="small"
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Grid>
              </Grid>
            );
          })}
        </Box>
        <Box mt={2} display="flex" flexWrap="wrap" style={{ gap: 8 }}>
          <Button size="small" variant="outlined" color="primary" onClick={addRow}>
            {i18n.t("crm.advancedFilters.addFilter")}
          </Button>
          <Button
            size="small"
            onClick={clearAll}
            disabled={!(filters || []).length}
          >
            {i18n.t("crm.advancedFilters.clearAll")}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {i18n.t("crm.common.cancel")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ValueInput({ row, meta, stages, users, customDef, onChange }) {
  if (!row.field) {
    return (
      <TextField
        size="small"
        variant="outlined"
        fullWidth
        margin="dense"
        disabled
        label={i18n.t("crm.advancedFilters.value")}
      />
    );
  }

  const t = meta.type;

  if (t === "builtin_id" && row.field === "stageId") {
    return (
      <FormControl variant="outlined" size="small" fullWidth margin="dense">
        <InputLabel>{i18n.t("crm.advancedFilters.value")}</InputLabel>
        <Select
          label={i18n.t("crm.advancedFilters.value")}
          value={row.value === "" ? "" : String(row.value)}
          onChange={(e) => onChange(e.target.value)}
        >
          {stages.map((s) => (
            <MenuItem key={s.id} value={String(s.id)}>
              {s.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (t === "builtin_id" && row.field === "assignedUserId") {
    return (
      <FormControl variant="outlined" size="small" fullWidth margin="dense">
        <InputLabel>{i18n.t("crm.advancedFilters.value")}</InputLabel>
        <Select
          label={i18n.t("crm.advancedFilters.value")}
          value={
            row.value === UNASSIGNED || row.value === ""
              ? UNASSIGNED
              : String(row.value)
          }
          onChange={(e) => onChange(e.target.value)}
        >
          <MenuItem value={UNASSIGNED}>
            {i18n.t("crm.deal.fields.unassigned")}
          </MenuItem>
          {users.map((u) => (
            <MenuItem key={u.id} value={String(u.id)}>
              {u.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (t === "builtin_str" && row.field === "priority") {
    return (
      <FormControl variant="outlined" size="small" fullWidth margin="dense">
        <InputLabel>{i18n.t("crm.advancedFilters.value")}</InputLabel>
        <Select
          label={i18n.t("crm.advancedFilters.value")}
          value={String(row.value || "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {PRIORITY_OPTS.map((p) => (
            <MenuItem key={p} value={p}>
              {i18n.t(`crm.priority.${p}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (t === "builtin_str" && row.field === "source") {
    return (
      <FormControl variant="outlined" size="small" fullWidth margin="dense">
        <InputLabel>{i18n.t("crm.advancedFilters.value")}</InputLabel>
        <Select
          label={i18n.t("crm.advancedFilters.value")}
          value={String(row.value || "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {SOURCE_OPTS.map((s) => (
            <MenuItem key={s} value={s}>
              {i18n.t(`crm.deal.source.${s}`)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (t === "builtin_str" && row.field === "status") {
    return (
      <FormControl variant="outlined" size="small" fullWidth margin="dense">
        <InputLabel>{i18n.t("crm.advancedFilters.value")}</InputLabel>
        <Select
          label={i18n.t("crm.advancedFilters.value")}
          value={String(row.value || "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {STATUS_OPTS.map((s) => (
            <MenuItem key={s} value={s}>
              {s === "open"
                ? i18n.t("crm.status.open")
                : s === "won"
                  ? i18n.t("crm.status.won")
                  : i18n.t("crm.status.lost")}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (t === "boolean_builtin") {
    return (
      <FormControlLabel
        control={
          <Switch
            checked={row.value === true}
            onChange={(e) => onChange(e.target.checked)}
            color="primary"
          />
        }
        label={i18n.t("crm.advancedFilters.needsAttention")}
      />
    );
  }

  if (t === "followup") {
    return (
      <FormControl variant="outlined" size="small" fullWidth margin="dense">
        <InputLabel>{i18n.t("crm.advancedFilters.value")}</InputLabel>
        <Select
          label={i18n.t("crm.advancedFilters.value")}
          value={String(row.value || "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {FOLLOWUP_OPTS.map((k) => (
            <MenuItem key={k} value={k}>
              {k === "has"
                ? i18n.t("crm.followUp.filterHas")
                : k === "overdue"
                  ? i18n.t("crm.followUp.filterOverdue")
                  : i18n.t("crm.followUp.filterToday")}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (t === "text") {
    return (
      <TextField
        size="small"
        variant="outlined"
        fullWidth
        margin="dense"
        label={i18n.t("crm.advancedFilters.value")}
        value={row.value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (t === "number" || t === "currency") {
    return (
      <TextField
        size="small"
        variant="outlined"
        fullWidth
        margin="dense"
        type="number"
        label={i18n.t("crm.advancedFilters.value")}
        value={row.value ?? ""}
        inputProps={{
          step: t === "currency" ? "0.01" : "any",
        }}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (t === "date") {
    return (
      <TextField
        size="small"
        variant="outlined"
        fullWidth
        margin="dense"
        type="date"
        label={i18n.t("crm.advancedFilters.value")}
        value={
          row.value && String(row.value).length >= 10
            ? String(row.value).slice(0, 10)
            : row.value || ""
        }
        onChange={(e) => onChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />
    );
  }

  if (t === "select" && customDef && Array.isArray(customDef.options)) {
    return (
      <FormControl variant="outlined" size="small" fullWidth margin="dense">
        <InputLabel>{i18n.t("crm.advancedFilters.value")}</InputLabel>
        <Select
          label={i18n.t("crm.advancedFilters.value")}
          value={String(row.value || "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {customDef.options.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (t === "boolean") {
    return (
      <FormControlLabel
        control={
          <Switch
            checked={row.value === true}
            onChange={(e) => onChange(e.target.checked)}
            color="primary"
          />
        }
        label={i18n.t("crm.customFields.boolYes")}
      />
    );
  }

  return (
    <TextField
      size="small"
      variant="outlined"
      fullWidth
      margin="dense"
      disabled
      label={i18n.t("crm.advancedFilters.value")}
      helperText={i18n.t("crm.advancedFilters.unknownField")}
    />
  );
}
