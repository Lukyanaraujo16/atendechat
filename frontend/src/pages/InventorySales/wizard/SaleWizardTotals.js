import React from "react";
import { Box, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import { i18n } from "../../../translate/i18n";

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

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

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

  const persistedFreight = money(sale?.freightAmount);
  const shownFreight =
    previewFreightAmount != null
      ? money(previewFreightAmount)
      : freightAmount != null
        ? money(freightAmount)
        : persistedFreight;

  const merchandise = roundMoney(money(sale?.totalAmount) - persistedFreight);
  const shownTotal =
    previewFreightAmount != null
      ? roundMoney(merchandise + shownFreight)
      : money(sale?.totalAmount);

  return (
    <Box className={classes.root} data-testid="sale-wizard-totals">
      {itemsLabel ? (
        <Typography variant="body2" color="textSecondary">
          {itemsLabel}
        </Typography>
      ) : null}
      <Typography variant={dense ? "caption" : "body2"} color="textSecondary">
        {i18n.t("inventorySales.sales.totals.subtotal")}:{" "}
        {formatCurrencyBRL(sale?.subtotalAmount)}
      </Typography>
      <Typography variant={dense ? "caption" : "body2"} color="textSecondary">
        {i18n.t("inventorySales.sales.totals.discount")}:{" "}
        {formatCurrencyBRL(sale?.discountAmount)}
      </Typography>
      {shownFreight > 0 ? (
        <Typography
          variant={dense ? "caption" : "body2"}
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
        {formatCurrencyBRL(shownTotal)}
      </Typography>
    </Box>
  );
}
