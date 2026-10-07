import React, { useState } from "react";
import { Box, Chip, CircularProgress, Typography } from "@material-ui/core";
import ReceiptIcon from "@material-ui/icons/Receipt";
import { makeStyles } from "@material-ui/core/styles";
import { useHistory } from "react-router-dom";

import {
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../../ui";
import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import { i18n } from "../../../translate/i18n";
import { getInventorySale } from "../../../services/inventoryApi";
import toastError from "../../../errors/toastError";
import { formatCardPaymentLabel } from "../cardInstallments";
import { formatSaleNumber, paymentStatusChipColor } from "../utils";
import SaleReceiptDialog from "../SaleReceiptDialog";
import SaleWizardTotals from "./SaleWizardTotals";
import {
  getInventorySaleItems,
  normalizeInventorySale,
} from "../normalizeInventorySale";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    alignItems: "flex-start",
  },
  title: {
    fontWeight: 700,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
}));

export default function SaleWizardSuccess({
  sale,
  onOpenSale,
  onNewSale,
}) {
  const classes = useStyles();
  const history = useHistory();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSale, setReceiptSale] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const itemCount = getInventorySaleItems(sale).length;

  const methodLabel = sale?.paymentMethod
    ? formatCardPaymentLabel(
        i18n.t(
          `inventorySales.sales.paymentMethods.${sale.paymentMethod}`,
          sale.paymentMethod
        ),
        sale.paymentMethod,
        sale.cardInstallmentCount,
        sale.totalAmount
      )
    : i18n.t("inventorySales.sales.payment.noMethod");

  const handleOpenReceipt = async () => {
    if (!sale?.id || receiptLoading) return;
    setReceiptOpen(true);
    setReceiptLoading(true);
    setReceiptSale(null);
    try {
      // Mesmo caminho do drawer: GET fresco com includes completos.
      const { data } = await getInventorySale(sale.id);
      setReceiptSale(normalizeInventorySale(data));
    } catch (err) {
      toastError(err);
      setReceiptSale(normalizeInventorySale(sale));
    } finally {
      setReceiptLoading(false);
    }
  };

  return (
    <Box className={classes.root} data-testid="sale-wizard-success">
      <Typography variant="h5" className={classes.title}>
        {i18n.t("inventorySales.sales.wizard.success.title", {
          number: formatSaleNumber(sale),
        })}
      </Typography>

      <SaleWizardTotals sale={sale} itemCount={itemCount} />

      <Typography variant="body1">
        {i18n.t("inventorySales.sales.fields.paymentMethod")}: {methodLabel}
      </Typography>

      {sale?.paymentStatus ? (
        <Chip
          size="small"
          color={paymentStatusChipColor(sale.paymentStatus)}
          label={i18n.t(
            `inventorySales.sales.paymentStatus.${sale.paymentStatus}`,
            sale.paymentStatus
          )}
          data-testid="sale-wizard-success-payment-status"
        />
      ) : null}

      <Typography variant="body2" color="textSecondary">
        {i18n.t("inventorySales.sales.wizard.success.paidAmount")}:{" "}
        {formatCurrencyBRL(sale?.paidAmount)}
      </Typography>

      <Box className={classes.actions}>
        <AppSecondaryButton
          startIcon={
            receiptLoading ? <CircularProgress size={16} /> : <ReceiptIcon />
          }
          onClick={handleOpenReceipt}
          disabled={receiptLoading}
          data-testid="sale-wizard-print-receipt"
        >
          {i18n.t("inventorySales.sales.wizard.success.printReceipt")}
        </AppSecondaryButton>
        <AppSecondaryButton
          onClick={() => onOpenSale && onOpenSale(sale.id)}
          data-testid="sale-wizard-view-sale"
        >
          {i18n.t("inventorySales.sales.wizard.success.viewSale")}
        </AppSecondaryButton>
        <AppPrimaryButton
          onClick={onNewSale}
          data-testid="sale-wizard-new-sale"
        >
          {i18n.t("inventorySales.sales.wizard.success.newSale")}
        </AppPrimaryButton>
        <AppSecondaryButton
          onClick={() => history.push("/inventory-sales")}
          data-testid="sale-wizard-back-list"
        >
          {i18n.t("inventorySales.sales.wizard.success.backToSales")}
        </AppSecondaryButton>
      </Box>

      <SaleReceiptDialog
        open={receiptOpen}
        onClose={() => {
          setReceiptOpen(false);
          setReceiptSale(null);
        }}
        sale={receiptSale || normalizeInventorySale(sale)}
      />
    </Box>
  );
}
