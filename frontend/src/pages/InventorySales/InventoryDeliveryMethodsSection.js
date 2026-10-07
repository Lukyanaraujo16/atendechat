import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Checkbox,
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
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import {
  AppEmptyState,
  AppLoadingState,
  AppPrimaryButton,
  AppSecondaryButton,
  AppSectionCard,
} from "../../ui";
import {
  createInventoryDeliveryMethod,
  deactivateInventoryDeliveryMethod,
  listInventoryDeliveryMethods,
  updateInventoryDeliveryMethod,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import CurrencyInput from "./CurrencyInput";

const KIND_OPTIONS = [
  { value: "pickup", labelKey: "pickup" },
  { value: "courier", labelKey: "courier" },
  { value: "carrier", labelKey: "carrier" },
  { value: "other", labelKey: "other" },
];

const emptyForm = () => ({
  name: "",
  kind: "courier",
  defaultAmount: 0,
  allowAmountOverride: true,
  requiresAddress: true,
  active: true,
  position: 0,
});

const useStyles = makeStyles((theme) => ({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1),
  },
  row: {
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
  },
  rowActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  meta: {
    color: theme.palette.text.secondary,
    fontSize: "0.875rem",
  },
}));

function applyKindDefaults(kind, form) {
  if (kind === "pickup") {
    return {
      ...form,
      kind,
      defaultAmount: 0,
      allowAmountOverride: false,
      requiresAddress: false,
    };
  }
  if (form.kind === "pickup") {
    return {
      ...form,
      kind,
      defaultAmount: 0,
      allowAmountOverride: true,
      requiresAddress: true,
    };
  }
  return { ...form, kind };
}

