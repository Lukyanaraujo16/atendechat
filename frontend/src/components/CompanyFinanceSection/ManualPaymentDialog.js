import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import { makeStyles, useTheme, alpha } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import moment from "moment";
import { toast } from "react-toastify";

import api from "../../services/api";
import { AppPrimaryButton, AppSecondaryButton } from "../../ui";
import showFinanceError from "./financeErrors";
import HistoricalReviewDialog from "./HistoricalReviewDialog";
import { ToneChip } from "./FinanceChips";
import {
  apiErrorMessage,
  errorCode,
  financeErrorMessage,
  formatBrl,
  formatDate,
  httpStatus,
  isNotFoundRoute,
  maskBrDate,
  maskBrl,
  methodLabel,
  numberToBrlInput,
  parseBrDate,
  parseBrl,
  PAYMENT_METHODS,
  syncInfo,
  toCents,
  toDateOnly,
} from "./financeFormat";

const MIN_REASON = 3;

const useStyles = makeStyles((theme) => ({
  summary: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, auto) 1fr",
    rowGap: theme.spacing(1),
    columnGap: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(2),
    wordBreak: "break-word",
  },
  summaryLabel: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  summaryValue: {
    fontWeight: 600,
    fontSize: "0.9rem",
  },
  courtesyBanner: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.secondary.main, 0.1),
    border: `1px dashed ${theme.palette.secondary.main}`,
    marginBottom: theme.spacing(2),
  },
  mb: { marginBottom: theme.spacing(2) },
  noRenew: { fontWeight: 700, color: theme.palette.warning.dark },
}));

const BLOCK_KIND_TEXT = {
  manual: "bloqueio manual",
  financial: "bloqueio financeiro",
  unknown: "motivo desconhecido",
};

const SKIP_REASON_TEXT = {
  period_already_covered: "o período desta fatura já está coberto pelo vencimento atual",
  disabled: "você desligou a opção “Renovar assinatura”",
};

/** Prévia no formato do contrato C6 (POST .../manual-payment/preview). */
const isServerPreview = (p) => Boolean(p) && Object.prototype.hasOwnProperty.call(p, "willRenew");

/**
 * Registrar pagamento recebido (paid_offline) ou conceder cortesia (courtesy).
 * Duas etapas: formulário → confirmação com resumo.
 */
