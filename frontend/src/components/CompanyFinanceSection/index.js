import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import moment from "moment";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import {
  AppSectionCard,
  AppPrimaryButton,
  AppSecondaryButton,
  AppLoadingState,
  AppEmptyState,
} from "../../ui";

const useStyles = makeStyles((theme) => ({
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  kpi: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
  },
  kpiLabel: {
    fontSize: "0.7rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
  },
  kpiValue: {
    fontWeight: 700,
    fontSize: "1.1rem",
    marginTop: 4,
  },
  tabRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  syncPending: {
    backgroundColor: alpha(theme.palette.warning.main, 0.12),
  },
}));

function formatBrl(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

function statusChip(status) {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return <Chip size="small" label="Paga" color="primary" />;
  if (s === "cancelled") return <Chip size="small" label="Cancelada" />;
  if (s === "open") return <Chip size="small" label="Aberta" variant="outlined" />;
  return <Chip size="small" label={status || "—"} />;
}

/** Nunca apresentar baixa local como confirmação Efí. */
function syncLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "synced") return "Sincronizado Efí";
  if (s === "unsupported") return "Só local (Efí não confirmou)";
  if (s === "failed") return "Falha sync Efí";
  if (s === "pending") return "Pendente conciliação";
  if (s === "none" || !s) return "—";
  return status;
}

/**
 * Seção Financeiro no cadastro da empresa (Super Admin).
 */
