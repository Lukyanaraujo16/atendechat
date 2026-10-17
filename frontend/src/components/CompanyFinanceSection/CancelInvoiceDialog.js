import React, { useEffect, useRef, useState } from "react";
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import api from "../../services/api";
import { AppPrimaryButton, AppSecondaryButton } from "../../ui";
import showFinanceError from "./financeErrors";
import { formatBrl, formatDate } from "./financeFormat";

const MIN_REASON = 3;

const useStyles = makeStyles((theme) => ({
  danger: {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    "&:hover": { backgroundColor: theme.palette.error.dark },
  },
}));

/** Cancelamento individual de fatura (com justificativa e confirmação). */
export default function CancelInvoiceDialog({ open, companyId, invoice, onClose, onCancelled }) {
  const classes = useStyles();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setConfirmed(false);
    }
  }, [open]);

  const reasonOk = reason.trim().length >= MIN_REASON;

  const handleSubmit = async () => {
    if (!invoice || !reasonOk || !confirmed || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await api.post(
        `/saas/companies/${companyId}/finance/invoices/${invoice.id}/cancel`,
        { reason: reason.trim() }
      );
      toast.success(`Fatura #${invoice.id} cancelada.`);
      if (onCancelled) onCancelled();
      if (onClose) onClose();
    } catch (err) {
      showFinanceError(err, "O cancelamento de faturas");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(open)} onClose={submitting ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Cancelar fatura{invoice ? ` #${invoice.id}` : ""}</DialogTitle>
      <DialogContent>
        {invoice ? (
          <Typography variant="body2" paragraph>
            {formatBrl(invoice.value)} · vencimento {formatDate(invoice.dueDate)}
            {invoice.detail ? ` · ${invoice.detail}` : ""}
          </Typography>
        ) : null}
        <Typography variant="body2" color="textSecondary" paragraph>
          O cancelamento não pode ser desfeito e não altera o vencimento da assinatura.
        </Typography>
        <TextField
          fullWidth
          required
          multiline
          rows={3}
          variant="outlined"
          id="cancel-invoice-reason"
          label="Justificativa"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={reason.length > 0 && !reasonOk}
          helperText={
            reason.length > 0 && !reasonOk ? `Mínimo de ${MIN_REASON} caracteres.` : " "
          }
          inputProps={{ maxLength: 500 }}
          disabled={submitting}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={submitting}
            />
          }
          label="Confirmo o cancelamento desta fatura."
        />
      </DialogContent>
      <DialogActions>
        <AppSecondaryButton onClick={onClose} disabled={submitting}>
          Voltar
        </AppSecondaryButton>
        <AppPrimaryButton
          className={!reasonOk || !confirmed ? undefined : classes.danger}
          onClick={handleSubmit}
          disabled={!reasonOk || !confirmed}
          loading={submitting}
        >
          Cancelar fatura
        </AppPrimaryButton>
      </DialogActions>
    </Dialog>
  );
}
