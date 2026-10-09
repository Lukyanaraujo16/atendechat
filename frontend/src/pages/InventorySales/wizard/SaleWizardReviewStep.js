import React from "react";
import { Box, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { AppPrimaryButton } from "../../../ui";
import { i18n } from "../../../translate/i18n";
import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import { formatCardInstallmentCaption } from "../cardInstallments";
import { describeSalePaymentMethod } from "../paymentDisplay";
import SaleWizardTotals from "./SaleWizardTotals";
import {
  formatAddressOneLine,
  getSaleDeliverySnapshot,
} from "./deliveryAddressUtils";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  title: {
    fontWeight: 700,
  },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  label: {
    color: theme.palette.text.secondary,
    fontSize: "0.75rem",
  },
  value: {
    fontWeight: 600,
  },
  payRow: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}));

function methodLabel(method) {
  return i18n.t(`inventorySales.sales.paymentMethods.${method}`, method);
}

export default function SaleWizardReviewStep({
  sale,
  headerForm,
  paymentsBundle,
  canManagePayments,
  users,
  selectedCustomer,
  walkIn,
  confirming,
  onConfirm,
  storeCreditSchedule,
  storeCreditOverride,
}) {
  const classes = useStyles();
  const itemCount = Array.isArray(sale?.items) ? sale.items.length : 0;

  const customerLabel =
    walkIn || !selectedCustomer
      ? i18n.t("inventorySales.sales.wizard.customer.walkInSelected")
      : selectedCustomer.name;

  const sellerName =
    users.find((u) => String(u.id) === String(headerForm.sellerUserId))?.name ||
    sale?.seller?.name ||
    "—";

  const payments = Array.isArray(paymentsBundle?.payments)
    ? paymentsBundle.payments
    : [];
  const summary = paymentsBundle?.summary;
  const storeCreditAmount = payments
    .filter((p) => p.method === "store_credit")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);

  return (
    <Box className={classes.root} data-testid="sale-wizard-review-step">
      <Typography variant="h5" className={classes.title}>
        {i18n.t("inventorySales.sales.wizard.review.title")}
      </Typography>

      <Box className={classes.row}>
        <Typography className={classes.label}>
          {i18n.t("inventorySales.sales.fields.contact")}
        </Typography>
        <Typography className={classes.value} data-testid="sale-wizard-review-customer">
          {customerLabel}
        </Typography>
      </Box>

      <Box className={classes.row}>
        <Typography className={classes.label}>
          {i18n.t("inventorySales.sales.fields.seller")}
        </Typography>
        <Typography className={classes.value} data-testid="sale-wizard-review-seller">
          {sellerName}
        </Typography>
      </Box>

      <Box className={classes.row}>
        <Typography className={classes.label}>
          {i18n.t("inventorySales.sales.items.title")}
        </Typography>
        <Typography className={classes.value}>
          {i18n.t("inventorySales.sales.wizard.totals.itemsCount", { count: itemCount })}
        </Typography>
      </Box>

      {sale?.deliveryMethodName ? (
        <Box className={classes.row} data-testid="sale-wizard-review-delivery">
          <Typography className={classes.label}>
            {i18n.t("inventorySales.sales.wizard.delivery.reviewLabel")}
          </Typography>
          <Typography className={classes.value}>
            {sale.deliveryMethodName}
          </Typography>
          {Number(sale.freightAmount) > 0 ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("inventorySales.sales.wizard.delivery.feeLabel")}:{" "}
              {formatCurrencyBRL(sale.freightAmount)}
            </Typography>
          ) : null}
          {(() => {
            const snap = getSaleDeliverySnapshot(sale);
            if (!snap?.street) return null;
            return (
              <Typography variant="body2" style={{ whiteSpace: "pre-line" }}>
                {formatAddressOneLine(snap)}
              </Typography>
            );
          })()}
        </Box>
      ) : null}

      <SaleWizardTotals sale={sale} itemCount={itemCount} />

      <Box className={classes.row} data-testid="sale-wizard-review-payment">
        <Typography className={classes.label}>
          {i18n.t("inventorySales.sales.fields.paymentMethod")}
        </Typography>
        {canManagePayments && payments.length > 0 ? (
          <>
            {payments.map((payment) => (
              <Box key={payment.id} className={classes.payRow}>
                <Typography className={classes.value}>
                  {methodLabel(payment.method)}
                  {payment.method === "credit_card" && payment.cardInstallmentCount
                    ? ` · ${formatCardInstallmentCaption(
                        payment.cardInstallmentCount,
                        payment.amount
                      )}`
                    : ""}
                </Typography>
                <Typography variant="body2">
                  {formatCurrencyBRL(payment.amount)} —{" "}
                  {payment.status === "paid"
                    ? i18n.t("inventorySales.sales.wizard.payment.statusPaid")
                    : i18n.t("inventorySales.sales.wizard.payment.statusPending")}
                </Typography>
              </Box>
            ))}
            <Typography variant="body2" color="textSecondary">
              {i18n.t("inventorySales.sales.wizard.payment.received")}:{" "}
              {formatCurrencyBRL(summary?.effectivePaid ?? 0)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {i18n.t("inventorySales.sales.wizard.payment.pending")}:{" "}
              {formatCurrencyBRL(summary?.pendingAmount ?? 0)}
            </Typography>
          </>
        ) : (
          <Typography className={classes.value}>
            {describeSalePaymentMethod(sale)}
          </Typography>
        )}
      </Box>

      {storeCreditAmount > 0 ? (
        <Box className={classes.row} data-testid="sale-wizard-review-store-credit">
          <Typography className={classes.label}>
            {i18n.t("inventorySales.storeCredit.label")}
          </Typography>
          <Typography className={classes.value}>
            {formatCurrencyBRL(storeCreditAmount)}
          </Typography>
          {storeCreditSchedule?.frequency ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t(
                `inventorySales.sales.wizard.payment.frequencies.${storeCreditSchedule.frequency}`
              )}
              {storeCreditSchedule.frequency !== "once"
                ? ` · ${storeCreditSchedule.installmentCount}x`
                : ""}
              {storeCreditSchedule.firstDueDate
                ? ` · ${storeCreditSchedule.firstDueDate}`
                : ""}
            </Typography>
          ) : null}
          {storeCreditOverride?.authorizeOverride ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t(
                "inventorySales.sales.wizard.payment.storeCreditOverride"
              )}
              {storeCreditOverride.reason
                ? `: ${storeCreditOverride.reason}`
                : ""}
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {headerForm.notes ? (
        <Box className={classes.row}>
          <Typography className={classes.label}>
            {i18n.t("inventorySales.sales.fields.notes")}
          </Typography>
          <Typography variant="body2">{headerForm.notes}</Typography>
        </Box>
      ) : null}

      <Box>
        <AppPrimaryButton
          onClick={onConfirm}
          disabled={confirming || itemCount < 1}
          data-testid="sale-wizard-confirm"
        >
          {confirming
            ? i18n.t("inventorySales.sales.wizard.review.confirming")
            : i18n.t("inventorySales.sales.wizard.review.confirm")}
        </AppPrimaryButton>
      </Box>
    </Box>
  );
}
