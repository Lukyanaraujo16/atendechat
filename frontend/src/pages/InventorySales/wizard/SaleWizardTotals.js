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
  /** Slot futuro: frete/entrega entre desconto e total. */
  freightSlot: {},
}));

/**
 * Resumo monetário autoritativo a partir de `sale`.
 * Estrutura preparada para linha de frete futura sem redesign.
 */
export default function SaleWizardTotals({
  sale,
  itemCount,
  freightAmount = null,
  dense = false,
}) {
  const classes = useStyles();
  const itemsLabel =
    itemCount != null
      ? i18n.t("inventorySales.sales.wizard.totals.itemsCount", { count: itemCount })
      : null;

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
      {freightAmount != null && Number(freightAmount) > 0 ? (
        <Typography
          variant={dense ? "caption" : "body2"}
          color="textSecondary"
          className={classes.freightSlot}
          data-testid="sale-wizard-freight-line"
        >
          {i18n.t("inventorySales.sales.wizard.totals.freight")}:{" "}
          {formatCurrencyBRL(freightAmount)}
        </Typography>
      ) : null}
      <Typography
        variant={dense ? "subtitle1" : "h6"}
        className={classes.total}
        data-testid="sale-wizard-total"
      >
        {i18n.t("inventorySales.sales.totals.total")}:{" "}
        {formatCurrencyBRL(sale?.totalAmount)}
      </Typography>
    </Box>
  );
}
