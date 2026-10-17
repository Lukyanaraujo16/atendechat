import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  TextField,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import { toast } from "react-toastify";

import api from "../../services/api";
import { AppPrimaryButton, AppSecondaryButton } from "../../ui";
import showFinanceError from "./financeErrors";
import {
  competenceToBr,
  errorCode,
  financeErrorMessage,
  isoToBrDate,
  maskBrDate,
  maskBrl,
  maskCompetence,
  numberToBrlInput,
  parseBrDate,
  parseBrl,
  parseCompetence,
  toDateOnly,
} from "./financeFormat";

const MIN_REASON = 3;

/**
 * Gerar (invoice ausente) ou editar (invoice presente) fatura.
 * Nunca emite cobrança na Efí.
 */
export default function InvoiceFormDialog({
  open,
  companyId,
  invoice,
  defaultValue,
  defaultDueDate,
  onClose,
  onSaved,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));
  const editing = Boolean(invoice);

  const [dueDate, setDueDate] = useState("");
  const [value, setValue] = useState("");
  const [competence, setCompetence] = useState("");
  const [detail, setDetail] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [touched, setTouched] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setTouched(false);
    setReason("");
    if (invoice) {
      setDueDate(isoToBrDate(invoice.dueDate));
      setValue(numberToBrlInput(invoice.value));
      setCompetence(competenceToBr(invoice.competence));
      setDetail(invoice.detail || "");
    } else {
      setDueDate(isoToBrDate(defaultDueDate));
      setValue(numberToBrlInput(defaultValue));
      setCompetence(
        defaultDueDate ? competenceToBr(toDateOnly(defaultDueDate)) : ""
      );
      setDetail("");
    }
  }, [open, invoice, defaultValue, defaultDueDate]);

  const dueIso = parseBrDate(dueDate);
  const valueNum = parseBrl(value);
  const competenceIso = parseCompetence(competence);
  const reasonOk = reason.trim().length >= MIN_REASON;

  const errors = {
    dueDate: !dueIso ? "Informe uma data válida (dd/mm/aaaa)." : null,
    value:
      value && (valueNum === null || valueNum <= 0)
        ? "Informe um valor maior que zero."
        : editing && !value
        ? "Informe o valor."
        : null,
    competence: competenceIso === null ? "Use mm/aaaa." : null,
    reason: !reasonOk ? `Mínimo de ${MIN_REASON} caracteres.` : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  const handleSubmit = async () => {
    setTouched(true);
    if (!valid || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setServerError(null);
    try {
      if (editing) {
        const body = { reason: reason.trim() };
        if (valueNum !== null && valueNum !== Number(invoice.value)) body.value = valueNum;
        if (dueIso !== toDateOnly(invoice.dueDate)) body.dueDate = dueIso;
        // `detail` só vai quando mudou; "" limpa a descrição.
        const nextDetail = (detail || "").trim();
        if (nextDetail !== (invoice.detail || "").trim()) body.detail = nextDetail;
        const { data } = await api.put(
          `/saas/companies/${companyId}/finance/invoices/${invoice.id}`,
          body
        );
        if (data?.unchanged === true) {
          toast.info(`Nenhuma alteração na fatura #${invoice.id}: os dados já estavam assim.`);
          if (onClose) onClose();
          return;
        }
        toast.success(`Fatura #${invoice.id} atualizada.`);
      } else {
        const body = { dueDate: dueIso, reason: reason.trim() };
        if (valueNum !== null) body.value = valueNum;
        if (competenceIso) body.competence = competenceIso;
        if (detail.trim()) body.detail = detail.trim();
        await api.post(`/saas/companies/${companyId}/finance/invoices`, body);
        toast.success("Fatura gerada. Nenhuma cobrança foi emitida na Efí.");
      }
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      const code = errorCode(err);
      if (
        code === "ERR_INVOICE_CYCLE_DUPLICATE" ||
        code === "ERR_INVOICE_NOT_EDITABLE"
      ) {
        setServerError(financeErrorMessage(err));
      } else {
        showFinanceError(
          err,
          editing ? "A edição de faturas" : "A geração de faturas"
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const show = (field) => touched && errors[field];

  return (
    <Dialog
      open={Boolean(open)}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>{editing ? `Editar fatura #${invoice.id}` : "Gerar fatura"}</DialogTitle>
      <DialogContent>
        {serverError ? (
          <Alert severity="error" style={{ marginBottom: 16 }}>
            {serverError}
          </Alert>
        ) : null}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              variant="outlined"
              id="invoice-form-due-date"
              label="Vencimento"
              placeholder="dd/mm/aaaa"
              value={dueDate}
              onChange={(e) => setDueDate(maskBrDate(e.target.value))}
              error={Boolean(show("dueDate"))}
              helperText={show("dueDate") || " "}
              inputProps={{ inputMode: "numeric" }}
              disabled={submitting}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required={editing}
              variant="outlined"
              id="invoice-form-value"
              label="Valor"
              value={value}
              onChange={(e) => setValue(maskBrl(e.target.value))}
              error={Boolean(show("value"))}
              helperText={
                show("value") ||
                (editing ? " " : "Em branco: usa o valor contratado.")
              }
              InputProps={{
                startAdornment: <InputAdornment position="start">R$</InputAdornment>,
              }}
              inputProps={{ inputMode: "numeric" }}
              disabled={submitting}
            />
          </Grid>
          {!editing ? (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                variant="outlined"
                id="invoice-form-competence"
                label="Competência"
                placeholder="mm/aaaa"
                value={competence}
                onChange={(e) => setCompetence(maskCompetence(e.target.value))}
                error={Boolean(show("competence"))}
                helperText={show("competence") || "Mês de referência (opcional)."}
                inputProps={{ inputMode: "numeric" }}
                disabled={submitting}
              />
            </Grid>
          ) : null}
          <Grid item xs={12} sm={editing ? 12 : 6}>
            <TextField
              fullWidth
              variant="outlined"
              id="invoice-form-detail"
              label="Descrição"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              helperText="Opcional."
              inputProps={{ maxLength: 255 }}
              disabled={submitting}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              multiline
              rows={3}
              variant="outlined"
              id="invoice-form-reason"
              label="Justificativa"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={Boolean(show("reason"))}
              helperText={show("reason") || "Ficará registrada na auditoria."}
              inputProps={{ maxLength: 500 }}
              disabled={submitting}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="textSecondary">
              {editing
                ? "Somente faturas em aberto, sem pagamentos e sem cobrança ativa na Efí podem ser editadas."
                : "A fatura é registrada apenas neste sistema; nenhuma cobrança é emitida na Efí."}
            </Typography>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <AppSecondaryButton onClick={onClose} disabled={submitting}>
          Cancelar
        </AppSecondaryButton>
        <AppPrimaryButton onClick={handleSubmit} loading={submitting}>
          {editing ? "Salvar alterações" : "Gerar fatura"}
        </AppPrimaryButton>
      </DialogActions>
    </Dialog>
  );
}
