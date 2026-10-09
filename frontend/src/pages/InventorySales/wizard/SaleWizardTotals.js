import React from "react";
import { Box, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import { i18n } from "../../../translate/i18n";
import { computeSaleTotalsPreview } from "../saleDiscountPreview";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: theme.spacing(0.5),
  },
  total: {
    fontWeight: 700,
  },
  freightSlot: {},
}));

/**
 * Resumo monetário a partir de `sale` (backend autoritativo).
 * `previewFreightAmount` só para UX local antes do PUT delivery.
 */
export default function SaleWizardTotals({
  sale,
  itemCount,
  freightAmount = null,
  previewFreightAmount = null,
  dense = false,
}) {
  const classes = useStyles();
  const itemsLabel =
    itemCount != null
      ? i18n.t("inventorySales.sales.wizard.totals.itemsCount", { count: itemCount })
      : null;

  const previewOpts = {};
  if (previewFreightAmount != null) {
    previewOpts.previewFreightAmount = previewFreightAmount;
  } else if (freightAmount != null) {
    previewOpts.previewFreightAmount = freightAmount;
  }

  const totals = computeSaleTotalsPreview(sale, previewOpts);
  const shownFreight = totals.freight;

  const variant = dense ? "caption" : "body2";

  return (
    <Box className={classes.root} data-testid="sale-wizard-totals">
      {itemsLabel ? (
        <Typography variant="body2" color="textSecondary">
          {itemsLabel}
        </Typography>
      ) : null}
      <Typography variant={variant} color="textSecondary">
        {i18n.t("inventorySales.sales.totals.grossSubtotal")}:{" "}
        {formatCurrencyBRL(totals.grossSubtotal)}
      </Typography>
      <Typography variant={variant} color="textSecondary">
        {i18n.t("inventorySales.sales.totals.itemDiscounts")}:{" "}
        {formatCurrencyBRL(totals.itemDiscountTotal)}
      </Typography>
      <Typography variant={variant} color="textSecondary">
        {i18n.t("inventorySales.sales.totals.merchandiseAfterItems")}:{" "}
        {formatCurrencyBRL(totals.merchandiseAfterItems)}
      </Typography>
      {totals.globalDiscountAmount > 0 ? (
        <Typography
          variant={variant}
          color="textSecondary"
          data-testid="sale-wizard-global-discount-line"
        >
          {i18n.t("inventorySales.sales.totals.globalDiscount")}:{" "}
          {formatCurrencyBRL(totals.globalDiscountAmount)}
        </Typography>
      ) : null}
      {shownFreight > 0 ? (
        <Typography
          variant={variant}
          color="textSecondary"
          className={classes.freightSlot}
          data-testid="sale-wizard-freight-line"
        >
          {i18n.t("inventorySales.sales.wizard.totals.freight")}:{" "}
          {formatCurrencyBRL(shownFreight)}
        </Typography>
      ) : null}
      <Typography
        variant={dense ? "subtitle1" : "h6"}
        className={classes.total}
        data-testid="sale-wizard-total"
      >
        {i18n.t("inventorySales.sales.totals.total")}:{" "}
        {formatCurrencyBRL(totals.total)}
      </Typography>
    </Box>
  );
}
