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
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import { makeStyles } from "@material-ui/core/styles";
import { format } from "date-fns";

import {
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import ConfirmationModal from "../../components/ConfirmationModal";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import {
  addInventorySalePayment,
  deleteInventorySalePaymentLine,
  getInventorySalePayments,
  settleInventorySalePaymentLine,
  updateInventorySalePaymentLine,
} from "../../services/inventoryApi";
import { PAYMENT_METHODS } from "./constants";
import {
  CARD_INSTALLMENT_OPTIONS,
  formatCardInstallmentCaption,
} from "./cardInstallments";
import CurrencyInput from "./CurrencyInput";
import {
  defaultPaymentStatusForMethod,
  describeSalePaymentMethod,
  getInventoryPaymentMethodLabel,
  getInventoryPaymentStatusLabel,
  paymentLineCaption,
} from "./paymentDisplay";
import { toNumber } from "./utils";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing(1),
    [theme.breakpoints.up("sm")]: {
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    },
  },
  summaryLabel: {
    color: theme.palette.text.secondary,
    fontSize: "0.75rem",
  },
  summaryValue: {
    fontWeight: 700,
    fontSize: "0.95rem",
  },
  fullyPaid: {
    color: theme.palette.success.main,
    fontWeight: 600,
  },
  list: {
    display: "flex",
    flexDirection: "column",
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  rowMain: {
    minWidth: 0,
    flex: 1,
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
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
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  legacyBox: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
  },
}));

function formatPaidAt(value) {
  if (!value) return null;
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  } catch {
    return null;
  }
}

