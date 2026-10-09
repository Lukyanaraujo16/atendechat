import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import { listInventoryProductVariants } from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { formatQuantity } from "./utils";
import { resolveVariantImageUrl } from "./productVariantCombinations";

const useStyles = makeStyles((theme) => ({
  menuItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 4,
    objectFit: "cover",
    border: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
}));

export default function SaleVariantPickerDialog({
  open,
  product,
  onClose,
  onSelect,
}) {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState([]);
  const [variantId, setVariantId] = useState("");

  useEffect(() => {
    if (!open || !product?.id) {
      setVariants([]);
      setVariantId("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    listInventoryProductVariants(product.id, { active: true })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        setVariants(rows);
        setVariantId(rows[0]?.id != null ? String(rows[0].id) : "");
      })
      .catch((err) => {
        if (!cancelled) toastError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, product?.id]);

  const selected =
    variants.find((v) => String(v.id) === String(variantId)) || null;

  const handleConfirm = () => {
    if (!selected) return;
    onSelect(selected);
  };

  return (
    <AppDialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <AppDialogTitle>
        {i18n.t("inventorySales.sales.items.variants.pickTitle")}
      </AppDialogTitle>
      <AppDialogContent>
        {product?.name ? (
          <Typography variant="body2" color="textSecondary" gutterBottom>
            {product.name}
          </Typography>
        ) : null}
        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={28} />
          </Box>
        ) : variants.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("inventorySales.sales.items.variants.empty")}
          </Typography>
        ) : (
          <FormControl variant="outlined" size="small" fullWidth>
            <InputLabel id="sale-variant-pick-label">
              {i18n.t("inventorySales.sales.items.variants.field")}
            </InputLabel>
            <Select
              labelId="sale-variant-pick-label"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              label={i18n.t("inventorySales.sales.items.variants.field")}
            >
              {variants.map((variant) => {
                const imageUrl = resolveVariantImageUrl(variant, product);
                return (
                  <MenuItem key={variant.id} value={String(variant.id)}>
                    <Box className={classes.menuItem}>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt=""
                          className={classes.thumb}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                      <span>
                        {variant.label || `#${variant.id}`}
                        {" · "}
                        {formatCurrencyBRL(variant.salePrice)}
                        {variant.trackStock
                          ? ` · ${formatQuantity(variant.currentQuantity)}`
                          : ""}
                      </span>
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        )}
      </AppDialogContent>
      <AppDialogActions>
        <AppSecondaryButton type="button" onClick={onClose}>
          {i18n.t("inventorySales.common.cancel")}
        </AppSecondaryButton>
        <AppPrimaryButton
          type="button"
          onClick={handleConfirm}
          disabled={!selected || loading}
        >
          {i18n.t("inventorySales.sales.items.variants.confirm")}
        </AppPrimaryButton>
      </AppDialogActions>
    </AppDialog>
  );
}
