import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
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
  saveInventoryVariableProduct,
  updateInventoryProduct,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { parseBrazilianCurrencyToNumber } from "../../utils/brazilianCurrency";
import {
  KNOWN_PRODUCT_UNITS,
  PRODUCT_UNIT_MAX_LENGTH,
  PRODUCT_UNIT_OTHER,
  inspectProductUnit,
  resolveProductUnit,
  splitProductUnit,
} from "./productUnit";
import {
  PRODUCT_KIND_SIMPLE,
  PRODUCT_KIND_VARIABLE,
} from "./inventoryProductKind";
import ProductVariantsEditor, { newCharacteristic } from "./ProductVariantsEditor";
import {
  characteristicsFromVariants,
  draftVariantsFromPersisted,
} from "./productVariantCombinations";

const emptyForm = {
  name: "",
  productKind: PRODUCT_KIND_SIMPLE,
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

const emptyVariantsState = () => ({
  characteristics: [newCharacteristic()],
  drafts: [],
  truncated: false,
  totalPossible: 0,
});

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

function buildVariablePayload(form, variantsState, unit) {
  const characteristics = (variantsState.characteristics || [])
    .map((c) => ({
      name: String(c.name || "").trim(),
      options: (c.options || []).map((o) => String(o).trim()).filter(Boolean),
    }))
    .filter((c) => c.name && c.options.length);

  const selected = (variantsState.drafts || []).filter(
    (d) => d.selected !== false
  );

  const variants = selected.map((draft) => {
    const salePrice =
      typeof draft.salePrice === "number"
        ? draft.salePrice
        : parseBrazilianCurrencyToNumber(draft.salePrice);
    const row = {
      options: (draft.options || []).map((o) => ({
        characteristicName: o.characteristicName,
        optionValue: o.optionValue,
      })),
      label: draft.label || undefined,
      salePrice,
      sku: String(draft.sku || "").trim() || null,
      barcode: String(draft.barcode || "").trim() || null,
      imageUrl: String(draft.imageUrl || "").trim() || null,
      trackStock: draft.trackStock !== false,
      active: draft.active !== false,
    };
    if (draft.id != null) row.id = draft.id;
    const costPrice =
      draft.costPrice == null || draft.costPrice === ""
        ? null
        : typeof draft.costPrice === "number"
          ? draft.costPrice
          : parseBrazilianCurrencyToNumber(draft.costPrice);
    if (costPrice != null) row.costPrice = costPrice;
    if (draft.minStock !== "" && draft.minStock != null) {
      const minStock = Number(draft.minStock);
      if (Number.isFinite(minStock)) row.minStock = minStock;
    }
    if (!draft.persisted && draft.currentQuantity !== "") {
      const qty = Number(draft.currentQuantity);
      if (Number.isFinite(qty)) row.currentQuantity = qty;
    }
    return { draft, row, salePrice };
  });

  return {
    characteristics,
    variants,
    payloadBase: {
      name: form.name.trim(),
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      unit,
      imageUrl: form.imageUrl.trim() || null,
      active: form.active,
    },
  };
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
  const [variantsState, setVariantsState] = useState(emptyVariantsState);

  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      setForm(emptyForm);
      setLoadedUnit(null);
      setVariantsState(emptyVariantsState());
      return;
    }
    let cancelled = false;
    setLoading(true);
    getInventoryProduct(productId)
      .then(({ data }) => {
        if (cancelled) return;
        const storedUnit = data.unit == null ? "" : String(data.unit);
        setLoadedUnit(storedUnit);
        const kind =
          data.productKind === PRODUCT_KIND_VARIABLE
            ? PRODUCT_KIND_VARIABLE
            : PRODUCT_KIND_SIMPLE;
        setForm({
          name: data.name || "",
          productKind: kind,
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
        if (kind === PRODUCT_KIND_VARIABLE) {
          const variants = Array.isArray(data.variants) ? data.variants : [];
          const chars = characteristicsFromVariants(variants);
          setVariantsState({
            characteristics: chars.length
              ? chars.map((c, idx) => ({
                  localId: `loaded-${idx}`,
                  name: c.name,
                  options: c.options,
                  optionDraft: "",
                }))
              : [newCharacteristic()],
            drafts: draftVariantsFromPersisted(variants),
            truncated: false,
            totalPossible: variants.length,
          });
        } else {
          setVariantsState(emptyVariantsState());
        }
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

  const isVariable = form.productKind === PRODUCT_KIND_VARIABLE;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(i18n.t("inventorySales.products.validation.name"));
      return;
    }

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

    if (isVariable) {
      const built = buildVariablePayload(form, variantsState, unit);
      if (!built.characteristics.length) {
        toast.error(
          i18n.t("inventorySales.products.variants.validation.characteristicName")
        );
        return;
      }
      if (!built.variants.length) {
        toast.error(
          i18n.t("inventorySales.products.variants.validation.selectVariation")
        );
        return;
      }
      for (const item of built.variants) {
        if (item.salePrice == null || item.salePrice < 0) {
          toast.error(
            i18n.t("inventorySales.products.variants.validation.salePriceNamed", {
              label: item.draft.label,
            })
          );
          return;
        }
        if (
          !item.draft.persisted &&
          item.draft.currentQuantity !== "" &&
          (!Number.isFinite(Number(item.draft.currentQuantity)) ||
            Number(item.draft.currentQuantity) < 0)
        ) {
          toast.error(i18n.t("inventorySales.products.validation.initialQty"));
          return;
        }
      }

      const body = {
        ...built.payloadBase,
        characteristics: built.characteristics,
        variants: built.variants.map((v) => v.row),
      };

      setSaving(true);
      try {
        await saveInventoryVariableProduct(body, isEdit ? productId : null);
        toast.success(
          i18n.t(
            isEdit
              ? "inventorySales.products.toasts.updated"
              : "inventorySales.products.toasts.created"
          )
        );
        if (onSaved) onSaved();
        onClose();
      } catch (err) {
        toastError(err);
      } finally {
        setSaving(false);
      }
      return;
    }

    const salePrice = parseBrazilianCurrencyToNumber(form.salePrice);
    if (salePrice == null || salePrice < 0) {
      toast.error(i18n.t("inventorySales.products.validation.salePrice"));
      return;
    }
    const costPrice = form.costPrice
      ? parseBrazilianCurrencyToNumber(form.costPrice)
      : null;
    const minStock = form.minStock ? Number(form.minStock) : null;

    const payload = {
      name: form.name.trim(),
      productKind: form.productKind,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      unit,
      imageUrl: form.imageUrl.trim() || null,
      active: form.active,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      salePrice,
      costPrice,
      trackStock: form.trackStock,
      minStock,
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
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth={isVariable ? "md" : "sm"}
      fullWidth
    >
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
            <FormControl component="fieldset" disabled={loading || isEdit}>
              <Typography variant="caption" color="textSecondary" gutterBottom>
                {i18n.t("inventorySales.products.fields.productKind")}
              </Typography>
              <RadioGroup
                row
                name="productKind"
                value={form.productKind}
                onChange={setField("productKind")}
              >
                <FormControlLabel
                  value={PRODUCT_KIND_SIMPLE}
                  control={<Radio color="primary" size="small" />}
                  label={i18n.t("inventorySales.products.fields.productKindSimple")}
                />
                <FormControlLabel
                  value={PRODUCT_KIND_VARIABLE}
                  control={<Radio color="primary" size="small" />}
                  label={i18n.t(
                    "inventorySales.products.fields.productKindVariable"
                  )}
                />
              </RadioGroup>
              {isEdit ? (
                <FormHelperText>
                  {i18n.t("inventorySales.products.fields.productKindLocked")}
                </FormHelperText>
              ) : null}
            </FormControl>
            {!isVariable ? (
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
                    id="product-barcode"
                    label={i18n.t("inventorySales.products.fields.barcode")}
                    helperText={i18n.t(
                      "inventorySales.products.fields.barcodeHelp"
                    )}
                    value={form.barcode}
                    onChange={setField("barcode")}
                    variant="outlined"
                    size="small"
                    fullWidth
                    disabled={loading}
                  />
                </Grid>
              </Grid>
            ) : null}
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
                    ? i18n.t(
                        "inventorySales.products.validation.unitLegacyWarning"
                      )
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
            {!isVariable ? (
              <>
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
                    label={i18n.t(
                      "inventorySales.products.fields.initialQuantity"
                    )}
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
                    helperText={i18n.t(
                      "inventorySales.products.fields.minStockHelp"
                    )}
                    inputProps={{ min: 0, step: "any" }}
                    disabled={loading}
                  />
                ) : null}
              </>
            ) : (
              <ProductVariantsEditor
                value={variantsState}
                onChange={setVariantsState}
                disabled={loading || saving}
                isEdit={isEdit}
                productImageUrl={form.imageUrl}
              />
            )}

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
