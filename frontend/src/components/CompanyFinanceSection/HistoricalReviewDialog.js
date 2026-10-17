import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Radio,
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
import {
  apiErrorMessage,
  errorCode,
  formatBrl,
  formatCompetence,
  formatDate,
  httpStatus,
  HISTORICAL_PAYMENT_METHODS,
  invoiceStatusLabel,
  isNotFoundRoute,
  maskBrDate,
  maskBrl,
  methodLabel,
  numberToBrlInput,
  parseBrDate,
  parseBrl,
  toCents,
} from "./financeFormat";

export const MIN_NOTE = 5;
const MIN_SOURCE = 3;

/** As 4 decisões (C5), em linguagem simples. */
export const HISTORICAL_DECISIONS = [
  {
    value: "historical_payment",
    title: "Pagamento histórico confirmado",
    description:
      "O cliente pagou esta fatura no passado e você tem como confirmar (extrato, comprovante). Conta como receita. NÃO renova a assinatura.",
  },
  {
    value: "improper_cancel",
    title: "Fatura indevida — cancelar",
    description:
      "Esta fatura não deveria existir (gerada por engano, duplicada). Ela será cancelada. Não conta como receita.",
  },
  {
    value: "historical_courtesy",
    title: "Cortesia histórica",
    description:
      "O período foi concedido sem cobrança (acordo, bonificação). A fatura fica quitada como cortesia. Não conta como receita e não renova.",
  },
  {
    value: "keep_pending",
    title: "Ainda devida / não confirmada",
    description:
      "Não há confirmação de pagamento. A fatura continua em aberto e a sua análise fica registrada.",
  },
];

const NEEDS_SOURCE = ["historical_payment", "historical_courtesy"];
const TERMINAL = ["historical_payment", "historical_courtesy", "improper_cancel"];

