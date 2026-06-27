import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { toast } from "react-toastify";

import {
  AppDialog,
  AppDialogActions,
  AppDialogContent,
  AppDialogTitle,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import { updateInventorySalePayment } from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "./constants";
import { toNumber } from "./utils";

function formatDateInput(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function SalePaymentDialog({
  open,
  onClose,
  sale,
  onSaved,
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    paymentStatus: "unpaid",
    paymentMethod: "",
    paidAmount: "0",
    paidAt: "",
    paymentNotes: "",
  });

  useEffect(() => {
    if (!open || !sale) return;
    setForm({
      paymentStatus: sale.paymentStatus || "unpaid",
      paymentMethod: sale.paymentMethod || "",
      paidAmount:
        sale.paidAmount != null ? String(sale.paidAmount) : "0",
      paidAt: formatDateInput(sale.paidAt),
      paymentNotes: sale.paymentNotes || "",
    });
  }, [open, sale]);

  const paymentStatusLabel = (status) =>
    i18n.t(`inventorySales.sales.paymentStatus.${status}`, status);

  const paymentMethodLabel = (method) =>
    i18n.t(`inventorySales.sales.paymentMethods.${method}`, method);

  const handleSave = async () => {
    if (!sale?.id) return;

    const paidAmount = toNumber(form.paidAmount);
    const totalAmount = toNumber(sale.totalAmount);

    if (paidAmount < 0 || !Number.isFinite(paidAmount)) {
      toast.error(i18n.t("inventorySales.sales.validation.paidAmount"));
      return;
    }
    if (paidAmount > totalAmount) {
      toast.error(i18n.t("inventorySales.sales.validation.paidAmountMax"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        paymentStatus: form.paymentStatus,
        paymentMethod: form.paymentMethod || null,
        paidAmount,
        paymentNotes: form.paymentNotes.trim() || null,
      };
      if (form.paidAt) {
        payload.paidAt = new Date(form.paidAt).toISOString();
      }
      const { data } = await updateInventorySalePayment(sale.id, payload);
      toast.success(i18n.t("inventorySales.sales.toasts.paymentUpdated"));
      if (onSaved) onSaved(data);
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const allowedStatuses =
    sale?.status === "cancelled"
      ? ["refunded"]
      : PAYMENT_STATUSES.filter((s) => s !== "refunded" || sale?.status === "completed");

  return (
    <AppDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <AppDialogTitle>
        {i18n.t("inventorySales.sales.payment.update")}
      </AppDialogTitle>
      <AppDialogContent>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("inventorySales.sales.columns.total")}:{" "}
          {formatCurrencyBRL(sale?.totalAmount)}
        </Typography>
        <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
          <FormControl variant="outlined" size="small" fullWidth>
            <InputLabel id="payment-status-label">
              {i18n.t("inventorySales.sales.fields.paymentStatus")}
            </InputLabel>
            <Select
              labelId="payment-status-label"
              value={form.paymentStatus}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, paymentStatus: e.target.value }))
              }
              label={i18n.t("inventorySales.sales.fields.paymentStatus")}
            >
              {allowedStatuses.map((status) => (
                <MenuItem key={status} value={status}>
                  {paymentStatusLabel(status)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl variant="outlined" size="small" fullWidth>
            <InputLabel id="payment-method-label">
              {i18n.t("inventorySales.sales.fields.paymentMethod")}
            </InputLabel>
            <Select
              labelId="payment-method-label"
              value={form.paymentMethod}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))
              }
              label={i18n.t("inventorySales.sales.fields.paymentMethod")}
            >
              <MenuItem value="">
                <em>{i18n.t("inventorySales.common.none")}</em>
              </MenuItem>
              {PAYMENT_METHODS.map((method) => (
                <MenuItem key={method} value={method}>
                  {paymentMethodLabel(method)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={i18n.t("inventorySales.sales.fields.paidAmount")}
            value={form.paidAmount}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, paidAmount: e.target.value }))
            }
            variant="outlined"
            size="small"
            fullWidth
            type="number"
            inputProps={{ min: 0, step: "0.01" }}
          />

          <TextField
            label={i18n.t("inventorySales.sales.fields.paidAt")}
            value={form.paidAt}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, paidAt: e.target.value }))
            }
            variant="outlined"
            size="small"
            fullWidth
            type="date"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label={i18n.t("inventorySales.sales.fields.paymentNotes")}
            value={form.paymentNotes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, paymentNotes: e.target.value }))
            }
            variant="outlined"
            size="small"
            fullWidth
            multiline
            rows={2}
          />
        </Box>
      </AppDialogContent>
      <AppDialogActions>
        <AppSecondaryButton onClick={onClose} disabled={saving}>
          {i18n.t("inventorySales.common.cancel")}
        </AppSecondaryButton>
        <AppPrimaryButton onClick={handleSave} disabled={saving}>
          {i18n.t("inventorySales.sales.payment.savePayment")}
        </AppPrimaryButton>
      </AppDialogActions>
    </AppDialog>
  );
}
