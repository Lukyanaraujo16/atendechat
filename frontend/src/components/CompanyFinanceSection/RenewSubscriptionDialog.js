import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import { makeStyles, useTheme, alpha } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import { toast } from "react-toastify";

import api from "../../services/api";
import { AppPrimaryButton, AppSecondaryButton } from "../../ui";
import showFinanceError from "./financeErrors";
import {
  errorCode,
  formatDate,
  isNotFoundRoute,
  recurrenceLabel,
  toDateOnly,
} from "./financeFormat";

const useStyles = makeStyles((theme) => ({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  cell: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
  },
  highlight: {
    borderColor: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.06),
  },
  label: {
    fontSize: "0.72rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
  },
  value: {
    fontWeight: 700,
    fontSize: "1.05rem",
    marginTop: 4,
  },
  alert: {
    marginBottom: theme.spacing(2),
  },
}));

const MIN_REASON = 3;

const BLOCK_KIND_TEXT = {
  manual: "bloqueio manual",
  financial: "bloqueio financeiro",
  unknown: "motivo desconhecido",
};

/**
 * Diálogo compartilhado de renovação administrativa da assinatura.
 * Props: { open, company: {id,name,dueDate,recurrence}, onClose, onRenewed(companyData) }
 */
export default function RenewSubscriptionDialog({ open, company, onClose, onRenewed }) {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));
  const companyId = company?.id;

  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stale, setStale] = useState(false);
  const submittingRef = useRef(false);

  const loadPreview = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setStale(false);
    setPreviewUnavailable(false);
    try {
      const { data } = await api.get(
        `/saas/companies/${companyId}/finance/renewal-preview`
      );
      setPreview(data || null);
    } catch (err) {
      setPreview(null);
      if (isNotFoundRoute(err)) {
        setPreviewUnavailable(true);
      } else {
        showFinanceError(err, "A prévia de renovação");
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (open) {
      setReason("");
      setConfirmed(false);
      setSubmitting(false);
      submittingRef.current = false;
      loadPreview();
    } else {
      setPreview(null);
    }
  }, [open, loadPreview]);

  const reasonOk = reason.trim().length >= MIN_REASON;
  const currentDueDate = preview
    ? preview.currentDueDate ?? null
    : toDateOnly(company?.dueDate);
  const canSubmit =
    !loading &&
    !submitting &&
    !stale &&
    reasonOk &&
    confirmed &&
    (Boolean(preview) || previewUnavailable);

  const handleSubmit = async () => {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/companies/${companyId}/renew`, {
        reason: reason.trim(),
        expectedCurrentDueDate: currentDueDate,
      });
      const newDue = data?.dueDate || preview?.newDueDate;
      toast.success(
        newDue
          ? `Assinatura renovada. Novo vencimento: ${formatDate(newDue)}.`
          : "Assinatura renovada."
      );
      if (data?.autoUnblocked) {
        toast.info("A empresa foi desbloqueada automaticamente.");
      }
      if (onRenewed) onRenewed(data);
      if (onClose) onClose();
    } catch (err) {
      if (errorCode(err) === "ERR_RENEWAL_STALE") {
        setStale(true);
      } else {
        showFinanceError(err, "A renovação de assinatura");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    if (onClose) onClose();
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>Renovar assinatura{company?.name ? ` — ${company.name}` : ""}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
            {stale ? (
              <Alert
                severity="warning"
                className={classes.alert}
                action={
                  <AppSecondaryButton size="small" onClick={loadPreview}>
                    Recarregar
                  </AppSecondaryButton>
                }
              >
                O vencimento já foi alterado — recarregue para ver a situação atual antes
                de renovar.
              </Alert>
            ) : null}

            {previewUnavailable ? (
              <Alert severity="info" className={classes.alert}>
                A prévia do novo vencimento ainda não está disponível neste servidor. A
                renovação será calculada a partir do vencimento atual.
              </Alert>
            ) : null}

            <Box className={classes.grid}>
              <Box className={classes.cell}>
                <div className={classes.label}>Vencimento atual</div>
                <div className={classes.value}>{formatDate(currentDueDate)}</div>
              </Box>
              <Box className={classes.cell}>
                <div className={classes.label}>Período contratado</div>
                <div className={classes.value}>
                  {recurrenceLabel(
                    preview?.recurrence || company?.recurrence,
                    preview?.months
                  )}
                </div>
              </Box>
              <Box className={`${classes.cell} ${classes.highlight}`}>
                <div className={classes.label}>Novo vencimento previsto</div>
                <div className={classes.value}>
                  {preview?.newDueDate ? formatDate(preview.newDueDate) : "—"}
                </div>
              </Box>
            </Box>

            {preview?.overdue ? (
              <Alert severity="warning" className={classes.alert}>
                A assinatura está vencida.
                {Number(preview.cyclesSkipped) > 0
                  ? ` ${preview.cyclesSkipped} ${
                      Number(preview.cyclesSkipped) === 1
                        ? "ciclo não pago será pulado"
                        : "ciclos não pagos serão pulados"
                    } para que o novo vencimento fique no futuro.`
                  : " O novo vencimento será calculado a partir do período em atraso."}
              </Alert>
            ) : null}

            {preview && Object.prototype.hasOwnProperty.call(preview, "willUnblock") ? (
              <Alert
                severity={preview.willUnblock ? "success" : preview.blockKind === "none" ? "info" : "warning"}
                className={classes.alert}
              >
                {preview.willUnblock
                  ? "A empresa será desbloqueada ao renovar."
                  : preview.blockKind === "none" || !preview.blockKind
                  ? "A empresa está ativa; o acesso não muda."
                  : `A empresa continuará bloqueada (${
                      BLOCK_KIND_TEXT[preview.blockKind] || "motivo desconhecido"
                    }).`}
              </Alert>
            ) : null}

            {(preview?.alerts || [])
              .filter((a) => !(preview?.overdue && a.code === "CYCLES_SKIPPED"))
              .map((a) => (
              <Alert key={a.code} severity="warning" className={classes.alert}>
                {a.message}
              </Alert>
            ))}

            <Typography variant="body2" color="textSecondary" paragraph>
              <strong>Renovação administrativa — sem receita.</strong> A renovação administrativa estende o vencimento por um período contratado
              e não gera receita nem cobrança.
            </Typography>

            <TextField
              fullWidth
              required
              multiline
              rows={3}
              variant="outlined"
              id="renew-subscription-reason"
              label="Justificativa"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={reason.length > 0 && !reasonOk}
              helperText={
                reason.length > 0 && !reasonOk
                  ? `Mínimo de ${MIN_REASON} caracteres.`
                  : "Ficará registrada na auditoria."
              }
              disabled={submitting}
              inputProps={{ maxLength: 500 }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  color="primary"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={submitting}
                />
              }
              label={
                preview?.newDueDate
                  ? `Confirmo a renovação: vencimento passará de ${formatDate(
                      currentDueDate
                    )} para ${formatDate(preview.newDueDate)}.`
                  : "Confirmo a renovação desta assinatura."
              }
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <AppSecondaryButton onClick={handleClose} disabled={submitting}>
          Cancelar
        </AppSecondaryButton>
        <AppPrimaryButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        >
          Renovar assinatura
        </AppPrimaryButton>
      </DialogActions>
    </Dialog>
  );
}
