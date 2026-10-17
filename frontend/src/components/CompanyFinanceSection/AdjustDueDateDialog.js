import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  formatDate,
  httpStatus,
  maskBrDate,
  parseBrDate,
  toDateOnly,
} from "./financeFormat";

const MIN_REASON = 3;

const useStyles = makeStyles((theme) => ({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
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
  value: { fontWeight: 700, fontSize: "1.05rem", marginTop: 4 },
  mb: { marginBottom: theme.spacing(2) },
}));

/**
 * Ajuste administrativo do vencimento: POST /saas/companies/:id/finance/adjust-due-date
 * { dueDate: YYYY-MM-DD, reason }. Props: { open, companyId, companyName, currentDueDate, onClose, onDone }.
 */
export default function AdjustDueDateDialog({
  open,
  companyId,
  companyName,
  currentDueDate,
  onClose,
  onDone,
}) {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));
  const [dueDate, setDueDate] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setDueDate("");
      setReason("");
      setTouched(false);
      setConflict(null);
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [open]);

  const current = toDateOnly(currentDueDate);
  const iso = parseBrDate(dueDate);
  const same = iso && current && iso === current;
  const inPast = iso && moment(iso, "YYYY-MM-DD").isBefore(moment(), "day");
  const errors = {
    dueDate: !iso ? "Informe uma data válida (dd/mm/aaaa)." : same ? "A nova data é igual ao vencimento atual." : null,
    reason: reason.trim().length < MIN_REASON ? `Mínimo de ${MIN_REASON} caracteres.` : null,
  };
  const valid = !errors.dueDate && !errors.reason;
  const show = (f) => (touched || (f === "dueDate" ? dueDate.length >= 10 : reason.length > 0)) && errors[f];

  const handleSubmit = async () => {
    setTouched(true);
    if (!valid || submittingRef.current || conflict) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/saas/companies/${companyId}/finance/adjust-due-date`, {
        dueDate: iso,
        reason: reason.trim(),
      });
      if (data?.alreadyApplied) {
        toast.info(`O vencimento já estava em ${formatDate(iso)}. Nada foi alterado.`);
      } else {
        toast.success(`Vencimento ajustado para ${formatDate(iso)}.`);
      }
      if (onDone) onDone(data);
      if (onClose) onClose();
    } catch (err) {
      if (httpStatus(err) === 409) {
        setConflict(
          apiErrorMessage(err) ||
            "O vencimento foi alterado por outra operação enquanto esta tela estava aberta."
        );
      } else if (errorCode(err) === "ERR_INVALID_DUE_DATE") {
        toast.error(apiErrorMessage(err));
      } else {
        showFinanceError(err, "O ajuste de vencimento");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>Ajustar vencimento{companyName ? ` — ${companyName}` : ""}</DialogTitle>
      <DialogContent>
        {conflict ? (
          <Alert
            severity="warning"
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
            {conflict} Feche e abra novamente para ver o vencimento atualizado.
          </Alert>
        ) : null}
        <Typography variant="body2" color="textSecondary" paragraph>
          Use para corrigir a data de vencimento (ex.: acordo com o cliente). Não registra
          pagamento, não quita faturas e não gera receita. Fica registrado na linha do tempo.
        </Typography>
        <Box className={classes.grid}>
          <Box className={classes.cell}>
            <div className={classes.label}>Vencimento atual</div>
            <div className={classes.value}>{formatDate(current)}</div>
          </Box>
          <Box className={`${classes.cell} ${classes.highlight}`}>
            <div className={classes.label}>Novo vencimento</div>
            <div className={classes.value}>{iso ? formatDate(iso) : "—"}</div>
          </Box>
        </Box>
        <TextField
          fullWidth
          required
          variant="outlined"
          id="adjust-due-date-new"
          label="Nova data de vencimento"
          placeholder="dd/mm/aaaa"
          value={dueDate}
          onChange={(e) => setDueDate(maskBrDate(e.target.value))}
          error={Boolean(show("dueDate"))}
          helperText={show("dueDate") || " "}
          inputProps={{ inputMode: "numeric" }}
          disabled={submitting}
          className={classes.mb}
        />
        {inPast && !errors.dueDate ? (
          <Alert severity="warning" className={classes.mb}>
            Esta data já passou: a assinatura ficará vencida logo após o ajuste.
          </Alert>
        ) : null}
        <TextField
          fullWidth
          required
          multiline
          rows={3}
          variant="outlined"
          id="adjust-due-date-reason"
          label="Justificativa"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={Boolean(show("reason"))}
          helperText={show("reason") || "Ficará registrada na linha do tempo."}
          inputProps={{ maxLength: 500 }}
          disabled={submitting}
        />
      </DialogContent>
      <DialogActions>
        <AppSecondaryButton onClick={onClose} disabled={submitting}>
          Cancelar
        </AppSecondaryButton>
        <AppPrimaryButton
          onClick={handleSubmit}
          loading={submitting}
          disabled={Boolean(conflict) || (touched && !valid)}
        >
          Ajustar vencimento
        </AppPrimaryButton>
      </DialogActions>
    </Dialog>
  );
}