const useStyles = makeStyles((theme) => ({
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(2),
  },
  label: {
    fontSize: "0.7rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
  },
  value: { fontWeight: 600, fontSize: "0.9rem", marginTop: 2, wordBreak: "break-word" },
  option: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(1),
    cursor: "pointer",
  },
  optionSelected: {
    borderColor: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.06),
  },
  optionTitle: { fontWeight: 600, fontSize: "0.92rem" },
  optionDesc: { fontSize: "0.8rem", color: theme.palette.text.secondary },
  signals: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px dashed ${theme.palette.info.main}`,
    backgroundColor: alpha(theme.palette.info.main, 0.05),
    marginBottom: theme.spacing(2),
  },
  signalList: { margin: theme.spacing(0.5, 0, 0), paddingLeft: theme.spacing(2.5), fontSize: "0.85rem" },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(130px, auto) 1fr",
    rowGap: theme.spacing(1),
    columnGap: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(2),
    wordBreak: "break-word",
  },
  noRenew: { fontWeight: 700, color: theme.palette.warning.dark },
  mb: { marginBottom: theme.spacing(2) },
  sectionTitle: { fontWeight: 700, marginBottom: theme.spacing(1) },
}));

/** Sinais (C5) em texto simples — indícios, nunca prova. */
export function signalTexts(signals) {
  if (!signals) return [];
  const out = [];
  if (signals.coveredByCurrentDueDate) {
    out.push("O vencimento atual da empresa já cobre o período desta fatura.");
  }
  const renewals = Number(signals.adminRenewalsAfterDue);
  if (renewals > 0) {
    out.push(
      `Houve ${renewals} ${
        renewals === 1 ? "renovação administrativa" : "renovações administrativas"
      } depois do vencimento desta fatura. Renovação antiga não prova pagamento.`
    );
  }
  if (signals.efiCharge) out.push("Existe cobrança gerada na Efí para esta fatura.");
  if (signals.pendingReconciliation) out.push("Há pendência de conciliação com a Efí para esta fatura.");
  return out;
}

const REVENUE_TEXT = {
  revenue: "Conta como receita recebida",
  no_revenue: "Não conta como receita",
};

/**
 * Regularização histórica de uma fatura antiga (C5/C7).
 * Props: { open, companyId, invoice, signals?, onClose, onDone(result) }
 * `signals` pode vir no prop ou em `invoice.signals`.
 */
export default function HistoricalReviewDialog({
  open,
  companyId: companyIdProp,
  invoice,
  signals: signalsProp,
  onClose,
  onDone,
}) {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));
  const companyId = companyIdProp || invoice?.companyId;
  const signals = signalsProp || invoice?.signals || null;
  const hasEfi = Boolean(signals?.efiCharge || invoice?.externalTxid || invoice?.externalChargeId);

  const [step, setStep] = useState("form");
  const [decision, setDecision] = useState("");
  const [source, setSource] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [paidAtUnknown, setPaidAtUnknown] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [efiAck, setEfiAck] = useState(false);
  const [touched, setTouched] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setStep("form");
    setDecision("");
    setSource("");
    setPaidAt("");
    setPaidAtUnknown(false);
    setAmount(numberToBrlInput(invoice?.value));
    setMethod("");
    setNote("");
    setEfiAck(false);
    setTouched(false);
    setPreview(null);
    setUnavailable(false);
    setServerError(null);
    setBlocked(null);
    setSubmitting(false);
    submittingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id, invoice?.value]);

  const isPayment = decision === "historical_payment";
  const needsSource = NEEDS_SOURCE.includes(decision);
  const needsAck = hasEfi && TERMINAL.includes(decision);
  const paidIso = parseBrDate(paidAt);
  const amountNum = parseBrl(amount);
  const amountDiffers =
    isPayment && amountNum !== null && toCents(amountNum) !== toCents(invoice?.value);

  const errors = {
    decision: !decision ? "Escolha uma das opções." : null,
    source:
      needsSource && source.trim().length < MIN_SOURCE
        ? "Informe como foi confirmado (ex.: extrato bancário, comprovante do cliente)."
        : null,
    paidAt:
      isPayment && !paidAtUnknown
        ? !paidIso
          ? "Informe a data real (dd/mm/aaaa) ou marque “Não sei a data”."
          : moment(paidIso).isAfter(moment(), "day")
          ? "A data não pode estar no futuro."
          : null
        : null,
    amount:
      isPayment && (amountNum === null || amountNum <= 0)
        ? "Informe o valor."
        : amountDiffers
        ? `O valor deve ser igual ao da fatura (${formatBrl(invoice?.value)}).`
        : null,
    method: isPayment && !method ? "Escolha a forma de pagamento (ou “Não sei”)." : null,
    note: note.trim().length < MIN_NOTE ? `Explique em pelo menos ${MIN_NOTE} caracteres.` : null,
    efiAck: needsAck && !efiAck ? "Confirme que verificou a cobrança na Efí." : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (f) => touched && errors[f];

  const buildPayload = () => {
    const body = { decision, note: note.trim() };
    if (needsSource) body.confirmationSource = source.trim();
    if (isPayment) {
      if (paidAtUnknown) body.paidAtUnknown = true;
      else body.paidAt = paidIso;
      body.amount = amountNum;
      body.method = method;
    }
    if (hasEfi) body.efiChargeAcknowledged = Boolean(efiAck);
    return body;
  };

  const basePath = `/saas/companies/${companyId}/finance/invoices/${invoice?.id}/historical-review`;

  const handleServerError = (err, feature) => {
    const code = errorCode(err);
    const status = httpStatus(err);
    if (status === 409) {
      setBlocked({
        code,
        message:
          apiErrorMessage(err) || "Esta fatura mudou de situação. Recarregue a lista e tente novamente.",
      });
      return;
    }
    if (status === 400) {
      setServerError(apiErrorMessage(err) || "Revise os dados informados.");
      setStep("form");
      return;
    }
    showFinanceError(err, feature);
  };

  const goPreview = async () => {
    setTouched(true);
    if (!valid) return;
    setServerError(null);
    setBlocked(null);
    setPreview(null);
    setUnavailable(false);
    setStep("preview");
    setPreviewLoading(true);
    try {
      const { data } = await api.post(`${basePath}/preview`, buildPayload());
      setPreview(data || null);
    } catch (err) {
      if (isNotFoundRoute(err)) setUnavailable(true);
      else handleServerError(err, "A prévia da regularização");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview?.valid || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { data } = await api.post(basePath, buildPayload());
      const msg = {
        historical_payment: "Pagamento histórico registrado. A assinatura não foi renovada.",
        improper_cancel: "Fatura cancelada como indevida.",
        historical_courtesy: "Cortesia histórica registrada (sem receita, sem renovação).",
        keep_pending: "Análise registrada. A fatura continua em aberto.",
      };
      toast.success(msg[decision] || "Regularização registrada.");
      if (onDone) onDone(data);
      if (onClose) onClose();
    } catch (err) {
      if (isNotFoundRoute(err)) {
        toast.error("A regularização histórica ainda não está disponível neste servidor.");
      } else {
        handleServerError(err, "A regularização histórica");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const sig = signalTexts(signals);

  const renderInvoice = () => (
    <Box className={classes.summary}>
      <Box>
        <div className={classes.label}>Fatura</div>
        <div className={classes.value}>#{invoice?.id}</div>
      </Box>
      <Box>
        <div className={classes.label}>Valor</div>
        <div className={classes.value}>{formatBrl(invoice?.value)}</div>
      </Box>
      <Box>
        <div className={classes.label}>Vencimento</div>
        <div className={classes.value}>{formatDate(invoice?.dueDate)}</div>
      </Box>
      <Box>
        <div className={classes.label}>Competência</div>
        <div className={classes.value}>{formatCompetence(invoice?.competence)}</div>
      </Box>
      <Box>
        <div className={classes.label}>Criada em</div>
        <div className={classes.value}>{formatDate(invoice?.createdAt)}</div>
      </Box>
    </Box>
  );

  const renderSignals = () => (
    <Box className={classes.signals}>
      <Typography variant="body2" style={{ fontWeight: 700 }}>
        Indícios encontrados (não são prova de pagamento)
      </Typography>
      {sig.length ? (
        <ul className={classes.signalList}>
          {sig.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : (
        <Typography variant="body2" color="textSecondary">
          Nenhum indício automático. Decida com base em documentos (extrato, comprovante, conversa
          com o cliente).
        </Typography>
      )}
      <Typography variant="caption" color="textSecondary" component="p" style={{ marginTop: 6 }}>
        Uma renovação antiga ou um vencimento “em dia” não provam que esta fatura foi paga. Só marque
        como paga se tiver confirmação.
      </Typography>
    </Box>
  );

  const renderForm = () => (
    <>
      {serverError ? (
        <Alert severity="error" className={classes.mb}>
          {serverError}
        </Alert>
      ) : null}
      <Typography variant="body2" color="textSecondary" paragraph>
        Esta fatura é antiga e não tem pagamento registrado. Diga o que realmente aconteceu com ela.
        Nenhuma das opções renova a assinatura.
      </Typography>
      {renderInvoice()}
      {renderSignals()}

      <Typography variant="subtitle2" className={classes.sectionTitle}>
        O que aconteceu com esta fatura?
      </Typography>
      <Box role="radiogroup" aria-label="Decisão" className={classes.mb}>
        {HISTORICAL_DECISIONS.map((d) => (
          <Box
            key={d.value}
            className={`${classes.option} ${decision === d.value ? classes.optionSelected : ""}`}
            onClick={() => !submitting && setDecision(d.value)}
          >
            <Radio
              color="primary"
              size="small"
              checked={decision === d.value}
              onChange={() => setDecision(d.value)}
              value={d.value}
              inputProps={{ "aria-label": d.title }}
              style={{ padding: 4 }}
            />
            <Box>
              <div className={classes.optionTitle}>{d.title}</div>
              <div className={classes.optionDesc}>{d.description}</div>
            </Box>
          </Box>
        ))}
        {show("decision") ? (
          <Typography variant="caption" color="error">
            {errors.decision}
          </Typography>
        ) : null}
      </Box>

      {decision ? (
        <Grid container spacing={2}>
          {needsSource ? (
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                variant="outlined"
                id="historical-source"
                label="Como foi confirmado (fonte da confirmação)"
                placeholder="Ex.: extrato bancário de julho, comprovante enviado pelo cliente"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                error={Boolean(show("source"))}
                helperText={show("source") || " "}
                inputProps={{ maxLength: 255 }}
              />
            </Grid>
          ) : null}
          {isPayment ? (
            <>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  variant="outlined"
                  id="historical-paid-at"
                  label="Data real do pagamento"
                  placeholder="dd/mm/aaaa"
                  value={paidAtUnknown ? "" : paidAt}
                  onChange={(e) => setPaidAt(maskBrDate(e.target.value))}
                  disabled={paidAtUnknown}
                  error={Boolean(show("paidAt"))}
                  helperText={show("paidAt") || " "}
                  inputProps={{ inputMode: "numeric" }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      color="primary"
                      checked={paidAtUnknown}
                      onChange={(e) => setPaidAtUnknown(e.target.checked)}
                    />
                  }
                  label="Não sei a data (data desconhecida)"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  variant="outlined"
                  id="historical-amount"
                  label="Valor pago"
                  value={amount}
                  onChange={(e) => setAmount(maskBrl(e.target.value))}
                  error={Boolean(show("amount")) || Boolean(amountDiffers)}
                  helperText={
                    show("amount") || (amountDiffers ? "Diferente do valor da fatura." : "Igual ao valor da fatura.")
                  }
                  InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
                  inputProps={{ inputMode: "numeric" }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  required
                  variant="outlined"
                  id="historical-method"
                  label="Forma de pagamento"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  error={Boolean(show("method"))}
                  helperText={show("method") || " "}
                >
                  {HISTORICAL_PAYMENT_METHODS.map((m) => (
                    <MenuItem key={m.value} value={m.value}>
                      {m.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </>
          ) : null}
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              multiline
              rows={3}
              variant="outlined"
              id="historical-note"
              label="Observação"
              placeholder="Explique a decisão para quem consultar depois"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              error={Boolean(show("note"))}
              helperText={show("note") || "Ficará registrada na linha do tempo."}
              inputProps={{ maxLength: 1000 }}
            />
          </Grid>
          {needsAck ? (
            <Grid item xs={12}>
              <Alert severity="warning">
                Esta fatura tem cobrança gerada na Efí. Verifique na Efí se o cliente não pagou por lá
                antes de continuar — se pagou, use a guia Conciliação.
              </Alert>
              <FormControlLabel
                control={
                  <Checkbox color="primary" checked={efiAck} onChange={(e) => setEfiAck(e.target.checked)} />
                }
                label="Verifiquei a cobrança na Efí e confirmo esta decisão"
              />
              {show("efiAck") ? (
                <Typography variant="caption" color="error" display="block">
                  {errors.efiAck}
                </Typography>
              ) : null}
            </Grid>
          ) : null}
        </Grid>
      ) : null}
    </>
  );

  const row = (label, value, key) => (
    <React.Fragment key={key || label}>
      <span className={classes.label} style={{ alignSelf: "center" }}>
        {label}
      </span>
      <span className={classes.value}>{value}</span>
    </React.Fragment>
  );

  const renderPreview = () => {
    if (previewLoading) {
      return (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={32} />
        </Box>
      );
    }
    if (unavailable) {
      return (
        <Alert severity="info">
          A regularização histórica ainda não está disponível neste servidor. Nada foi alterado.
        </Alert>
      );
    }
    if (!preview) {
      return blocked ? null : <Alert severity="warning">Não foi possível calcular a prévia.</Alert>;
    }
    const decisionInfo = HISTORICAL_DECISIONS.find((d) => d.value === (preview.decision || decision));
    const pay = preview.payment;
    return (
      <>
        <Typography variant="body2" paragraph>
          Confira o que vai acontecer antes de confirmar:
        </Typography>
        <Box className={classes.previewGrid}>
          {row("Fatura", `#${invoice?.id} — ${formatBrl(invoice?.value)} — vence ${formatDate(invoice?.dueDate)}`)}
          {row("Decisão", decisionInfo?.title || decision)}
          {row("Receita", REVENUE_TEXT[preview.revenueEffect] || "—")}
          {row("Situação da fatura depois", invoiceStatusLabel(preview.invoiceStatusAfter))}
          {pay
            ? row(
                "Pagamento",
                `${formatBrl(pay.amount)} · ${
                  pay.paidAtUnknown || !pay.paidAt ? "data não informada" : formatDate(pay.paidAt)
                }${isPayment && method ? ` · ${methodLabel(method)}` : ""}`
              )
            : null}
          {row(
            "Assinatura",
            <span className={classes.noRenew}>NÃO haverá renovação — o vencimento não muda</span>
          )}
          {row("Observação", note.trim())}
        </Box>
        {(preview.errors || []).map((e) => (
          <Alert key={`e-${e.code}`} severity="error" className={classes.mb}>
            {e.message}
          </Alert>
        ))}
        {(preview.alerts || []).map((a) => (
          <Alert key={`a-${a.code}`} severity="warning" className={classes.mb}>
            {a.message}
          </Alert>
        ))}
        {preview.valid === false && !(preview.errors || []).length ? (
          <Alert severity="error" className={classes.mb}>
            Esta regularização não pode ser feita. Volte e revise os dados.
          </Alert>
        ) : null}
      </>
    );
  };

  const renderBlocked = () =>
    blocked ? (
      <Alert
        severity={blocked.code === "ERR_HISTORICAL_EFI_CONFLICT" ? "warning" : "error"}
        className={classes.mb}
        action={
          <AppSecondaryButton
            size="small"
            onClick={() => {
              if (onDone) onDone(null);
              if (onClose) onClose();
            }}
          >
            Fechar e recarregar
          </AppSecondaryButton>
        }
      >
        {blocked.message}
        {blocked.code === "ERR_HISTORICAL_EFI_CONFLICT" ? (
          <Box mt={0.5}>
            Abra a guia <strong>Conciliação</strong> da empresa para resolver a divergência com a Efí.
          </Box>
        ) : null}
      </Alert>
    ) : null;

  return (
    <Dialog
      open={Boolean(open)}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>
        Regularizar fatura antiga{step === "preview" ? " — prévia" : ""}
      </DialogTitle>
      <DialogContent>
        {renderBlocked()}
        {step === "form" ? renderForm() : renderPreview()}
      </DialogContent>
      <DialogActions>
        {step === "preview" ? (
          <AppSecondaryButton onClick={() => setStep("form")} disabled={submitting}>
            Voltar
          </AppSecondaryButton>
        ) : (
          <AppSecondaryButton onClick={onClose} disabled={submitting}>
            Cancelar
          </AppSecondaryButton>
        )}
        {step === "form" ? (
          <AppPrimaryButton onClick={goPreview} disabled={Boolean(blocked) || (touched && !valid)}>
            Ver prévia
          </AppPrimaryButton>
        ) : (
          <AppPrimaryButton
            onClick={handleConfirm}
            loading={submitting}
            disabled={previewLoading || !preview?.valid || Boolean(blocked)}
          >
            Confirmar regularização
          </AppPrimaryButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
