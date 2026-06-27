import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
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
  createInventoryProduct,
  getInventoryProduct,
  updateInventoryProduct,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import {
  parseBrazilianCurrencyToNumber,
} from "../../utils/brazilianCurrency";

const emptyForm = {
  name: "",
  sku: "",
  barcode: "",
  categoryId: "",
  unit: "un",
  salePrice: "",
  costPrice: "",
  trackStock: true,
  currentQuantity: "",
  minStock: "",
  imageUrl: "",
  active: true,
};

export default function ProductFormDialog({
  open,
  onClose,
  productId,
  categories,
  onSaved,
}) {
  const isEdit = productId != null;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      setForm(emptyForm);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getInventoryProduct(productId)
      .then(({ data }) => {
        if (cancelled) return;
        setForm({
          name: data.name || "",
          sku: data.sku || "",
          barcode: data.barcode || "",
          categoryId: data.categoryId != null ? String(data.categoryId) : "",
          unit: data.unit || "un",
          salePrice: data.salePrice != null ? String(data.salePrice) : "",
          costPrice: data.costPrice != null ? String(data.costPrice) : "",
          trackStock: data.trackStock !== false,
          currentQuantity: "",
          minStock: data.minStock != null ? String(data.minStock) : "",
          imageUrl: data.imageUrl || "",
          active: data.active !== false,
        });
      })
      .catch(toastError)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isEdit, productId]);

  const setField = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const salePrice = parseBrazilianCurrencyToNumber(form.salePrice);
    if (salePrice == null || salePrice < 0) {
      toast.error(i18n.t("inventorySales.products.validation.salePrice"));
      return;
    }
    if (!form.name.trim()) {
      toast.error(i18n.t("inventorySales.products.validation.name"));
      return;
    }

    const costPrice = form.costPrice
      ? parseBrazilianCurrencyToNumber(form.costPrice)
      : null;
    const minStock = form.minStock ? Number(form.minStock) : null;

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      unit: form.unit.trim() || "un",
      salePrice,
      costPrice,
      trackStock: form.trackStock,
      minStock,
      imageUrl: form.imageUrl.trim() || null,
      active: form.active,
    };

    if (!isEdit && form.trackStock && form.currentQuantity !== "") {
      const qty = Number(form.currentQuantity);
      if (!Number.isFinite(qty) || qty < 0) {
        toast.error(i18n.t("inventorySales.products.validation.initialQty"));
        return;
      }
      payload.currentQuantity = qty;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateInventoryProduct(productId, payload);
        toast.success(i18n.t("inventorySales.products.toasts.updated"));
      } else {
        await createInventoryProduct(payload);
        toast.success(i18n.t("inventorySales.products.toasts.created"));
      }
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
          {isEdit
            ? i18n.t("inventorySales.products.editTitle")
            : i18n.t("inventorySales.products.newTitle")}
        </AppDialogTitle>
        <AppDialogContent>
          <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
            <TextField
              label={i18n.t("inventorySales.products.fields.name")}
              value={form.name}
              onChange={setField("name")}
              variant="outlined"
              size="small"
              fullWidth
              required
              disabled={loading}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={i18n.t("inventorySales.products.fields.sku")}
                  value={form.sku}
                  onChange={setField("sku")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={i18n.t("inventorySales.products.fields.barcode")}
                  value={form.barcode}
                  onChange={setField("barcode")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  disabled={loading}
                />
              </Grid>
            </Grid>
            <FormControl variant="outlined" size="small" fullWidth>
              <InputLabel id="product-category-label">
                {i18n.t("inventorySales.products.fields.category")}
              </InputLabel>
              <Select
                labelId="product-category-label"
                value={form.categoryId}
                onChange={setField("categoryId")}
                label={i18n.t("inventorySales.products.fields.category")}
                disabled={loading}
              >
                <MenuItem value="">
                  <em>{i18n.t("inventorySales.common.none")}</em>
                </MenuItem>
                {(categories || []).map((cat) => (
                  <MenuItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label={i18n.t("inventorySales.products.fields.unit")}
                  value={form.unit}
                  onChange={setField("unit")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  disabled={loading}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label={i18n.t("inventorySales.products.fields.salePrice")}
                  value={form.salePrice}
                  onChange={setField("salePrice")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  required
                  disabled={loading}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label={i18n.t("inventorySales.products.fields.costPrice")}
                  value={form.costPrice}
                  onChange={setField("costPrice")}
                  variant="outlined"
                  size="small"
                  fullWidth
                  disabled={loading}
                />
              </Grid>
            </Grid>
            <FormControlLabel
              control={
                <Switch
                  checked={form.trackStock}
                  onChange={setField("trackStock")}
                  color="primary"
                  disabled={loading}
                />
              }
              label={i18n.t("inventorySales.products.fields.trackStock")}
            />
            {form.trackStock && !isEdit ? (
              <TextField
                label={i18n.t("inventorySales.products.fields.initialQuantity")}
                value={form.currentQuantity}
                onChange={setField("currentQuantity")}
                variant="outlined"
                size="small"
                fullWidth
                type="number"
                inputProps={{ min: 0, step: "any" }}
                disabled={loading}
              />
            ) : null}
            {form.trackStock ? (
              <TextField
                label={i18n.t("inventorySales.products.fields.minStock")}
                value={form.minStock}
                onChange={setField("minStock")}
                variant="outlined"
                size="small"
                fullWidth
                type="number"
                inputProps={{ min: 0, step: "any" }}
                disabled={loading}
              />
            ) : null}
            <TextField
              label={i18n.t("inventorySales.products.fields.imageUrl")}
              value={form.imageUrl}
              onChange={setField("imageUrl")}
              variant="outlined"
              size="small"
              fullWidth
              disabled={loading}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.active}
                  onChange={setField("active")}
                  color="primary"
                  disabled={loading}
                />
              }
              label={i18n.t("inventorySales.products.fields.active")}
            />
          </Box>
        </AppDialogContent>
        <AppDialogActions>
          <AppSecondaryButton type="button" onClick={onClose} disabled={saving}>
            {i18n.t("inventorySales.common.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton type="submit" disabled={loading || saving}>
            {i18n.t("inventorySales.common.save")}
          </AppPrimaryButton>
        </AppDialogActions>
      </form>
    </AppDialog>
  );
}