export default function SalePaymentsSection({
  sale,
  canManagePayments,
  onSaleMaybeChanged,
  onLegacyUpdateClick,
}) {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editPayment, setEditPayment] = useState(null);
  const [settlePayment, setSettlePayment] = useState(null);
  const [removePayment, setRemovePayment] = useState(null);

  const [formMethod, setFormMethod] = useState("cash");
  const [formAmount, setFormAmount] = useState(0);
  const [formStatus, setFormStatus] = useState("paid");
  const [formInstallments, setFormInstallments] = useState("1");
  const [formNotes, setFormNotes] = useState("");
  const [settleAt, setSettleAt] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const submitLock = useRef(false);

  const cancelled = sale?.status === "cancelled";
  const completed = sale?.status === "completed";
  const canMutate = Boolean(canManagePayments && completed && !cancelled);

  const payments = Array.isArray(bundle?.payments) ? bundle.payments : [];
  const summary = bundle?.summary;
  const remainingToAllocate = Number(summary?.remainingToAllocate ?? 0);
  const effectivePaid = Number(summary?.effectivePaid ?? 0);
  const totalAmount = Number(summary?.totalAmount ?? sale?.totalAmount ?? 0);
  const fullyPaid = totalAmount > 0 && effectivePaid >= totalAmount - 0.00001;

  const loadPayments = useCallback(async () => {
    if (!sale?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await getInventorySalePayments(sale.id);
      setBundle(data);
    } catch (err) {
      setLoadError(true);
      setBundle(null);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [sale?.id]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const applyBundle = async (data) => {
    setBundle(data);
    if (onSaleMaybeChanged) await onSaleMaybeChanged();
  };

  const openAdd = () => {
    const remaining = remainingToAllocate > 0 ? remainingToAllocate : 0;
    setFormMethod("cash");
    setFormAmount(remaining);
    setFormStatus("paid");
    setFormInstallments("1");
    setFormNotes("");
    setAddOpen(true);
  };

  const openEdit = (payment) => {
    setEditPayment(payment);
    setFormMethod(payment.method);
    setFormAmount(toNumber(payment.amount));
    setFormStatus("pending");
    setFormInstallments(
      payment.method === "credit_card"
        ? String(payment.cardInstallmentCount || 1)
        : "1"
    );
    setFormNotes(payment.notes || "");
  };

  const openSettle = (payment) => {
    setSettlePayment(payment);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    setSettleAt(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
        now.getHours()
      )}:${pad(now.getMinutes())}`
    );
  };

  const handleMethodChange = (method) => {
    setFormMethod(method);
    setFormStatus(
      method === "credit_card" ? "paid" : defaultPaymentStatusForMethod(method)
    );
    if (method !== "credit_card") setFormInstallments("1");
  };

  const handleAdd = async () => {
    if (!canMutate || submitLock.current || submitting) return;
    if (!(formAmount > 0)) return;
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
      await applyBundle(data);
      setAddOpen(false);
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  const handleEditSave = async () => {
    if (!canMutate || !editPayment || submitLock.current || submitting) return;
    if (!(formAmount > 0)) return;
    if (formMethod === "credit_card") return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const { data } = await updateInventorySalePaymentLine(
        sale.id,
        editPayment.id,
        {
          method: formMethod,
          amount: formAmount,
          notes: formNotes.trim() || null,
        }
      );
      await applyBundle(data);
      setEditPayment(null);
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  const handleSettleConfirm = async () => {
    if (!canMutate || !settlePayment || submitLock.current || submitting) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const body = {};
      if (settleAt) {
        body.paidAt = new Date(settleAt).toISOString();
      }
      const { data } = await settleInventorySalePaymentLine(
        sale.id,
        settlePayment.id,
        body
      );
      await applyBundle(data);
      setSettlePayment(null);
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  const handleRemoveConfirm = async () => {
    if (!canMutate || !removePayment || submitLock.current || submitting) return;
    submitLock.current = true;
    setSubmitting(true);
    setBusyId(removePayment.id);
    try {
      const { data } = await deleteInventorySalePaymentLine(
        sale.id,
        removePayment.id
      );
      await applyBundle(data);
      setRemovePayment(null);
    } catch (err) {
      toastError(err);
    } finally {
      setBusyId(null);
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  const paymentFormFields = (opts = {}) => {
    const { forcePending = false, hideCreditCard = false } = opts;
    const methods = hideCreditCard
      ? PAYMENT_METHODS.filter((m) => m !== "credit_card")
      : PAYMENT_METHODS;
    return (
      <Box className={classes.formStack}>
        <FormControl variant="outlined" fullWidth size="small">
          <InputLabel id="sale-payments-method-label">
            {i18n.t("inventorySales.sales.wizard.payment.method")}
          </InputLabel>
          <Select
            labelId="sale-payments-method-label"
            label={i18n.t("inventorySales.sales.wizard.payment.method")}
            value={formMethod}
            onChange={(e) => handleMethodChange(e.target.value)}
            disabled={submitting}
            data-testid="sale-payments-method"
          >
            {methods.map((method) => (
              <MenuItem key={method} value={method}>
                {getInventoryPaymentMethodLabel(method)}
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
        {!forcePending && formMethod === "credit_card" ? (
          <FormControl variant="outlined" fullWidth size="small">
            <InputLabel>
              {i18n.t("inventorySales.sales.wizard.payment.installments")}
            </InputLabel>
            <Select
              label={i18n.t("inventorySales.sales.wizard.payment.installments")}
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
        ) : null}
        {!forcePending && formMethod !== "credit_card" ? (
          <FormControl variant="outlined" fullWidth size="small">
            <InputLabel>
              {i18n.t("inventorySales.sales.wizard.payment.situation")}
            </InputLabel>
            <Select
              label={i18n.t("inventorySales.sales.wizard.payment.situation")}
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              disabled={submitting}
            >
              <MenuItem value="paid">
                {getInventoryPaymentStatusLabel("paid")}
              </MenuItem>
              <MenuItem value="pending">
                {getInventoryPaymentStatusLabel("pending")}
              </MenuItem>
            </Select>
          </FormControl>
        ) : null}
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
          inputProps={{ "data-testid": "sale-payments-notes" }}
        />
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={2} data-testid="sale-payments-loading">
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box className={classes.root} data-testid="sale-payments-error">
        <Typography variant="body2" color="error">
          {i18n.t("inventorySales.sales.payment.loadError")}
        </Typography>
        <AppSecondaryButton onClick={loadPayments}>
          {i18n.t("inventorySales.common.retry")}
        </AppSecondaryButton>
      </Box>
    );
  }

  // Fallback legado quando não há lines.
  if (payments.length === 0) {
    return (
      <Box className={classes.root} data-testid="sale-payments-legacy">
        <Box className={classes.legacyBox}>
          <Typography variant="body2" data-testid="sale-payment-method-display">
            {describeSalePaymentMethod(sale)}
          </Typography>
          <Typography variant="body2">
            {i18n.t("inventorySales.sales.payment.paidAmount")}:{" "}
            {formatCurrencyBRL(sale.paidAmount)} /{" "}
            {formatCurrencyBRL(sale.totalAmount)}
          </Typography>
          {sale.paidAt ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("inventorySales.sales.payment.paidAt")}:{" "}
              {formatPaidAt(sale.paidAt)}
            </Typography>
          ) : null}
        </Box>
        {canMutate && remainingToAllocate > 0.00001 ? (
          <AppPrimaryButton
            onClick={openAdd}
            data-testid="sale-payments-add"
          >
            {i18n.t("inventorySales.sales.wizard.payment.add")}
          </AppPrimaryButton>
        ) : null}
        {canMutate && onLegacyUpdateClick && toNumber(sale.paidAmount) > 0 ? (
          <AppSecondaryButton onClick={onLegacyUpdateClick}>
            {i18n.t("inventorySales.sales.payment.update")}
          </AppSecondaryButton>
        ) : null}

        <Dialog
          open={addOpen}
          onClose={() => !submitting && setAddOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>
            {i18n.t("inventorySales.sales.wizard.payment.add")}
          </DialogTitle>
          <DialogContent>{paymentFormFields()}</DialogContent>
          <DialogActions>
            <AppSecondaryButton
              onClick={() => setAddOpen(false)}
              disabled={submitting}
            >
              {i18n.t("inventorySales.sales.wizard.nav.back")}
            </AppSecondaryButton>
            <AppPrimaryButton
              onClick={handleAdd}
              disabled={submitting || !(formAmount > 0)}
              data-testid="sale-payments-add-submit"
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

  return (
    <Box className={classes.root} data-testid="sale-payments-section">
      <Box className={classes.summary} data-testid="sale-payments-summary">
        <Box>
          <Typography className={classes.summaryLabel}>
            {i18n.t("inventorySales.sales.wizard.payment.total")}
          </Typography>
          <Typography className={classes.summaryValue}>
            {formatCurrencyBRL(summary?.totalAmount ?? sale.totalAmount)}
          </Typography>
        </Box>
        <Box>
          <Typography className={classes.summaryLabel}>
            {i18n.t("inventorySales.sales.wizard.payment.received")}
          </Typography>
          <Typography className={classes.summaryValue}>
            {formatCurrencyBRL(summary?.effectivePaid ?? 0)}
          </Typography>
        </Box>
        <Box>
          <Typography className={classes.summaryLabel}>
            {i18n.t("inventorySales.sales.wizard.payment.pending")}
          </Typography>
          <Typography className={classes.summaryValue}>
            {formatCurrencyBRL(summary?.pendingAmount ?? 0)}
          </Typography>
        </Box>
        <Box>
          <Typography className={classes.summaryLabel}>
            {i18n.t("inventorySales.sales.payment.toReceive")}
          </Typography>
          <Typography className={classes.summaryValue}>
            {formatCurrencyBRL(summary?.remainingToReceive ?? 0)}
          </Typography>
        </Box>
      </Box>

      {fullyPaid ? (
        <Typography className={classes.fullyPaid} data-testid="sale-payments-fully-paid">
          {i18n.t("inventorySales.sales.payment.fullyPaid")}
        </Typography>
      ) : null}

      <Box className={classes.list} data-testid="sale-payments-list">
        {payments.map((payment) => (
          <Box
            key={payment.id}
            className={classes.row}
            data-testid={`sale-payment-row-${payment.id}`}
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
                {getInventoryPaymentStatusLabel(payment.status)}
              </Typography>
              {payment.status === "paid" && payment.paidAt ? (
                <Typography variant="caption" color="textSecondary">
                  {formatPaidAt(payment.paidAt)}
                </Typography>
              ) : null}
              {payment.notes ? (
                <Typography variant="caption" color="textSecondary">
                  {payment.notes}
                </Typography>
              ) : null}
            </Box>
            {canMutate && payment.status === "pending" ? (
              <Box className={classes.rowActions}>
                <IconButton
                  size="small"
                  aria-label={i18n.t("inventorySales.sales.payment.editPending")}
                  disabled={busyId != null || submitting}
                  onClick={() => openEdit(payment)}
                  data-testid={`sale-payment-edit-${payment.id}`}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={i18n.t(
                    "inventorySales.sales.wizard.payment.markReceived"
                  )}
                  disabled={busyId != null || submitting}
                  onClick={() => openSettle(payment)}
                  data-testid={`sale-payment-settle-${payment.id}`}
                >
                  <CheckCircleOutlineIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={i18n.t("inventorySales.sales.wizard.payment.remove")}
                  disabled={busyId != null || submitting}
                  onClick={() => setRemovePayment(payment)}
                  data-testid={`sale-payment-remove-${payment.id}`}
                >
                  {busyId === payment.id ? (
                    <CircularProgress size={18} />
                  ) : (
                    <DeleteOutlineIcon fontSize="small" />
                  )}
                </IconButton>
              </Box>
            ) : null}
          </Box>
        ))}
      </Box>

      {canMutate && remainingToAllocate > 0.00001 ? (
        <AppPrimaryButton onClick={openAdd} data-testid="sale-payments-add">
          {i18n.t("inventorySales.sales.wizard.payment.add")}
        </AppPrimaryButton>
      ) : null}

      <Dialog
        open={addOpen}
        onClose={() => !submitting && setAddOpen(false)}
        fullWidth
        maxWidth="xs"
        data-testid="sale-payments-add-dialog"
      >
        <DialogTitle>
          {i18n.t("inventorySales.sales.wizard.payment.add")}
        </DialogTitle>
        <DialogContent>{paymentFormFields()}</DialogContent>
        <DialogActions>
          <AppSecondaryButton
            onClick={() => setAddOpen(false)}
            disabled={submitting}
          >
            {i18n.t("inventorySales.sales.wizard.nav.back")}
          </AppSecondaryButton>
          <AppPrimaryButton
            onClick={handleAdd}
            disabled={submitting || !(formAmount > 0)}
            data-testid="sale-payments-add-submit"
          >
            {submitting
              ? i18n.t("inventorySales.sales.wizard.nav.saving")
              : i18n.t("inventorySales.sales.wizard.payment.save")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(editPayment)}
        onClose={() => !submitting && setEditPayment(null)}
        fullWidth
        maxWidth="xs"
        data-testid="sale-payments-edit-dialog"
      >
        <DialogTitle>
          {i18n.t("inventorySales.sales.payment.editPending")}
        </DialogTitle>
        <DialogContent>
          {paymentFormFields({ forcePending: true, hideCreditCard: true })}
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton
            onClick={() => setEditPayment(null)}
            disabled={submitting}
          >
            {i18n.t("inventorySales.sales.wizard.nav.back")}
          </AppSecondaryButton>
          <AppPrimaryButton
            onClick={handleEditSave}
            disabled={submitting || !(formAmount > 0)}
            data-testid="sale-payments-edit-submit"
          >
            {submitting
              ? i18n.t("inventorySales.sales.wizard.nav.saving")
              : i18n.t("inventorySales.sales.wizard.payment.save")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(settlePayment)}
        onClose={() => !submitting && setSettlePayment(null)}
        fullWidth
        maxWidth="xs"
        data-testid="sale-payments-settle-dialog"
      >
        <DialogTitle>
          {i18n.t("inventorySales.sales.wizard.payment.markReceived")}
        </DialogTitle>
        <DialogContent>
          <Box className={classes.formStack}>
            <Typography>
              {settlePayment ? paymentLineCaption(settlePayment) : ""}
            </Typography>
            <Typography variant="body2">
              {settlePayment ? formatCurrencyBRL(settlePayment.amount) : ""}
            </Typography>
            <TextField
              label={i18n.t("inventorySales.sales.payment.paidAt")}
              type="datetime-local"
              value={settleAt}
              onChange={(e) => setSettleAt(e.target.value)}
              disabled={submitting}
              fullWidth
              size="small"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton
            onClick={() => setSettlePayment(null)}
            disabled={submitting}
          >
            {i18n.t("inventorySales.sales.wizard.nav.back")}
          </AppSecondaryButton>
          <AppPrimaryButton
            onClick={handleSettleConfirm}
            disabled={submitting}
            data-testid="sale-payments-settle-submit"
          >
            {submitting
              ? i18n.t("inventorySales.sales.wizard.nav.saving")
              : i18n.t("inventorySales.sales.payment.registerReceipt")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        open={Boolean(removePayment)}
        onClose={() => setRemovePayment(null)}
        onConfirm={handleRemoveConfirm}
        title={i18n.t("inventorySales.sales.payment.removePendingTitle")}
      >
        {removePayment
          ? i18n.t("inventorySales.sales.payment.removePendingMessage", {
              amount: formatCurrencyBRL(removePayment.amount),
            })
          : null}
      </ConfirmationModal>
    </Box>
  );
}