export default function CompanyFinanceSection({ companyId, highlight }) {
  const classes = useStyles();
  const [tab, setTab] = useState("invoices");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [events, setEvents] = useState([]);
  const [reconciliation, setReconciliation] = useState([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    invoiceId: "",
    kind: "paid_offline",
    amount: "",
    method: "pix",
    paidAt: moment().format("YYYY-MM-DD"),
    reason: "",
  });
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [sum, inv, pay, ren, ev, rec] = await Promise.all([
        api.get(`/saas/companies/${companyId}/finance/summary`),
        api.get(`/saas/companies/${companyId}/finance/invoices`, {
          params: { limit: 50 },
        }),
        api.get(`/saas/companies/${companyId}/finance/payments`, {
          params: { limit: 50 },
        }),
        api.get(`/saas/companies/${companyId}/finance/renewals`),
        api.get(`/saas/companies/${companyId}/finance/events`),
        api.get(`/saas/companies/${companyId}/finance/reconciliation`),
      ]);
      setSummary(sum.data);
      setInvoices(inv.data?.invoices || []);
      setPayments(pay.data?.payments || []);
      setRenewals(ren.data?.renewals || []);
      setEvents(ev.data?.events || []);
      setReconciliation(rec.data?.items || []);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const openInvoiceDetail = async (invoiceId) => {
    try {
      const { data } = await api.get(
        `/saas/companies/${companyId}/finance/invoices/${invoiceId}`
      );
      setDetail(data);
    } catch (e) {
      toastError(e);
    }
  };

  const submitManual = async () => {
    try {
      await api.post(`/saas/companies/${companyId}/finance/manual-payment`, {
        invoiceId: Number(manualForm.invoiceId),
        kind: manualForm.kind,
        amount: Number(manualForm.amount),
        method: manualForm.method,
        paidAt: new Date(manualForm.paidAt).toISOString(),
        reason: manualForm.reason,
      });
      toast.success(
        manualForm.kind === "courtesy"
          ? "Cortesia registrada (não conta como receita)."
          : "Baixa manual registrada."
      );
      setManualOpen(false);
      await load();
    } catch (e) {
      toastError(e);
    }
  };

  if (!companyId) {
    return (
      <AppSectionCard>
        <AppEmptyState title="Salve a empresa para ver o financeiro." />
      </AppSectionCard>
    );
  }

  return (
    <AppSectionCard id="company-finance-section">
      <Typography variant="h6" component="h2" gutterBottom>
        Financeiro
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Histórico exclusivo desta empresa. Cortesia e renovação administrativa não
        entram como receita recebida.
      </Typography>

      {loading ? (
        <AppLoadingState />
      ) : (
        <>
          <Box className={classes.kpiGrid}>
            <Box className={classes.kpi}>
              <div className={classes.kpiLabel}>Plano</div>
              <div className={classes.kpiValue}>
                {summary?.planName || "—"}
              </div>
            </Box>
            <Box className={classes.kpi}>
              <div className={classes.kpiLabel}>Contratado</div>
              <div className={classes.kpiValue}>
                {formatBrl(summary?.contractedValue)}
              </div>
            </Box>
            <Box className={classes.kpi}>
              <div className={classes.kpiLabel}>Vencimento</div>
              <div className={classes.kpiValue}>
                {summary?.dueDate
                  ? moment(summary.dueDate).format("DD/MM/YYYY")
                  : "—"}
              </div>
            </Box>
            <Box className={classes.kpi}>
              <div className={classes.kpiLabel}>Emitido</div>
              <div className={classes.kpiValue}>
                {formatBrl(summary?.totals?.invoiced)}
              </div>
            </Box>
            <Box className={classes.kpi}>
              <div className={classes.kpiLabel}>Recebido</div>
              <div className={classes.kpiValue}>
                {formatBrl(summary?.totals?.received)}
              </div>
            </Box>
            <Box className={classes.kpi}>
              <div className={classes.kpiLabel}>Em aberto</div>
              <div className={classes.kpiValue}>
                {formatBrl(summary?.totals?.open)}
              </div>
            </Box>
            <Box className={classes.kpi}>
              <div className={classes.kpiLabel}>Vencido</div>
              <div className={classes.kpiValue}>
                {formatBrl(summary?.totals?.overdue)}
              </div>
            </Box>
          </Box>

          <Box className={classes.tabRow}>
            {[
              ["invoices", "Faturas"],
              ["payments", "Pagamentos"],
              ["renewals", "Renovações"],
              ["events", "Auditoria"],
              ["recon", "Conciliação"],
            ].map(([k, label]) => (
              <AppSecondaryButton
                key={k}
                onClick={() => setTab(k)}
                style={
                  tab === k
                    ? { borderColor: "currentColor", fontWeight: 700 }
                    : undefined
                }
              >
                {label}
              </AppSecondaryButton>
            ))}
            <AppPrimaryButton
              onClick={() => {
                const openInv = invoices.find(
                  (i) => String(i.status).toLowerCase() === "open"
                );
                setManualForm((f) => ({
                  ...f,
                  invoiceId: openInv ? String(openInv.id) : "",
                  amount: openInv ? String(openInv.value) : "",
                }));
                setManualOpen(true);
              }}
            >
              Baixa manual
            </AppPrimaryButton>
          </Box>

          {tab === "invoices" && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Detalhe</TableCell>
                  <TableCell>Competência</TableCell>
                  <TableCell>Vencimento</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Sync Efí</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className={
                      inv.gatewaySyncStatus === "pending" ||
                      inv.gatewaySyncStatus === "failed" ||
                      inv.gatewaySyncStatus === "unsupported"
                        ? classes.syncPending
                        : undefined
                    }
                  >
                    <TableCell>{inv.id}</TableCell>
                    <TableCell>{inv.detail}</TableCell>
                    <TableCell>{inv.competence || "—"}</TableCell>
                    <TableCell>
                      {inv.dueDate
                        ? moment(inv.dueDate).format("DD/MM/YYYY")
                        : "—"}
                    </TableCell>
                    <TableCell>{formatBrl(inv.value)}</TableCell>
                    <TableCell>{statusChip(inv.status)}</TableCell>
                    <TableCell>
                      {syncLabel(inv.gatewaySyncStatus)}
                      {inv.gatewaySyncError ? (
                        <Typography variant="caption" display="block" color="error">
                          {inv.gatewaySyncError}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <AppSecondaryButton onClick={() => openInvoiceDetail(inv.id)}>
                        Detalhe
                      </AppSecondaryButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!invoices.length ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <AppEmptyState title="Nenhuma fatura" />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}

          {tab === "payments" && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell>Método</TableCell>
                  <TableCell>Origem</TableCell>
                  <TableCell>Receita?</TableCell>
                  <TableCell>Sync</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {moment(p.paidAt).format("DD/MM/YYYY HH:mm")}
                    </TableCell>
                    <TableCell>{formatBrl(p.amount)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>{p.source}</TableCell>
                    <TableCell>{p.countsAsRevenue ? "Sim" : "Não"}</TableCell>
                    <TableCell>{syncLabel(p.gatewaySyncStatus)}</TableCell>
                  </TableRow>
                ))}
                {!payments.length ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <AppEmptyState title="Nenhum pagamento" />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}

          {tab === "renewals" && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Motivo</TableCell>
                  <TableCell>Anterior</TableCell>
                  <TableCell>Novo</TableCell>
                  <TableCell>Meses</TableCell>
                  <TableCell>Quando</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {renewals.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.reason}</TableCell>
                    <TableCell>{r.previousDueDate || "—"}</TableCell>
                    <TableCell>{r.newDueDate}</TableCell>
                    <TableCell>{r.monthsAdded}</TableCell>
                    <TableCell>
                      {moment(r.createdAt).format("DD/MM/YYYY HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {tab === "events" && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Evento</TableCell>
                  <TableCell>Fatura</TableCell>
                  <TableCell>Quando</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.eventType}</TableCell>
                    <TableCell>{e.invoiceId || "—"}</TableCell>
                    <TableCell>
                      {moment(e.createdAt).format("DD/MM/YYYY HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {tab === "recon" && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Mensagem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reconciliation.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.kind}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell>{item.message}</TableCell>
                  </TableRow>
                ))}
                {!reconciliation.length ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <AppEmptyState title="Sem pendências de conciliação" />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </>
      )}

      <Dialog open={manualOpen} onClose={() => setManualOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Baixa manual / cortesia</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Fatura"
                value={manualForm.invoiceId}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, invoiceId: e.target.value }))
                }
              >
                {invoices
                  .filter((i) => String(i.status).toLowerCase() === "open")
                  .map((i) => (
                    <MenuItem key={i.id} value={String(i.id)}>
                      #{i.id} — {formatBrl(i.value)} — {i.dueDate}
                    </MenuItem>
                  ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label="Tipo"
                value={manualForm.kind}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, kind: e.target.value }))
                }
              >
                <MenuItem value="paid_offline">Pagamento offline (receita)</MenuItem>
                <MenuItem value="courtesy">Cortesia (não é receita)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label="Método"
                value={manualForm.method}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, method: e.target.value }))
                }
              >
                <MenuItem value="pix">Pix</MenuItem>
                <MenuItem value="boleto">Boleto (recebido offline)</MenuItem>
                <MenuItem value="credit_card">Cartão (recebido offline)</MenuItem>
                <MenuItem value="transfer">Transferência</MenuItem>
                <MenuItem value="cash">Dinheiro</MenuItem>
                <MenuItem value="other">Outro</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Valor"
                type="number"
                value={manualForm.amount}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Data"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={manualForm.paidAt}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, paidAt: e.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Motivo (obrigatório)"
                value={manualForm.reason}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, reason: e.target.value }))
                }
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="textSecondary">
                Método = como o valor foi recebido offline (não emite boleto/cartão
                Efí). Pix não tem baixa manual oficial na Efí — fica “Só local”.
                Emissão boleto/cartão e settle permanecem desativados por flag.
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton onClick={() => setManualOpen(false)}>
            Cancelar
          </AppSecondaryButton>
          <AppPrimaryButton onClick={submitManual}>Confirmar</AppPrimaryButton>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle>Detalhe da fatura #{detail?.invoice?.id}</DialogTitle>
        <DialogContent>
          {detail ? (
            <Box>
              <Typography>
                Status: {detail.invoice.status} · Sync:{" "}
                {detail.invoice.gatewaySyncStatus || "—"}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                txid: {detail.invoice.externalTxid || "—"} · chargeId:{" "}
                {detail.invoice.externalChargeId || "—"}
              </Typography>
              {detail.invoice.gatewaySyncError ? (
                <Typography color="error" variant="body2">
                  {detail.invoice.gatewaySyncError}
                </Typography>
              ) : null}
              <Typography variant="subtitle2" style={{ marginTop: 16 }}>
                Pagamentos
              </Typography>
              {(detail.payments || []).map((p) => (
                <Typography key={p.id} variant="body2">
                  {formatBrl(p.amount)} · {p.source} · {p.method} · receita=
                  {String(p.countsAsRevenue)}
                </Typography>
              ))}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton onClick={() => setDetail(null)}>Fechar</AppSecondaryButton>
        </DialogActions>
      </Dialog>
      {highlight ? <span data-finance-highlight="1" /> : null}
    </AppSectionCard>
  );
}
