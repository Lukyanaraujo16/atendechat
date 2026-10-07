import React from "react";
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import { i18n } from "../../../translate/i18n";
import { PAYMENT_METHODS } from "../constants";
import {
  CARD_INSTALLMENT_OPTIONS,
  formatCardInstallmentCaption,
} from "../cardInstallments";
import {
  defaultRegisterAsPaid,
  isRegisterAsPaidLocked,
} from "./paymentDefaults";
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
  methods: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: theme.spacing(1),
  },
  methodBtn: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1.5, 1),
    textAlign: "center",
    cursor: "pointer",
    background: "transparent",
    font: "inherit",
    color: theme.palette.text.primary,
    minHeight: 56,
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  },
  methodSelected: {
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
    fontWeight: 600,
    boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
  },
  readonly: {
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
}));

export default function SaleWizardPaymentStep({
  sale,
  paymentForm,
  setPaymentForm,
  registerAsPaid,
  setRegisterAsPaid,
  canManagePayments,
  disabled,
}) {
  const classes = useStyles();
  const totalLabel = formatCurrencyBRL(sale?.totalAmount);
  const itemCount = Array.isArray(sale?.items) ? sale.items.length : 0;

  if (!canManagePayments) {
    const method = sale?.paymentMethod;
    return (
      <Box className={classes.root} data-testid="sale-wizard-payment-step">
        <Typography variant="h5" className={classes.title}>
          {i18n.t("inventorySales.sales.wizard.payment.title", { total: totalLabel })}
        </Typography>
        <Box className={classes.readonly} data-testid="sale-wizard-payment-readonly">
          {method ? (
            <>
              <Typography variant="body1">
                {i18n.t(`inventorySales.sales.paymentMethods.${method}`, method)}
                {method === "credit_card" && sale.cardInstallmentCount
                  ? ` — ${formatCardInstallmentCaption(
                      sale.cardInstallmentCount,
                      sale.totalAmount
                    )}`
                  : ""}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {i18n.t("inventorySales.sales.wizard.payment.readonlyHint")}
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="body1">
                {i18n.t("inventorySales.sales.wizard.payment.noPermissionTitle")}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {i18n.t("inventorySales.sales.wizard.payment.noPermissionBody")}
              </Typography>
            </>
          )}
        </Box>
        <SaleWizardTotals sale={sale} itemCount={itemCount} />
      </Box>
    );
  }

  const selectMethod = (method) => {
    setPaymentForm((prev) => ({
      ...prev,
      paymentMethod: method,
      cardInstallmentCount: method === "credit_card" ? "1" : "",
    }));
    setRegisterAsPaid(defaultRegisterAsPaid(method));
  };

  const lockedPaid = isRegisterAsPaidLocked(paymentForm.paymentMethod);

  return (
    <Box className={classes.root} data-testid="sale-wizard-payment-step">
      <Typography variant="h5" className={classes.title}>
        {i18n.t("inventorySales.sales.wizard.payment.title", { total: totalLabel })}
      </Typography>

      <Box className={classes.methods} role="group" aria-label={i18n.t("inventorySales.sales.fields.paymentMethod")}>
        {PAYMENT_METHODS.map((method) => {
          const selected = paymentForm.paymentMethod === method;
          return (
            <button
              key={method}
              type="button"
              className={`${classes.methodBtn} ${
                selected ? classes.methodSelected : ""
              }`}
              disabled={disabled}
              aria-pressed={selected}
              data-testid={`sale-wizard-pay-${method}`}
              onClick={() => selectMethod(method)}
            >
              {i18n.t(`inventorySales.sales.paymentMethods.${method}`, method)}
            </button>
          );
        })}
      </Box>

      {paymentForm.paymentMethod === "credit_card" ? (
        <>
          <FormControl variant="outlined" size="small" fullWidth disabled={disabled}>
            <InputLabel id="wizard-installments-label">
              {i18n.t("inventorySales.sales.payment.installments")}
            </InputLabel>
            <Select
              labelId="wizard-installments-label"
              value={paymentForm.cardInstallmentCount || "1"}
              onChange={(e) =>
                setPaymentForm((prev) => ({
                  ...prev,
                  cardInstallmentCount: String(e.target.value),
                }))
              }
              label={i18n.t("inventorySales.sales.payment.installments")}
              SelectDisplayProps={{
                "data-testid": "sale-wizard-card-installments",
              }}
            >
              {CARD_INSTALLMENT_OPTIONS.map((count) => (
                <MenuItem key={count} value={String(count)}>
                  {count}x
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography
            variant="body2"
            color="textSecondary"
            data-testid="sale-wizard-card-caption"
          >
            {formatCardInstallmentCaption(
              Number(paymentForm.cardInstallmentCount || 1),
              sale?.totalAmount
            )}
          </Typography>
        </>
      ) : null}

      {paymentForm.paymentMethod ? (
        <FormControlLabel
          control={
            <Checkbox
              color="primary"
              checked={Boolean(registerAsPaid)}
              disabled={disabled || lockedPaid}
              onChange={(e) => setRegisterAsPaid(e.target.checked)}
              inputProps={{ "data-testid": "sale-wizard-register-as-paid" }}
            />
          }
          label={
            lockedPaid
              ? i18n.t("inventorySales.sales.wizard.payment.registerAsPaidLocked")
              : i18n.t("inventorySales.sales.wizard.payment.registerAsPaid")
          }
        />
      ) : null}

      <TextField
        label={i18n.t("inventorySales.sales.fields.paymentNotes")}
        value={paymentForm.paymentNotes}
        onChange={(e) =>
          setPaymentForm((prev) => ({
            ...prev,
            paymentNotes: e.target.value,
          }))
        }
        variant="outlined"
        size="small"
        fullWidth
        multiline
        rows={2}
        disabled={disabled}
      />

      <SaleWizardTotals sale={sale} itemCount={itemCount} />
    </Box>
  );
}
