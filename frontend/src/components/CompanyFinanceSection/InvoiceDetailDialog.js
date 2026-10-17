import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
  useMediaQuery,
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";

import api from "../../services/api";
import { AppSecondaryButton } from "../../ui";
import showFinanceError from "./financeErrors";
import { InvoiceStatusChip, LegacyChip, PaymentKindChip, SyncStatusChip } from "./FinanceChips";
import {
  eventLabel,
  formatBrl,
  formatCompetence,
  formatDate,
  formatDateTime,
  formatPaidAt,
  methodLabel,
  reconKindLabel,
  reconStatusLabel,
  renewalReasonLabel,
  sourceLabel,
} from "./financeFormat";

const useStyles = makeStyles((theme) => ({
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  label: {
    fontSize: "0.72rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
  },
  section: { marginTop: theme.spacing(2), marginBottom: theme.spacing(1) },
  line: { padding: theme.spacing(0.75, 0), fontSize: "0.875rem" },
}));

function Field({ label, children }) {
  const classes = useStyles();
  return (
    <Box>
      <div className={classes.label}>{label}</div>
      <Box mt={0.5}>{children}</Box>
    </Box>
  );
}

export default function InvoiceDetailDialog({ open, companyId, invoiceId, onClose }) {
  const classes = useStyles();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("xs"));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!open || !invoiceId) return undefined;
    let active = true;
    setLoading(true);
    setData(null);
    api
      .get(`/saas/companies/${companyId}/finance/invoices/${invoiceId}`)
      .then(({ data: d }) => active && setData(d))
      .catch((err) => active && showFinanceError(err, "O detalhe de faturas"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, companyId, invoiceId]);

  const inv = data?.invoice;
  const payments = data?.payments || [];
  const events = data?.events || [];
  const renewals = data?.renewals || [];
  const recon = data?.reconciliation || [];

  return (
    <Dialog open={Boolean(open)} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>Fatura #{invoiceId}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={32} />
          </Box>
        ) : !inv ? (
          <Typography color="textSecondary">Não foi possível carregar a fatura.</Typography>
        ) : (
          <>
            {inv.isLegacy ? (
              <Alert severity="info" style={{ marginBottom: 16 }}>
                Fatura legada: criada antes da reorganização do faturamento, sem ciclo
                identificado com segurança. Revise individualmente; nenhuma ação em massa é
                aplicada automaticamente.
              </Alert>
            ) : null}
            <Box className={classes.grid}>
              <Field label="Situação">
                <InvoiceStatusChip invoice={inv} /> {inv.isLegacy ? <LegacyChip /> : null}
              </Field>
              <Field label="Valor">{formatBrl(inv.value)}</Field>
              <Field label="Vencimento">{formatDate(inv.dueDate)}</Field>
              <Field label="Competência">{formatCompetence(inv.competence)}</Field>
              <Field label="Descrição">{inv.detail || "—"}</Field>
              <Field label="Situação na Efí">
                <SyncStatusChip status={inv.gatewaySyncStatus} />
              </Field>
            </Box>

            <Divider />
            <Typography variant="subtitle2" className={classes.section}>
              Pagamentos
            </Typography>
            {payments.length ? (
              payments.map((p) => (
                <div key={p.id} className={classes.line}>
                  <PaymentKindChip source={p.source} countsAsRevenue={p.countsAsRevenue} />{" "}
                  {formatPaidAt(p.paidAt, p.paidAtUnknown || p.metadata?.paidAtUnknown)} ·{" "}
                  {formatBrl(p.amount)} · {sourceLabel(p.source)} ·{" "}
                  {methodLabel(p.method)} · {p.countsAsRevenue ? "conta como receita" : "não é receita"}
                </div>
              ))
            ) : (
              <Typography variant="body2" color="textSecondary">
                Nenhum pagamento.
              </Typography>
            )}

            {renewals.length ? (
              <>
                <Typography variant="subtitle2" className={classes.section}>
                  Renovações vinculadas
                </Typography>
                {renewals.map((r) => (
                  <div key={r.id} className={classes.line}>
                    {formatDateTime(r.createdAt)} · {renewalReasonLabel(r.reason)} ·{" "}
                    {formatDate(r.previousDueDate)} → {formatDate(r.newDueDate)}
                  </div>
                ))}
              </>
            ) : null}

            {recon.length ? (
              <>
                <Typography variant="subtitle2" className={classes.section}>
                  Conciliação
                </Typography>
                {recon.map((r) => (
                  <div key={r.id} className={classes.line}>
                    {reconKindLabel(r.kind)} · {reconStatusLabel(r.status)}
                  </div>
                ))}
              </>
            ) : null}

            <Typography variant="subtitle2" className={classes.section}>
              Histórico
            </Typography>
            {events.length ? (
              events.map((e) => (
                <div key={e.id} className={classes.line}>
                  {formatDateTime(e.createdAt)} · {eventLabel(e.eventType)}
                </div>
              ))
            ) : (
              <Typography variant="body2" color="textSecondary">
                Sem eventos.
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <AppSecondaryButton onClick={onClose}>Fechar</AppSecondaryButton>
      </DialogActions>
    </Dialog>
  );
}
