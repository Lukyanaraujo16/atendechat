import React from "react";
import { Box, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { AppPrimaryButton } from "../../../ui";
import { i18n } from "../../../translate/i18n";
import { formatCardPaymentLabel } from "../cardInstallments";
import SaleWizardTotals from "./SaleWizardTotals";

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
}));

export default function SaleWizardReviewStep({
  sale,
  headerForm,
  paymentForm,
  registerAsPaid,
  canManagePayments,
  users,
  selectedContact,
  walkIn,
  confirming,
  onConfirm,
}) {
  const classes = useStyles();
  const itemCount = Array.isArray(sale?.items) ? sale.items.length : 0;

  const customerLabel = walkIn || !selectedContact
    ? i18n.t("inventorySales.sales.wizard.customer.walkInSelected")
    : selectedContact.name;

  const sellerName =
    users.find((u) => String(u.id) === String(headerForm.sellerUserId))?.name ||
    sale?.seller?.name ||
    "—";

  const method = canManagePayments
    ? paymentForm.paymentMethod || sale?.paymentMethod
    : sale?.paymentMethod;

  const installmentCount = canManagePayments
    ? paymentForm.cardInstallmentCount || sale?.cardInstallmentCount
    : sale?.cardInstallmentCount;

  const methodLabel = method
    ? formatCardPaymentLabel(
        i18n.t(`inventorySales.sales.paymentMethods.${method}`, method),
        method,
        installmentCount,
        sale?.totalAmount
      )
    : i18n.t("inventorySales.sales.payment.noMethod");

  const willBePaid =
    method === "credit_card" ||
    (canManagePayments && Boolean(registerAsPaid) && Boolean(method));

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

      <SaleWizardTotals sale={sale} itemCount={itemCount} />

      <Box className={classes.row}>
        <Typography className={classes.label}>
          {i18n.t("inventorySales.sales.fields.paymentMethod")}
        </Typography>
        <Typography className={classes.value} data-testid="sale-wizard-review-payment">
          {methodLabel}
        </Typography>
      </Box>

      <Box className={classes.row}>
        <Typography className={classes.label}>
          {i18n.t("inventorySales.sales.wizard.review.expectedStatus")}
        </Typography>
        <Typography
          className={classes.value}
          data-testid="sale-wizard-review-paid-status"
        >
          {willBePaid
            ? i18n.t("inventorySales.sales.wizard.review.willBePaid")
            : i18n.t("inventorySales.sales.wizard.review.willBePending")}
        </Typography>
      </Box>

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