export default function InventoryDeliveryMethodsSection() {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [rows, setRows] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await listInventoryDeliveryMethods();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      kind: row.kind || "courier",
      defaultAmount: Number(row.defaultAmount) || 0,
      allowAmountOverride: row.allowAmountOverride !== false,
      requiresAddress: row.requiresAddress !== false,
      active: row.active !== false,
      position: Number(row.position) || 0,
    });
    setDialogOpen(true);
  };

  const handleKindChange = (e) => {
    const kind = e.target.value;
    setForm((prev) => applyKindDefaults(kind, prev));
  };

  const handleSave = async () => {
    const name = String(form.name || "").trim();
    if (!name) {
      toast.error(i18n.t("inventorySales.settings.delivery.validation.name"));
      return;
    }
    const payload = {
      name,
      kind: form.kind,
      defaultAmount: form.kind === "pickup" ? 0 : Number(form.defaultAmount) || 0,
      allowAmountOverride: form.kind === "pickup" ? false : Boolean(form.allowAmountOverride),
      requiresAddress: form.kind === "pickup" ? false : Boolean(form.requiresAddress),
      active: Boolean(form.active),
      position: Math.trunc(Number(form.position) || 0),
    };
    setSaving(true);
    try {
      if (editingId) {
        await updateInventoryDeliveryMethod(editingId, payload);
        toast.success(i18n.t("inventorySales.settings.delivery.toasts.updated"));
      } else {
        await createInventoryDeliveryMethod(payload);
        toast.success(i18n.t("inventorySales.settings.delivery.toasts.created"));
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row) => {
    setSaving(true);
    try {
      if (row.active) {
        await deactivateInventoryDeliveryMethod(row.id);
        toast.success(i18n.t("inventorySales.settings.delivery.toasts.deactivated"));
      } else {
        await updateInventoryDeliveryMethod(row.id, { active: true });
        toast.success(i18n.t("inventorySales.settings.delivery.toasts.activated"));
      }
      load();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const isPickup = form.kind === "pickup";

  return (
    <AppSectionCard variant="outlined" data-testid="inventory-delivery-methods-section">
      <Typography variant="h6" style={{ fontWeight: 600 }}>
        {i18n.t("inventorySales.settings.delivery.title")}
      </Typography>
      <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
        {i18n.t("inventorySales.settings.delivery.hint")}
      </Typography>

      {loading ? (
        <AppLoadingState message={i18n.t("inventorySales.common.loading")} />
      ) : loadError ? (
        <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
          <AppSecondaryButton onClick={load}>
            {i18n.t("inventorySales.common.retry")}
          </AppSecondaryButton>
        </AppEmptyState>
      ) : (
        <>
          <Box className={classes.list}>
            {rows.map((row) => (
              <Box key={row.id} className={classes.row} data-testid={`delivery-method-row-${row.id}`}>
                <Typography style={{ fontWeight: 600 }}>{row.name}</Typography>
                <Typography className={classes.meta}>
                  {i18n.t(`inventorySales.settings.delivery.kinds.${row.kind}`)}
                  {" · "}
                  {formatCurrencyBRL(row.defaultAmount)}
                  {" · "}
                  {row.active
                    ? i18n.t("inventorySales.settings.delivery.active")
                    : i18n.t("inventorySales.settings.delivery.inactive")}
                  {" · "}
                  {row.allowAmountOverride
                    ? i18n.t("inventorySales.settings.delivery.overrideYes")
                    : i18n.t("inventorySales.settings.delivery.overrideNo")}
                  {" · "}
                  {row.requiresAddress
                    ? i18n.t("inventorySales.settings.delivery.addressYes")
                    : i18n.t("inventorySales.settings.delivery.addressNo")}
                </Typography>
                <Box className={classes.rowActions}>
                  <AppSecondaryButton onClick={() => openEdit(row)} disabled={saving}>
                    {i18n.t("inventorySales.settings.delivery.edit")}
                  </AppSecondaryButton>
                  <AppSecondaryButton
                    onClick={() => handleToggleActive(row)}
                    disabled={saving}
                    data-testid={`delivery-method-toggle-${row.id}`}
                  >
                    {row.active
                      ? i18n.t("inventorySales.settings.delivery.deactivate")
                      : i18n.t("inventorySales.settings.delivery.activate")}
                  </AppSecondaryButton>
                </Box>
              </Box>
            ))}
          </Box>
          <Box mt={2}>
            <AppPrimaryButton onClick={openCreate} data-testid="delivery-method-create">
              {i18n.t("inventorySales.settings.delivery.create")}
            </AppPrimaryButton>
          </Box>
        </>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editingId
            ? i18n.t("inventorySales.settings.delivery.editTitle")
            : i18n.t("inventorySales.settings.delivery.createTitle")}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" style={{ gap: 16, paddingTop: 8 }}>
            <TextField
              label={i18n.t("inventorySales.settings.delivery.fields.name")}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              variant="outlined"
              size="small"
              fullWidth
              required
              inputProps={{ "data-testid": "delivery-method-name" }}
            />
            <FormControl variant="outlined" size="small" fullWidth>
              <InputLabel id="dm-kind-label">
                {i18n.t("inventorySales.settings.delivery.fields.kind")}
              </InputLabel>
              <Select
                labelId="dm-kind-label"
                label={i18n.t("inventorySales.settings.delivery.fields.kind")}
                value={form.kind}
                onChange={handleKindChange}
              >
                {KIND_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {i18n.t(`inventorySales.settings.delivery.kinds.${opt.labelKey}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {!isPickup ? (
              <CurrencyInput
                label={i18n.t("inventorySales.settings.delivery.fields.defaultAmount")}
                value={form.defaultAmount}
                onChange={(v) => setForm((p) => ({ ...p, defaultAmount: v }))}
              />
            ) : (
              <Typography variant="body2" color="textSecondary">
                {i18n.t("inventorySales.settings.delivery.pickupLocked")}
              </Typography>
            )}
            {!isPickup ? (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(form.allowAmountOverride)}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        allowAmountOverride: e.target.checked,
                      }))
                    }
                    color="primary"
                  />
                }
                label={i18n.t("inventorySales.settings.delivery.fields.allowAmountOverride")}
              />
            ) : null}
            {!isPickup ? (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(form.requiresAddress)}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        requiresAddress: e.target.checked,
                      }))
                    }
                    color="primary"
                  />
                }
                label={i18n.t("inventorySales.settings.delivery.fields.requiresAddress")}
              />
            ) : null}
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(form.active)}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, active: e.target.checked }))
                  }
                  color="primary"
                />
              }
              label={i18n.t("inventorySales.settings.delivery.fields.active")}
            />
            <TextField
              label={i18n.t("inventorySales.settings.delivery.fields.position")}
              value={form.position}
              onChange={(e) =>
                setForm((p) => ({ ...p, position: e.target.value }))
              }
              variant="outlined"
              size="small"
              type="number"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton onClick={() => setDialogOpen(false)} disabled={saving}>
            {i18n.t("inventorySales.common.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton onClick={handleSave} disabled={saving}>
            {saving
              ? i18n.t("inventorySales.sales.wizard.nav.saving")
              : i18n.t("inventorySales.common.save")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>
    </AppSectionCard>
  );
}
