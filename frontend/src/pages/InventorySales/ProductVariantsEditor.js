import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import BlockIcon from "@material-ui/icons/Block";
import { toast } from "react-toastify";

import { AppPrimaryButton, AppTableContainer } from "../../ui";
import {
  createInventoryProductAttribute,
  createInventoryProductAttributeOption,
  createInventoryProductVariant,
  listInventoryProductAttributes,
  listInventoryProductVariants,
  updateInventoryProductVariant,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import {
  formatCurrencyBRL,
  parseBrazilianCurrencyToNumber,
} from "../../utils/brazilianCurrency";
import { formatQuantity } from "./utils";

const emptyVariantForm = {
  optionByAttribute: {},
  salePrice: "",
  costPrice: "",
  sku: "",
  barcode: "",
  minStock: "",
  currentQuantity: "",
  active: true,
};

export default function ProductVariantsEditor({ productId }) {
  const [attributes, setAttributes] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingVariant, setSavingVariant] = useState(false);
  const [newAttributeName, setNewAttributeName] = useState("");
  const [newOptionByAttribute, setNewOptionByAttribute] = useState({});
  const [variantForm, setVariantForm] = useState(emptyVariantForm);

  const activeAttributes = useMemo(
    () => (attributes || []).filter((attr) => attr.active !== false),
    [attributes]
  );

  const loadAll = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const [attrRes, varRes] = await Promise.all([
        listInventoryProductAttributes({ activeOnly: true }),
        listInventoryProductVariants(productId, {}),
      ]);
      setAttributes(Array.isArray(attrRes.data) ? attrRes.data : []);
      setVariants(Array.isArray(varRes.data) ? varRes.data : []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateAttribute = async () => {
    const name = newAttributeName.trim();
    if (!name) {
      toast.error(i18n.t("inventorySales.products.variants.validation.attributeName"));
      return;
    }
    try {
      await createInventoryProductAttribute({ name });
      setNewAttributeName("");
      toast.success(i18n.t("inventorySales.products.variants.toasts.attributeCreated"));
      await loadAll();
    } catch (err) {
      toastError(err);
    }
  };

  const handleCreateOption = async (attributeId) => {
    const value = String(newOptionByAttribute[attributeId] || "").trim();
    if (!value) {
      toast.error(i18n.t("inventorySales.products.variants.validation.optionValue"));
      return;
    }
    try {
      await createInventoryProductAttributeOption(attributeId, { value });
      setNewOptionByAttribute((prev) => ({ ...prev, [attributeId]: "" }));
      toast.success(i18n.t("inventorySales.products.variants.toasts.optionCreated"));
      await loadAll();
    } catch (err) {
      toastError(err);
    }
  };

  const setVariantField = (field) => (e) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setVariantForm((prev) => ({ ...prev, [field]: value }));
  };

  const setVariantOption = (attributeId) => (e) => {
    const optionId = e.target.value;
    setVariantForm((prev) => ({
      ...prev,
      optionByAttribute: {
        ...prev.optionByAttribute,
        [attributeId]: optionId,
      },
    }));
  };

  const handleCreateVariant = async () => {
    const optionIds = activeAttributes
      .map((attr) => {
        const raw = variantForm.optionByAttribute[attr.id];
        if (!raw) return null;
        return { attributeId: attr.id, optionId: Number(raw) };
      })
      .filter(Boolean);
    if (!optionIds.length) {
      toast.error(i18n.t("inventorySales.products.variants.validation.options"));
      return;
    }
    const salePrice = parseBrazilianCurrencyToNumber(variantForm.salePrice);
    if (salePrice == null || salePrice < 0) {
      toast.error(i18n.t("inventorySales.products.validation.salePrice"));
      return;
    }
    const payload = {
      optionIds,
      salePrice,
      active: variantForm.active,
      sku: variantForm.sku.trim() || null,
      barcode: variantForm.barcode.trim() || null,
    };
    const costPrice = variantForm.costPrice
      ? parseBrazilianCurrencyToNumber(variantForm.costPrice)
      : null;
    if (costPrice != null) payload.costPrice = costPrice;
    const minStock = variantForm.minStock ? Number(variantForm.minStock) : null;
    if (minStock != null && Number.isFinite(minStock)) payload.minStock = minStock;
    if (variantForm.currentQuantity !== "") {
      const qty = Number(variantForm.currentQuantity);
      if (!Number.isFinite(qty) || qty < 0) {
        toast.error(i18n.t("inventorySales.products.validation.initialQty"));
        return;
      }
      payload.currentQuantity = qty;
    }

    setSavingVariant(true);
    try {
      await createInventoryProductVariant(productId, payload);
      toast.success(i18n.t("inventorySales.products.variants.toasts.variantCreated"));
      setVariantForm(emptyVariantForm);
      await loadAll();
    } catch (err) {
      toastError(err);
    } finally {
      setSavingVariant(false);
    }
  };

  const handleDeactivateVariant = async (variant) => {
    try {
      await updateInventoryProductVariant(productId, variant.id, { active: false });
      toast.success(i18n.t("inventorySales.products.variants.toasts.variantDeactivated"));
      await loadAll();
    } catch (err) {
      toastError(err);
    }
  };

  if (!productId) return null;

  return (
    <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
      <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
        {i18n.t("inventorySales.products.variants.title")}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {i18n.t("inventorySales.products.variants.hint")}
      </Typography>

      <Box>
        <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
          {i18n.t("inventorySales.products.variants.attributesTitle")}
        </Typography>
        <Box display="flex" flexWrap="wrap" style={{ gap: 8 }} alignItems="center">
          <TextField
            size="small"
            variant="outlined"
            label={i18n.t("inventorySales.products.variants.newAttribute")}
            value={newAttributeName}
            onChange={(e) => setNewAttributeName(e.target.value)}
            disabled={loading}
          />
          <AppPrimaryButton
            type="button"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleCreateAttribute}
            disabled={loading}
          >
            {i18n.t("inventorySales.products.variants.addAttribute")}
          </AppPrimaryButton>
        </Box>
        {activeAttributes.map((attr) => (
          <Box key={attr.id} mt={1.5}>
            <Typography variant="body2" style={{ fontWeight: 600 }}>
              {attr.name}
            </Typography>
            <Box display="flex" flexWrap="wrap" style={{ gap: 4 }} mt={0.5} mb={1}>
              {(attr.options || [])
                .filter((opt) => opt.active !== false)
                .map((opt) => (
                  <Chip key={opt.id} size="small" label={opt.value} />
                ))}
            </Box>
            <Box display="flex" flexWrap="wrap" style={{ gap: 8 }} alignItems="center">
              <TextField
                size="small"
                variant="outlined"
                label={i18n.t("inventorySales.products.variants.newOption")}
                value={newOptionByAttribute[attr.id] || ""}
                onChange={(e) =>
                  setNewOptionByAttribute((prev) => ({
                    ...prev,
                    [attr.id]: e.target.value,
                  }))
                }
                disabled={loading}
              />
              <AppPrimaryButton
                type="button"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => handleCreateOption(attr.id)}
                disabled={loading}
              >
                {i18n.t("inventorySales.products.variants.addOption")}
              </AppPrimaryButton>
            </Box>
          </Box>
        ))}
      </Box>

      <Box>
        <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
          {i18n.t("inventorySales.products.variants.listTitle")}
        </Typography>
        {loading ? (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("inventorySales.common.loading")}
          </Typography>
        ) : variants.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("inventorySales.products.variants.empty")}
          </Typography>
        ) : (
          <AppTableContainer nested>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("inventorySales.products.variants.columns.label")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.products.fields.sku")}</TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.products.fields.salePrice")}
                  </TableCell>
                  <TableCell>{i18n.t("inventorySales.products.columns.stock")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.common.active")}</TableCell>
                  <TableCell align="right">{i18n.t("inventorySales.common.actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell>{variant.label || "—"}</TableCell>
                    <TableCell>{variant.sku || "—"}</TableCell>
                    <TableCell align="right">
                      {formatCurrencyBRL(variant.salePrice)}
                    </TableCell>
                    <TableCell>
                      {variant.trackStock
                        ? formatQuantity(variant.currentQuantity)
                        : i18n.t("inventorySales.products.noStockTracking")}
                    </TableCell>
                    <TableCell>
                      {variant.active !== false
                        ? i18n.t("inventorySales.common.active")
                        : i18n.t("inventorySales.common.inactive")}
                    </TableCell>
                    <TableCell align="right">
                      {variant.active !== false ? (
                        <IconButton
                          size="small"
                          type="button"
                          aria-label={i18n.t(
                            "inventorySales.products.variants.deactivate"
                          )}
                          onClick={() => handleDeactivateVariant(variant)}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AppTableContainer>
        )}
      </Box>

      <Box border={1} borderColor="divider" borderRadius={8} p={2}>
        <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 12 }}>
          {i18n.t("inventorySales.products.variants.newVariant")}
        </Typography>
        <Grid container spacing={2}>
          {activeAttributes.map((attr) => (
            <Grid item xs={12} sm={6} key={attr.id}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel id={`variant-attr-${attr.id}`}>{attr.name}</InputLabel>
                <Select
                  labelId={`variant-attr-${attr.id}`}
                  value={variantForm.optionByAttribute[attr.id] || ""}
                  onChange={setVariantOption(attr.id)}
                  label={attr.name}
                  disabled={loading || savingVariant}
                >
                  <MenuItem value="">
                    <em>{i18n.t("inventorySales.common.select")}</em>
                  </MenuItem>
                  {(attr.options || [])
                    .filter((opt) => opt.active !== false)
                    .map((opt) => (
                      <MenuItem key={opt.id} value={String(opt.id)}>
                        {opt.value}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
          ))}
          <Grid item xs={12} sm={6}>
            <TextField
              label={i18n.t("inventorySales.products.fields.salePrice")}
              value={variantForm.salePrice}
              onChange={setVariantField("salePrice")}
              variant="outlined"
              size="small"
              fullWidth
              required
              disabled={loading || savingVariant}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label={i18n.t("inventorySales.products.fields.costPrice")}
              value={variantForm.costPrice}
              onChange={setVariantField("costPrice")}
              variant="outlined"
              size="small"
              fullWidth
              disabled={loading || savingVariant}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label={i18n.t("inventorySales.products.fields.sku")}
              value={variantForm.sku}
              onChange={setVariantField("sku")}
              variant="outlined"
              size="small"
              fullWidth
              disabled={loading || savingVariant}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label={i18n.t("inventorySales.products.fields.barcode")}
              value={variantForm.barcode}
              onChange={setVariantField("barcode")}
              variant="outlined"
              size="small"
              fullWidth
              disabled={loading || savingVariant}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label={i18n.t("inventorySales.products.fields.minStock")}
              value={variantForm.minStock}
              onChange={setVariantField("minStock")}
              variant="outlined"
              size="small"
              fullWidth
              type="number"
              inputProps={{ min: 0, step: "any" }}
              disabled={loading || savingVariant}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label={i18n.t("inventorySales.products.fields.initialQuantity")}
              value={variantForm.currentQuantity}
              onChange={setVariantField("currentQuantity")}
              variant="outlined"
              size="small"
              fullWidth
              type="number"
              inputProps={{ min: 0, step: "any" }}
              disabled={loading || savingVariant}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={variantForm.active}
                  onChange={setVariantField("active")}
                  color="primary"
                  disabled={loading || savingVariant}
                />
              }
              label={i18n.t("inventorySales.products.fields.active")}
            />
          </Grid>
        </Grid>
        <Box mt={2}>
          <AppPrimaryButton
            type="button"
            startIcon={<AddIcon />}
            onClick={handleCreateVariant}
            disabled={loading || savingVariant}
          >
            {i18n.t("inventorySales.products.variants.addVariant")}
          </AppPrimaryButton>
        </Box>
      </Box>
    </Box>
  );
}
