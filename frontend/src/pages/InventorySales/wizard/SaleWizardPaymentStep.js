import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import { makeStyles } from "@material-ui/core/styles";

import {
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../../ui";
import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import { i18n } from "../../../translate/i18n";
import toastError from "../../../errors/toastError";
import {
  addInventorySalePayment,
  deleteInventorySalePaymentLine,
  getInventorySalePayments,
  settleInventorySalePaymentLine,
} from "../../../services/inventoryApi";
import { PAYMENT_METHODS } from "../constants";
import {
  CARD_INSTALLMENT_OPTIONS,
  formatCardInstallmentCaption,
} from "../cardInstallments";
import CurrencyInput from "../CurrencyInput";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  title: {
    fontWeight: 700,
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing(1.5),
    [theme.breakpoints.up("sm")]: {
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    },
  },
  summaryItem: {
    minWidth: 0,
  },
  summaryLabel: {
    color: theme.palette.text.secondary,
    fontSize: "0.75rem",
  },
  summaryValue: {
    fontWeight: 700,
    fontSize: "1.05rem",
  },
  remaining: {
    color: theme.palette.primary.main,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  rowMain: {
    minWidth: 0,
    flex: 1,
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  statusPaid: {
    color: theme.palette.success.main,
    fontWeight: 600,
    fontSize: "0.8rem",
  },
  statusPending: {
    color: theme.palette.warning.dark,
    fontWeight: 600,
    fontSize: "0.8rem",
  },
  empty: {
    padding: theme.spacing(3, 0),
    color: theme.palette.text.secondary,
  },
  readonly: {
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

function defaultStatusForMethod(method) {
  if (
    method === "cash" ||
    method === "pix" ||
    method === "credit_card" ||
    method === "debit_card" ||
    method === "bank_transfer"
  ) {
    return "paid";
  }
  return "pending";
}

function methodLabel(method) {
  return i18n.t(`inventorySales.sales.paymentMethods.${method}`, method);
}

function paymentLineCaption(payment) {
  const base = methodLabel(payment.method);
  if (payment.method === "credit_card" && payment.cardInstallmentCount) {
    return `${base} · ${formatCardInstallmentCaption(
      payment.cardInstallmentCount,
      payment.amount
    )}`;
  }
  return base;
}

export default function SaleWizardPaymentStep({
  sale,
  canManagePayments,
  disabled,
  paymentsBundle,
  setPaymentsBundle,
  onSaleCacheMaybeChanged,
}) {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const submitLock = useRef(false);

  const [formMethod, setFormMethod] = useState("cash");
  const [formAmount, setFormAmount] = useState(0);
  const [formStatus, setFormStatus] = useState("paid");
  const [formInstallments, setFormInstallments] = useState("1");
  const [formNotes, setFormNotes] = useState("");

  const summary = paymentsBundle?.summary;
  const payments = Array.isArray(paymentsBundle?.payments)
    ? paymentsBundle.payments
    : [];

  const loadPayments = useCallback(async () => {
    if (!sale?.id || !canManagePayments) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await getInventorySalePayments(sale.id);
      setPaymentsBundle(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [sale?.id, canManagePayments, setPaymentsBundle]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const openAddDialog = () => {
    const remaining = Number(summary?.remainingToAllocate ?? sale?.totalAmount ?? 0);
    setFormMethod("cash");
    setFormAmount(remaining > 0 ? remaining : 0);
    setFormStatus("paid");
    setFormInstallments("1");
    setFormNotes("");
    setDialogOpen(true);
  };

  const handleMethodChange = (method) => {
    setFormMethod(method);
    const nextStatus =
      method === "credit_card" ? "paid" : defaultStatusForMethod(method);
    setFormStatus(nextStatus);
    if (method !== "credit_card") setFormInstallments("1");
  };

  const handleAdd = async () => {
    if (submitLock.current || submitting || !sale?.id) return;
    if (!(formAmount > 0)) {
      return;
    }
    if (formMethod === "credit_card") {
      const count = Number(formInstallments);
      if (!Number.isInteger(count) || count < 1 || count > 18) return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const body = {
        method: formMethod,
        amount: formAmount,
        status: formMethod === "credit_card" ? "paid" : formStatus,
        notes: formNotes.trim() || null,
      };
      if (formMethod === "credit_card") {
        body.cardInstallmentCount = Number(formInstallments);
      }
      const { data } = await addInventorySalePayment(sale.id, body);
      setPaymentsBundle(data);
      setDialogOpen(false);
      if (onSaleCacheMaybeChanged) await onSaleCacheMaybeChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  const handleDelete = async (payment) => {
    if (payment.status !== "pending" || busyId != null) return;
    setBusyId(payment.id);
    try {
      const { data } = await deleteInventorySalePaymentLine(sale.id, payment.id);
      setPaymentsBundle(data);
      if (onSaleCacheMaybeChanged) await onSaleCacheMaybeChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleSettle = async (payment) => {
    if (payment.status !== "pending" || busyId != null) return;
    setBusyId(payment.id);
    try {
      const { data } = await settleInventorySalePaymentLine(sale.id, payment.id);
      setPaymentsBundle(data);
      if (onSaleCacheMaybeChanged) await onSaleCacheMaybeChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setBusyId(null);
    }
  };

  if (!canManagePayments) {
    return (
      <Box className={classes.root} data-testid="sale-wizard-payment-step">
        <Typography variant="h5" className={classes.title}>
          {i18n.t("inventorySales.sales.wizard.payment.titleSplit")}
        </Typography>
        <Box className={classes.readonly}>
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            {i18n.t("inventorySales.sales.wizard.payment.noPermissionTitle")}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("inventorySales.sales.wizard.payment.noPermissionBody")}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box className={classes.root} data-testid="sale-wizard-payment-step">
      <Typography variant="h5" className={classes.title}>
        {i18n.t("inventorySales.sales.wizard.payment.titleSplit")}
      </Typography>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          <Box className={classes.summary} data-testid="sale-wizard-payment-summary">
            <Box className={classes.summaryItem}>
              <Typography className={classes.summaryLabel}>
                {i18n.t("inventorySales.sales.wizard.payment.total")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {formatCurrencyBRL(summary?.totalAmount ?? sale?.totalAmount)}
              </Typography>
            </Box>
            <Box className={classes.summaryItem}>
              <Typography className={classes.summaryLabel}>
                {i18n.t("inventorySales.sales.wizard.payment.received")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {formatCurrencyBRL(summary?.effectivePaid ?? 0)}
              </Typography>
            </Box>
            <Box className={classes.summaryItem}>
              <Typography className={classes.summaryLabel}>
                {i18n.t("inventorySales.sales.wizard.payment.pending")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {formatCurrencyBRL(summary?.pendingAmount ?? 0)}
              </Typography>
            </Box>
            <Box className={classes.summaryItem}>
              <Typography className={classes.summaryLabel}>
                {i18n.t("inventorySales.sales.wizard.payment.remaining")}
              </Typography>
              <Typography
                className={`${classes.summaryValue} ${classes.remaining}`}
                data-testid="sale-wizard-payment-remaining"
              >
                {formatCurrencyBRL(summary?.remainingToAllocate ?? 0)}
              </Typography>
            </Box>
          </Box>

          <Box className={classes.list} data-testid="sale-wizard-payment-list">
            {payments.length === 0 ? (
              <Typography className={classes.empty}>
                {i18n.t("inventorySales.sales.wizard.payment.empty")}
              </Typography>
            ) : (
              payments.map((payment) => (
                <Box
                  key={payment.id}
                  className={classes.row}
                  data-testid={`sale-wizard-payment-row-${payment.id}`}
                >
                  <Box className={classes.rowMain}>
                    <Typography style={{ fontWeight: 600 }}>
                      {paymentLineCaption(payment)}
                    </Typography>
                    <Typography variant="body2">
                      {formatCurrencyBRL(payment.amount)}
                    </Typography>
                    <Typography
                      className={
                        payment.status === "paid"
                          ? classes.statusPaid
                          : classes.statusPending
                      }
                    >
                      {payment.status === "paid"
                        ? i18n.t("inventorySales.sales.wizard.payment.statusPaid")
                        : i18n.t(
                            "inventorySales.sales.wizard.payment.statusPending"
                          )}
                    </Typography>
                  </Box>
                  <Box className={classes.rowActions}>
                    {payment.status === "pending" && (
                      <>
                        <IconButton
                          size="small"
                          aria-label={i18n.t(
                            "inventorySales.sales.wizard.payment.markReceived"
                          )}
                          disabled={disabled || busyId === payment.id}
                          onClick={() => handleSettle(payment)}
                        >
                          {busyId === payment.id ? (
                            <CircularProgress size={18} />
                          ) : (
                            <CheckCircleOutlineIcon fontSize="small" />
                          )}
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={i18n.t(
                            "inventorySales.sales.wizard.payment.remove"
                          )}
                          disabled={disabled || busyId === payment.id}
                          onClick={() => handleDelete(payment)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                    {payment.status === "paid" && (
                      <Typography variant="caption" color="textSecondary">
                        {i18n.t("inventorySales.sales.wizard.payment.registered")}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))
            )}
          </Box>

          <AppPrimaryButton
            onClick={openAddDialog}
            disabled={disabled || Number(summary?.remainingToAllocate) <= 0}
            data-testid="sale-wizard-payment-add"
          >
            {i18n.t("inventorySales.sales.wizard.payment.add")}
          </AppPrimaryButton>
        </>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => !submitting && setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        data-testid="sale-wizard-payment-dialog"
      >
        <DialogTitle>
          {i18n.t("inventorySales.sales.wizard.payment.add")}
        </DialogTitle>
        <DialogContent>
          <Box className={classes.formStack}>
            <FormControl variant="outlined" fullWidth size="small">
              <InputLabel>
                {i18n.t("inventorySales.sales.wizard.payment.method")}
              </InputLabel>
              <Select
                label={i18n.t("inventorySales.sales.wizard.payment.method")}
                value={formMethod}
                onChange={(e) => handleMethodChange(e.target.value)}
                disabled={submitting}
              >
                {PAYMENT_METHODS.map((method) => (
                  <MenuItem key={method} value={method}>
                    {methodLabel(method)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <CurrencyInput
              label={i18n.t("inventorySales.sales.wizard.payment.amount")}
              value={formAmount}
              onChange={setFormAmount}
              disabled={submitting}
              fullWidth
              size="small"
              variant="outlined"
            />

            {formMethod === "credit_card" ? (
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel>
                  {i18n.t("inventorySales.sales.wizard.payment.installments")}
                </InputLabel>
                <Select
                  label={i18n.t(
                    "inventorySales.sales.wizard.payment.installments"
                  )}
                  value={formInstallments}
                  onChange={(e) => setFormInstallments(e.target.value)}
                  disabled={submitting}
                >
                  {CARD_INSTALLMENT_OPTIONS.map((n) => (
                    <MenuItem key={n} value={String(n)}>
                      {formatCardInstallmentCaption(n, formAmount)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              formMethod !== "credit_card" && (
                <FormControl variant="outlined" fullWidth size="small">
                  <InputLabel>
                    {i18n.t("inventorySales.sales.wizard.payment.situation")}
                  </InputLabel>
                  <Select
                    label={i18n.t(
                      "inventorySales.sales.wizard.payment.situation"
                    )}
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    disabled={submitting}
                  >
                    <MenuItem value="paid">
                      {i18n.t("inventorySales.sales.wizard.payment.statusPaid")}
                    </MenuItem>
                    <MenuItem value="pending">
                      {i18n.t(
                        "inventorySales.sales.wizard.payment.statusPending"
                      )}
                    </MenuItem>
                  </Select>
                </FormControl>
              )
            )}

            <TextField
              label={i18n.t("inventorySales.sales.wizard.payment.notes")}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              disabled={submitting}
              fullWidth
              size="small"
              variant="outlined"
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton
            onClick={() => setDialogOpen(false)}
            disabled={submitting}
          >
            {i18n.t("inventorySales.sales.wizard.nav.back")}
          </AppSecondaryButton>
          <AppPrimaryButton
            onClick={handleAdd}
            disabled={submitting || !(formAmount > 0)}
            data-testid="sale-wizard-payment-submit"
          >
            {submitting
              ? i18n.t("inventorySales.sales.wizard.nav.saving")
              : i18n.t("inventorySales.sales.wizard.payment.save")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
