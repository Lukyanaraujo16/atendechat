import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
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
  createInventoryProduct,
  getInventoryProduct,
  updateInventoryProduct,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import {
  parseBrazilianCurrencyToNumber,
} from "../../utils/brazilianCurrency";
import {
  KNOWN_PRODUCT_UNITS,
  PRODUCT_UNIT_MAX_LENGTH,
  PRODUCT_UNIT_OTHER,
  inspectProductUnit,
  resolveProductUnit,
  splitProductUnit,
} from "./productUnit";

const emptyForm = {
  name: "",
  sku: "",
  barcode: "",
  categoryId: "",
  unitChoice: "un",
  customUnit: "",
  salePrice: "",
  costPrice: "",
  trackStock: true,
  currentQuantity: "",
  minStock: "",
  imageUrl: "",
  active: true,
};

function SectionLabel({ children }) {
  return (
    <Typography
      variant="caption"
      color="textSecondary"
      style={{ fontWeight: 600, letterSpacing: "0.04em" }}
    >
      {children}
    </Typography>
  );
}

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
  const [loadedUnit, setLoadedUnit] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      setForm(emptyForm);
      setLoadedUnit(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getInventoryProduct(productId)
      .then(({ data }) => {
        if (cancelled) return;
        const storedUnit = data.unit == null ? "" : String(data.unit);
        setLoadedUnit(storedUnit);
        setForm({
          name: data.name || "",
          sku: data.sku || "",
          barcode: data.barcode || "",
          categoryId: data.categoryId != null ? String(data.categoryId) : "",
          ...splitProductUnit(storedUnit),
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

    const unit = resolveProductUnit(form.unitChoice, form.customUnit);
    const unitIssue = inspectProductUnit(unit).issue;
    const keepsLegacyUnit =
      isEdit &&
      loadedUnit != null &&
      unit === String(loadedUnit).trim();
    if (unitIssue && !keepsLegacyUnit) {
      const messageKey =
        unitIssue === "numeric"
          ? "unitNumeric"
          : unitIssue === "suspicious"
            ? "unitSuspicious"
            : unitIssue === "too_long"
              ? "unitTooLong"
              : "unitRequired";
      toast.error(i18n.t(`inventorySales.products.validation.${messageKey}`));
      return;
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      unit,
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

  const resolvedUnit = resolveProductUnit(form.unitChoice, form.customUnit);
  const unitIssue = inspectProductUnit(resolvedUnit).issue;
  const keepsLegacyUnit =
    isEdit &&
    loadedUnit != null &&
    resolvedUnit === String(loadedUnit).trim();
  const showLegacyWarning = Boolean(unitIssue && keepsLegacyUnit);

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
            <SectionLabel>
              {i18n.t("inventorySales.products.sections.identity")}
            </SectionLabel>
            <TextField
              id="product-name"
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

            <SectionLabel>
              {i18n.t("inventorySales.products.sections.commercial")}
            </SectionLabel>
            <FormControl variant="outlined" size="small" fullWidth>
              <InputLabel id="product-unit-label">
                {i18n.t("inventorySales.products.fields.unit")}
              </InputLabel>
              <Select
                labelId="product-unit-label"
                value={form.unitChoice}
                onChange={setField("unitChoice")}
                label={i18n.t("inventorySales.products.fields.unit")}
                disabled={loading}
              >
                {KNOWN_PRODUCT_UNITS.map((code) => (
                  <MenuItem key={code} value={code}>
                    {i18n.t(`inventorySales.products.units.${code}`)}
                  </MenuItem>
                ))}
                <MenuItem value={PRODUCT_UNIT_OTHER}>
                  {i18n.t("inventorySales.products.fields.unitOther")}
                </MenuItem>
              </Select>
              <FormHelperText>
                {i18n.t("inventorySales.products.fields.unitHelp")}
              </FormHelperText>
            </FormControl>
            {form.unitChoice === PRODUCT_UNIT_OTHER ? (
              <TextField
                id="product-custom-unit"
                label={i18n.t("inventorySales.products.fields.unitCustom")}
                value={form.customUnit}
                onChange={setField("customUnit")}
                variant="outlined"
                size="small"
                fullWidth
                disabled={loading}
                helperText={
                  showLegacyWarning
                    ? i18n.t("inventorySales.products.validation.unitLegacyWarning")
                    : unitIssue && String(form.customUnit).trim()
                      ? i18n.t(
                          `inventorySales.products.validation.${
                            unitIssue === "numeric"
                              ? "unitNumeric"
                              : unitIssue === "suspicious"
                                ? "unitSuspicious"
                                : unitIssue === "too_long"
                                  ? "unitTooLong"
                                  : "unitRequired"
                          }`
                        )
                      : i18n.t("inventorySales.products.fields.unitCustomHelp")
                }
                error={Boolean(
                  unitIssue &&
                    String(form.customUnit).trim() &&
                    !keepsLegacyUnit
                )}
                inputProps={{ maxLength: PRODUCT_UNIT_MAX_LENGTH }}
              />
            ) : null}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  id="product-sale-price"
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
              <Grid item xs={12} sm={6}>
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

            <SectionLabel>
              {i18n.t("inventorySales.products.sections.stock")}
            </SectionLabel>
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
                id="product-initial-quantity"
                label={i18n.t("inventorySales.products.fields.initialQuantity")}
                value={form.currentQuantity}
                onChange={setField("currentQuantity")}
                variant="outlined"
                size="small"
                fullWidth
                type="number"
                helperText={i18n.t(
                  "inventorySales.products.fields.initialQuantityHelp"
                )}
                inputProps={{ min: 0, step: "any" }}
                disabled={loading}
              />
            ) : null}
            {form.trackStock ? (
              <TextField
                id="product-min-stock"
                label={i18n.t("inventorySales.products.fields.minStock")}
                value={form.minStock}
                onChange={setField("minStock")}
                variant="outlined"
                size="small"
                fullWidth
                type="number"
                helperText={i18n.t("inventorySales.products.fields.minStockHelp")}
                inputProps={{ min: 0, step: "any" }}
                disabled={loading}
              />
            ) : null}

            <SectionLabel>
              {i18n.t("inventorySales.products.sections.other")}
            </SectionLabel>
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