export default function ManualPaymentDialog({
  open,
  mode = "paid_offline",
  companyId,
  company,
  openInvoices,
  initialInvoiceId,
  onClose,
  onDone,
  onGenerateInvoice,
}) {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));
  const isCourtesy = mode === "courtesy";
  const invoices = useMemo(() => openInvoices || [], [openInvoices]);

  const [step, setStep] = useState("form");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("pix");
  const [paidAt, setPaidAt] = useState("");
  const [reason, setReason] = useState("");
  const [renew, setRenew] = useState(true);
  const [touched, setTouched] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [stateChanged, setStateChanged] = useState(false);
  const [historicalOpen, setHistoricalOpen] = useState(false);
  const submittingRef = useRef(false);

  const invoice = invoices.find((i) => String(i.id) === String(invoiceId)) || null;
  const serverPreview = isServerPreview(preview) ? preview : null;

  useEffect(() => {
    if (!open) return;
    const first =
      invoices.find((i) => String(i.id) === String(initialInvoiceId)) ||
      invoices[0] ||
      null;
    setStep("form");
    setInvoiceId(first ? String(first.id) : "");
    setAmount(first ? numberToBrlInput(first.value) : "");
    setMethod("pix");
    setPaidAt(moment().format("DD/MM/YYYY"));
    setReason("");
    setRenew(true);
    setTouched(false);
    setPreview(null);
    setPreviewUnavailable(false);
    setServerError(null);
    setStateChanged(false);
    setHistoricalOpen(false);
  }, [open, initialInvoiceId, invoices]);

  const selectInvoice = (id) => {
    setInvoiceId(id);
    const inv = invoices.find((i) => String(i.id) === String(id));
    setAmount(inv ? numberToBrlInput(inv.value) : "");
    setServerError(null);
  };

  const paidIso = parseBrDate(paidAt);
  const amountNum = isCourtesy ? Number(invoice?.value) : parseBrl(amount);
  const amountDiffers =
    !isCourtesy &&
    invoice &&
    amountNum !== null &&
    toCents(amountNum) !== toCents(invoice.value);
  const futureDate = paidIso && moment(paidIso).isAfter(moment(), "day");

  const errors = {
    invoice: !invoice ? "Selecione a fatura." : null,
    amount:
      !isCourtesy && (amountNum === null || amountNum <= 0)
        ? "Informe o valor recebido."
        : amountDiffers
        ? "O valor recebido deve ser igual ao valor devido."
        : null,
    paidAt: !paidIso
      ? "Informe uma data válida (dd/mm/aaaa)."
      : futureDate
      ? "A data não pode estar no futuro."
      : null,
    reason:
      reason.trim().length < MIN_REASON ? `Mínimo de ${MIN_REASON} caracteres.` : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (f) => touched && errors[f];

  const buildBody = () => ({
    invoiceId: Number(invoice.id),
    kind: isCourtesy ? "courtesy" : "paid_offline",
    amount: isCourtesy ? Number(invoice.value) : amountNum,
    method: isCourtesy ? "other" : method,
    paidAt: paidIso,
    reason: reason.trim(),
    renewSubscription: renew,
  });

  /** Fallback (servidor sem a prévia C6): só calcula o novo vencimento. */
  const loadLegacyPreview = async () => {
    if (!renew) return;
    try {
      const { data } = await api.get(`/saas/companies/${companyId}/finance/renewal-preview`);
      setPreview(data || null);
    } catch (err) {
      setPreview(null);
      setPreviewUnavailable(true);
      if (!isNotFoundRoute(err)) showFinanceError(err, "A prévia de renovação");
    }
  };

  const loadPreview = async () => {
    setPreviewLoading(true);
    setPreviewUnavailable(false);
    setStateChanged(false);
    setPreview(null);
    try {
      const { data } = await api.post(
        `/saas/companies/${companyId}/finance/manual-payment/preview`,
        buildBody()
      );
      setPreview(data || null);
    } catch (err) {
      if (isNotFoundRoute(err)) {
        await loadLegacyPreview();
      } else {
        setPreview(null);
        setPreviewUnavailable(true);
        showFinanceError(err, "A prévia do pagamento");
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const goConfirm = async () => {
    setTouched(true);
    if (!valid) return;
    setStep("confirm");
    setServerError(null);
    await loadPreview();
  };

  const handleSubmit = async () => {
    if (!valid || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setServerError(null);
    try {
      const body = buildBody();
      if (serverPreview) body.expectedCurrentDueDate = preview.expectedCurrentDueDate ?? null;
      const { data } = await api.post(
        `/saas/companies/${companyId}/finance/manual-payment`,
        body
      );
      const base = isCourtesy
        ? "Cortesia concedida (não conta como receita)."
        : "Pagamento registrado.";
      if (data?.renewalSkippedReason === "period_already_covered") {
        toast.info(
          `${isCourtesy ? "Cortesia concedida" : "Pagamento registrado"}; o período já estava coberto por renovação anterior, vencimento não foi estendido.`,
          { autoClose: 8000 }
        );
      } else if (data?.renewed && data?.company?.dueDate) {
        toast.success(`${base} Novo vencimento: ${formatDate(data.company.dueDate)}.`);
      } else {
        toast.success(base);
      }
      const sync = String(data?.gatewaySyncStatus || "").toLowerCase();
      if (sync === "failed" || sync === "pending" || sync === "unsupported") {
        toast.warn(`Situação na Efí: ${syncInfo(sync).label}.`, { autoClose: 8000 });
      }
      if (onDone) onDone(data);
      if (onClose) onClose();
    } catch (err) {
      const code = errorCode(err);
      if (code === "ERR_PAYMENT_STATE_CHANGED") {
        setStateChanged(true);
      } else if (
        code === "ERR_PAYMENT_AMOUNT_INSUFFICIENT" ||
        code === "ERR_PAYMENT_AMOUNT_EXCEEDS" ||
        code === "ERR_INVOICE_NOT_OPEN"
      ) {
        setServerError(financeErrorMessage(err));
        setStep("form");
      } else if (httpStatus(err) === 409 && apiErrorMessage(err)) {
        setServerError(apiErrorMessage(err));
        setStep("form");
      } else {
        showFinanceError(
          err,
          isCourtesy ? "A concessão de cortesia" : "O registro de pagamento"
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const title = isCourtesy ? "Conceder cortesia" : "Registrar pagamento";
  const currentDue = serverPreview
    ? serverPreview.previousDueDate
    : preview
    ? preview.currentDueDate
    : toDateOnly(company?.dueDate);
  const previewInvalid = Boolean(serverPreview) && serverPreview.valid === false;
  const historicalAlert = (serverPreview?.alerts || []).some((a) => a.code === "HISTORICAL_CANDIDATE");

  const renderNoInvoice = () => (
    <Box py={2}>
      <Alert severity="info" className={classes.mb}>
        Não há fatura em aberto para esta empresa. Gere uma fatura antes de{" "}
        {isCourtesy ? "conceder a cortesia" : "registrar o pagamento"}.
      </Alert>
      {onGenerateInvoice ? (
        <AppPrimaryButton onClick={onGenerateInvoice}>Gerar fatura</AppPrimaryButton>
      ) : null}
    </Box>
  );

  const renderForm = () => (
    <>
      {isCourtesy ? (
        <Box className={classes.courtesyBanner}>
          <Typography variant="body2">
            <strong>Cortesia não conta como receita.</strong> A fatura é quitada sem
            recebimento de dinheiro e fica registrada como cortesia na auditoria.
          </Typography>
        </Box>
      ) : null}
      {serverError ? (
        <Alert severity="error" className={classes.mb}>
          {serverError}
        </Alert>
      ) : null}
      <Typography variant="body2" color="textSecondary" paragraph>
        Empresa: <strong>{company?.name || `#${companyId}`}</strong>
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            select
            fullWidth
            required
            variant="outlined"
            id="manual-payment-invoice"
            label="Fatura"
            value={invoiceId}
            onChange={(e) => selectInvoice(e.target.value)}
            error={Boolean(show("invoice"))}
            helperText={show("invoice") || " "}
            disabled={submitting}
          >
            {invoices.map((i) => (
              <MenuItem key={i.id} value={String(i.id)}>
                #{i.id} — {formatBrl(i.value)} — vence {formatDate(i.dueDate)}
                {i.isLegacy ? " (legado)" : ""}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            variant="outlined"
            label="Valor devido"
            value={invoice ? formatBrl(invoice.value) : "—"}
            InputProps={{ readOnly: true }}
            helperText=" "
          />
        </Grid>
        {!isCourtesy ? (
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              variant="outlined"
              id="manual-payment-amount"
              label="Valor recebido"
              value={amount}
              onChange={(e) => {
                setAmount(maskBrl(e.target.value));
                setServerError(null);
              }}
              error={Boolean(show("amount")) || Boolean(amountDiffers)}
              helperText={show("amount") || (amountDiffers ? "Diferente do valor devido." : " ")}
              InputProps={{
                startAdornment: <InputAdornment position="start">R$</InputAdornment>,
              }}
              inputProps={{ inputMode: "numeric" }}
              disabled={submitting}
            />
          </Grid>
        ) : null}
        {amountDiffers ? (
          <Grid item xs={12}>
            <Alert severity="warning">
              Pagamento parcial ou acima do devido não é suportado. Se houve desconto ou
              acréscimo acordado, edite a fatura antes de registrar o pagamento.
            </Alert>
          </Grid>
        ) : null}
        {!isCourtesy ? (
          <Grid item xs={12} sm={6}>
            <TextField
              select
              fullWidth
              variant="outlined"
              label="Forma de pagamento"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              helperText="Como o valor foi recebido."
              disabled={submitting}
            >
              {PAYMENT_METHODS.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        ) : null}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            required
            variant="outlined"
            label={isCourtesy ? "Data da concessão" : "Data do recebimento"}
            placeholder="dd/mm/aaaa"
            value={paidAt}
            onChange={(e) => setPaidAt(maskBrDate(e.target.value))}
            error={Boolean(show("paidAt"))}
            helperText={show("paidAt") || " "}
            inputProps={{ inputMode: "numeric" }}
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
            id="manual-payment-reason"
            label="Observação / justificativa"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={Boolean(show("reason"))}
            helperText={show("reason") || "Ficará registrada na auditoria."}
            inputProps={{ maxLength: 500 }}
            disabled={submitting}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                color="primary"
                checked={renew}
                onChange={(e) => setRenew(e.target.checked)}
                disabled={submitting}
              />
            }
            label="Renovar assinatura (estender o vencimento por um período contratado)"
          />
        </Grid>
        {!isCourtesy && method === "pix" ? (
          <Grid item xs={12}>
            <Typography variant="caption" color="textSecondary">
              Pix não permite baixa manual na Efí: o registro valerá somente neste
              sistema.
            </Typography>
          </Grid>
        ) : null}
      </Grid>
    </>
  );

  const row = (label, value) => (
    <>
      <span className={classes.summaryLabel}>{label}</span>
      <span className={classes.summaryValue}>{value}</span>
    </>
  );

  const renewalText = () => {
    if (previewLoading) return "Calculando…";
    if (serverPreview) {
      if (serverPreview.willRenew && serverPreview.newDueDate) {
        return `Vencimento passará de ${formatDate(serverPreview.previousDueDate)} para ${formatDate(
          serverPreview.newDueDate
        )}`;
      }
      const why = SKIP_REASON_TEXT[serverPreview.renewalSkippedReason];
      return (
        <span className={classes.noRenew}>
          NÃO haverá renovação{why ? ` — ${why}` : ""}. Vencimento continua{" "}
          {formatDate(serverPreview.previousDueDate)}.
        </span>
      );
    }
    if (!renew) return "Não renovar — vencimento permanece inalterado";
    if (preview?.newDueDate) {
      return `Vencimento passará de ${formatDate(currentDue)} para ${formatDate(preview.newDueDate)}`;
    }
    return "Renovar por um período contratado";
  };

  const accessText = () => {
    if (!serverPreview) return null;
    if (serverPreview.willUnblock) return "A empresa será desbloqueada.";
    if (serverPreview.blockKind === "manual") {
      return "Continua bloqueada (bloqueio manual — desbloqueie manualmente se for o caso).";
    }
    if (serverPreview.blockKind && serverPreview.blockKind !== "none") {
      return `Continua bloqueada (${BLOCK_KIND_TEXT[serverPreview.blockKind] || "motivo desconhecido"}).`;
    }
    return "Sem alteração (empresa ativa).";
  };

  const renderConfirm = () => (
    <>
      {stateChanged ? (
        <Alert
          severity="warning"
          className={classes.mb}
          action={
            <AppSecondaryButton size="small" onClick={loadPreview} disabled={previewLoading}>
              Recalcular prévia
            </AppSecondaryButton>
          }
        >
          Os dados mudaram desde a prévia (outra operação alterou o vencimento). Revise a prévia
          antes de confirmar.
        </Alert>
      ) : null}
      <Typography variant="body2" paragraph>
        Revise os dados antes de confirmar:
      </Typography>
      <Box mb={1}>
        {isCourtesy ? (
          <ToneChip tone="secondary" label="Cortesia — sem receita" />
        ) : (
          <ToneChip tone="success" label="Pagamento atual — dinheiro recebido" />
        )}
      </Box>
      <Box className={classes.summary}>
        {row("Empresa", serverPreview?.company?.name || company?.name || `#${companyId}`)}
        {row(
          "Fatura",
          invoice ? `#${invoice.id} — vence ${formatDate(invoice.dueDate)}` : "—"
        )}
        {row("Valor devido", formatBrl(invoice?.value))}
        {isCourtesy
          ? row("Tipo", "Cortesia — não conta como receita")
          : row("Valor recebido", formatBrl(serverPreview ? serverPreview.amount : amountNum))}
        {!isCourtesy ? row("Forma de pagamento", methodLabel(serverPreview?.method || method)) : null}
        {row("Data", paidAt)}
        {row("Observação", reason.trim())}
        {serverPreview
          ? row(
              "Receita",
              serverPreview.revenueEffect === "revenue"
                ? "Conta como receita recebida"
                : "Não conta como receita"
            )
          : null}
        {serverPreview
          ? row("Fatura depois", serverPreview.invoiceStatusAfter === "paid" ? "Paga" : serverPreview.invoiceStatusAfter || "—")
          : null}
        {row("Vencimento anterior", formatDate(currentDue))}
        {row("Renovação", renewalText())}
        {serverPreview ? row("Acesso", accessText()) : null}
      </Box>
      {(serverPreview?.errors || []).map((e) => (
        <Alert key={`e-${e.code}`} severity="error" className={classes.mb}>
          {e.message}
        </Alert>
      ))}
      {(serverPreview?.alerts || []).map((a) => (
        <Alert
          key={`a-${a.code}`}
          severity={a.code === "HISTORICAL_CANDIDATE" ? "info" : "warning"}
          className={classes.mb}
          action={
            a.code === "HISTORICAL_CANDIDATE" ? (
              <AppSecondaryButton size="small" onClick={() => setHistoricalOpen(true)}>
                Regularizar como histórica
              </AppSecondaryButton>
            ) : null
          }
        >
          {a.message}
        </Alert>
      ))}
      {historicalAlert ? (
        <Typography variant="caption" color="textSecondary" component="p" className={classes.mb}>
          Fatura antiga: se o pagamento aconteceu no passado, use “Regularizar como histórica” (não
          renova a assinatura) em vez de registrar como pagamento atual.
        </Typography>
      ) : null}
      {renew && previewUnavailable ? (
        <Alert severity="info" className={classes.mb}>
          Não foi possível calcular a prévia agora; o servidor aplicará as regras na confirmação.
        </Alert>
      ) : null}
      {!serverPreview && renew ? (
        <Typography variant="caption" color="textSecondary">
          Se o período já estiver coberto por uma renovação anterior, o vencimento não
          será estendido novamente.
        </Typography>
      ) : null}
    </>
  );

  const noInvoices = invoices.length === 0;

  return (
    <Dialog
      open={Boolean(open)}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>
        {title}
        {step === "confirm" ? " — confirmação" : ""}
      </DialogTitle>
      <DialogContent>
        {noInvoices
          ? renderNoInvoice()
          : step === "form"
          ? renderForm()
          : renderConfirm()}
        {submitting ? (
          <Box display="flex" justifyContent="center" pt={1}>
            <CircularProgress size={20} />
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        {step === "confirm" ? (
          <AppSecondaryButton onClick={() => setStep("form")} disabled={submitting}>
            Voltar
          </AppSecondaryButton>
        ) : (
          <AppSecondaryButton onClick={onClose} disabled={submitting}>
            Cancelar
          </AppSecondaryButton>
        )}
        {noInvoices ? null : step === "form" ? (
          <AppPrimaryButton onClick={goConfirm} disabled={touched && !valid}>
            Continuar
          </AppPrimaryButton>
        ) : (
          <AppPrimaryButton
            onClick={handleSubmit}
            loading={submitting}
            disabled={previewLoading || previewInvalid || stateChanged}
            color={isCourtesy ? "secondary" : "primary"}
          >
            {isCourtesy ? "Confirmar cortesia" : "Confirmar pagamento"}
          </AppPrimaryButton>
        )}
      </DialogActions>
      {historicalOpen && invoice ? (
        <HistoricalReviewDialog
          open={historicalOpen}
          companyId={companyId}
          invoice={invoice}
          onClose={() => setHistoricalOpen(false)}
          onDone={(result) => {
            setHistoricalOpen(false);
            if (onDone) onDone(result);
            if (onClose) onClose();
          }}
        />
      ) : null}
    </Dialog>
  );
}
