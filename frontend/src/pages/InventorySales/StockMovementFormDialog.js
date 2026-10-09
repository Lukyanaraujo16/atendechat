import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { toast } from "react-toastify";

import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import {
  createStockMovement,
  listInventoryProductVariants,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { STOCK_MOVEMENT_TYPES } from "./constants";
import { parseBrazilianCurrencyToNumber } from "../../utils/brazilianCurrency";
import { isVariableProduct } from "./inventoryProductKind";

const emptyForm = {
  productId: "",
  variantId: "",
  type: "in",
  quantity: "",
  unitCost: "",
  notes: "",
};

export default function StockMovementFormDialog({
  open,
  onClose,
  products,
  defaultProductId,
  onSaved,
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [variants, setVariants] = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  const stockProducts = useMemo(
    () =>
      (products || []).filter((p) => {
        if (p.active === false) return false;
        if (isVariableProduct(p)) return true;
        return p.trackStock !== false;
      }),
    [products]
  );

  const selectedProduct = useMemo(
    () =>
      stockProducts.find((p) => String(p.id) === String(form.productId)) ||
      null,
    [form.productId, stockProducts]
  );

  const requiresVariant = isVariableProduct(selectedProduct);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyForm,
      productId: defaultProductId ? String(defaultProductId) : "",
    });
  }, [open, defaultProductId]);

  useEffect(() => {
    if (!open || !requiresVariant || !form.productId) {
      setVariants([]);
      return;
    }
    let cancelled = false;
    setVariantsLoading(true);
    listInventoryProductVariants(Number(form.productId), { active: true })
      .then(({ data }) => {
        if (cancelled) return;
        setVariants(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) toastError(err);
      })
      .finally(() => {
        if (!cancelled) setVariantsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, requiresVariant, form.productId]);

  const setField = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "productId") {
        next.variantId = "";
      }
      return next;
    });
  };

  const notesRequired = form.type === "out" || form.type === "adjustment";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.productId) {
      toast.error(i18n.t("inventorySales.stock.validation.product"));
      return;
    }
    if (requiresVariant && !form.variantId) {
      toast.error(i18n.t("inventorySales.stock.validation.variant"));
      return;
    }
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error(i18n.t("inventorySales.stock.validation.quantity"));
      return;
    }
    if (form.type !== "adjustment" && quantity <= 0) {
      toast.error(i18n.t("inventorySales.stock.validation.quantityPositive"));
      return;
    }
    if (notesRequired && !form.notes.trim()) {
      toast.error(i18n.t("inventorySales.stock.validation.notes"));
      return;
    }

    const unitCost = form.unitCost
      ? parseBrazilianCurrencyToNumber(form.unitCost)
      : null;

    const body = {
      productId: Number(form.productId),
      type: form.type,
      quantity,
      unitCost,
      notes: form.notes.trim() || null,
    };
    if (requiresVariant) {
      body.variantId = Number(form.variantId);
    }

    setSaving(true);
    try {
      await createStockMovement(body);
      toast.success(i18n.t("inventorySales.stock.toasts.created"));
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <AppDialogTitle>
          {i18n.t("inventorySales.stock.newTitle")}
        </AppDialogTitle>
        <AppDialogContent>
          <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
            <FormControl variant="outlined" size="small" fullWidth required>
              <InputLabel id="movement-product-label">
                {i18n.t("inventorySales.stock.fields.product")}
              </InputLabel>
              <Select
                labelId="movement-product-label"
                value={form.productId}
                onChange={setField("productId")}
                label={i18n.t("inventorySales.stock.fields.product")}
              >
                <MenuItem value="">
                  <em>{i18n.t("inventorySales.common.select")}</em>
                </MenuItem>
                {stockProducts.map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.name}
                    {p.sku ? ` (${p.sku})` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {requiresVariant ? (
              <FormControl variant="outlined" size="small" fullWidth required>
                <InputLabel id="movement-variant-label">
                  {i18n.t("inventorySales.stock.fields.variant")}
                </InputLabel>
                <Select
                  labelId="movement-variant-label"
                  value={form.variantId}
                  onChange={setField("variantId")}
                  label={i18n.t("inventorySales.stock.fields.variant")}
                  disabled={variantsLoading}
                >
                  <MenuItem value="">
                    <em>{i18n.t("inventorySales.common.select")}</em>
                  </MenuItem>
                  {variants.map((v) => (
                    <MenuItem key={v.id} value={String(v.id)}>
                      {v.label || `#${v.id}`}
                      {v.sku ? ` (${v.sku})` : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
            <FormControl variant="outlined" size="small" fullWidth required>
              <InputLabel id="movement-type-label">
                {i18n.t("inventorySales.stock.fields.type")}
              </InputLabel>
              <Select
                labelId="movement-type-label"
                value={form.type}
                onChange={setField("type")}
                label={i18n.t("inventorySales.stock.fields.type")}
              >
                {STOCK_MOVEMENT_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {i18n.t(`inventorySales.stock.types.${type}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {form.type === "adjustment" ? (
              <Typography variant="caption" color="textSecondary">
                {i18n.t("inventorySales.stock.hints.adjustment")}
              </Typography>
            ) : null}
            <TextField
              label={
                form.type === "adjustment"
                  ? i18n.t("inventorySales.stock.fields.targetBalance")
                  : i18n.t("inventorySales.stock.fields.quantity")
              }
              value={form.quantity}
              onChange={setField("quantity")}
              variant="outlined"
              size="small"
              fullWidth
              type="number"
              inputProps={{ min: 0, step: "any" }}
              required
            />
            <TextField
              label={i18n.t("inventorySales.stock.fields.unitCost")}
              value={form.unitCost}
              onChange={setField("unitCost")}
              variant="outlined"
              size="small"
              fullWidth
            />
            <TextField
              label={i18n.t("inventorySales.stock.fields.notes")}
              value={form.notes}
              onChange={setField("notes")}
              variant="outlined"
              size="small"
              fullWidth
              multiline
              rows={2}
              required={notesRequired}
              helperText={
                notesRequired
                  ? i18n.t("inventorySales.stock.hints.notesRequired")
                  : undefined
              }
            />
          </Box>
        </AppDialogContent>
        <AppDialogActions>
          <AppSecondaryButton type="button" onClick={onClose} disabled={saving}>
            {i18n.t("inventorySales.common.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton type="submit" disabled={saving}>
            {i18n.t("inventorySales.common.save")}
          </AppPrimaryButton>
        </AppDialogActions>
      </form>
    </AppDialog>
  );
}
