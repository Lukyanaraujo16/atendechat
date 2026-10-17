import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Tab,
  TextField,
  MenuItem,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import Alert from "@material-ui/lab/Alert";
import RefreshIcon from "@material-ui/icons/Refresh";

import api from "../../services/api";
import {
  AppSectionCard,
  AppSecondaryButton,
  AppLoadingState,
  AppEmptyState,
  AppTabs,
} from "../../ui";
import showFinanceError from "./financeErrors";
import FinanceTable from "./FinanceTable";
import {
  HistoricalCandidateChip,
  InvoiceStatusChip,
  LegacyChip,
  PaymentKindChip,
  SyncStatusChip,
  ToneChip,
} from "./FinanceChips";
import RenewSubscriptionDialog from "./RenewSubscriptionDialog";
import InvoiceFormDialog from "./InvoiceFormDialog";
import CancelInvoiceDialog from "./CancelInvoiceDialog";
import ManualPaymentDialog from "./ManualPaymentDialog";
import InvoiceDetailDialog from "./InvoiceDetailDialog";
import HistoricalReviewDialog from "./HistoricalReviewDialog";
import AdjustDueDateDialog from "./AdjustDueDateDialog";
import SubscriptionCenter from "./SubscriptionCenter";
import CompanyTimeline from "./CompanyTimeline";
import useSubscriptionSummary from "./useSubscriptionSummary";
import {
  eventLabel,
  formatBrl,
  formatCompetence,
  formatDate,
  formatDateTime,
  formatPaidAt,
  isNotFoundRoute,
  methodLabel,
  reconKindLabel,
  reconStatusLabel,
  recurrenceLabel,
  renewalReasonLabel,
  sourceLabel,
} from "./financeFormat";

const PAGE_SIZE = 50;

const useStyles = makeStyles((theme) => ({
  header: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  kpi: {
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
  },
  kpiAlert: {
    borderColor: alpha(theme.palette.error.main, 0.5),
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
    wordBreak: "break-word",
  },
  kpiHint: {
    fontSize: "0.72rem",
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  tabs: { marginBottom: theme.spacing(2) },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    alignItems: "center",
  },
  filterField: { minWidth: 170 },
  rowAttention: {
    backgroundColor: alpha(theme.palette.warning.main, 0.08),
  },
  rowHistorical: {
    backgroundColor: alpha(theme.palette.info.main, 0.06),
  },
  rowActions: {
    display: "inline-flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
    justifyContent: "flex-end",
  },
  mb: { marginBottom: theme.spacing(2) },
}));

const isOpen = (inv) => String(inv?.status || "").toLowerCase() === "open";
const needsAttention = (status) =>
  ["pending", "failed"].includes(String(status || "").toLowerCase());

function Kpi({ label, value, hint, alert }) {
  const classes = useStyles();
  return (
    <Box className={`${classes.kpi} ${alert ? classes.kpiAlert : ""}`}>
      <div className={classes.kpiLabel}>{label}</div>
      <div className={classes.kpiValue}>{value}</div>
      {hint ? <div className={classes.kpiHint}>{hint}</div> : null}
    </Box>
  );
}

/** Equivalente a Promise.allSettled (compatível com ambientes antigos). */
function allSettled(promises) {
  return Promise.all(
    promises.map((p) =>
      p.then(
        (value) => ({ status: "fulfilled", value }),
        (reason) => ({ status: "rejected", reason })
      )
    )
  );
}

/** Lê o resultado de allSettled tolerando rotas ainda inexistentes (404). */
/** Fatura histórica ainda não resolvida: sem decisão ou revisada e mantida pendente. */
export function isUnresolvedHistorical(item) {
  if (!item?.invoice) return false;
  return !item.review || item.review.decision === "keep_pending";
}

function settled(result, pick, fallback) {
  if (result.status === "fulfilled") {
    return { data: pick(result.value?.data) ?? fallback, unavailable: false };
  }
  if (isNotFoundRoute(result.reason)) return { data: fallback, unavailable: true };
  return { data: fallback, unavailable: false, error: result.reason };
}

/**
 * Financeiro da empresa (Super Admin).
 * Props: { companyId, company, onCompanyChanged, subscriptionState? }
 * `subscriptionState` ({ data, loading, unavailable, error, reload }) é opcional: quando a página já
 * carrega a Central de assinatura (para o cabeçalho), reaproveita; senão a seção carrega sozinha.
 */
export default function CompanyFinanceSection({
  companyId,
  company,
  onCompanyChanged,
  subscriptionState,
}) {
  const classes = useStyles();
  const ownSubscription = useSubscriptionSummary(companyId, { enabled: !subscriptionState });
  const sub = subscriptionState || ownSubscription;
  const subData = sub?.data || null;
  const [tab, setTab] = useState("invoices");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [invoiceMeta, setInvoiceMeta] = useState({ page: 1, hasMore: false });
  const [openInvoices, setOpenInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [events, setEvents] = useState([]);
  const [reconciliation, setReconciliation] = useState([]);
  const [historicalItems, setHistoricalItems] = useState([]);
  const [timelineKey, setTimelineKey] = useState(0);
  const [unavailable, setUnavailable] = useState({});
  const [statusFilter, setStatusFilter] = useState("");
  const [legacyFilter, setLegacyFilter] = useState("");
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const [paymentDialog, setPaymentDialog] = useState(null); // { mode, invoiceId }
  const [invoiceForm, setInvoiceForm] = useState(null); // { invoice? }
  const [cancelTarget, setCancelTarget] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [historicalTarget, setHistoricalTarget] = useState(null); // { invoice, signals }

  const base = `/saas/companies/${companyId}/finance`;

  const historicalFilter = statusFilter === "historical";

  const invoiceParams = useCallback(
    (page) => {
      const params = { page, limit: PAGE_SIZE };
      if (statusFilter && statusFilter !== "historical") params.status = statusFilter;
      if (legacyFilter) params.legacy = legacyFilter;
      return params;
    },
    [statusFilter, legacyFilter]
  );

  const loadInvoices = useCallback(
    async (page = 1) => {
      if (!companyId || historicalFilter) return;
      setInvoicesLoading(true);
      try {
        const { data } = await api.get(`${base}/invoices`, { params: invoiceParams(page) });
        const list = data?.invoices || [];
        setInvoices((prev) => (page === 1 ? list : [...prev, ...list]));
        setInvoiceMeta({ page, hasMore: Boolean(data?.hasMore) });
      } catch (err) {
        showFinanceError(err, "A listagem de faturas");
      } finally {
        setInvoicesLoading(false);
      }
    },
    [base, companyId, invoiceParams, historicalFilter]
  );

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const results = await allSettled([
      api.get(`${base}/summary`),
      api.get(`${base}/payments`, { params: { limit: PAGE_SIZE } }),
      api.get(`${base}/renewals`),
      api.get(`${base}/events`),
      api.get(`${base}/reconciliation`),
      api.get(`${base}/invoices`, { params: { status: "open", limit: 100 } }),
      api.get("/saas/finance/historical-review", {
        // "unresolved" = pendentes + mantidas pendentes (mesmo conjunto do contador do resumo).
        params: { companyId, state: "unresolved", limit: 100 },
      }),
    ]);
    const sum = settled(results[0], (d) => d, null);
    const pay = settled(results[1], (d) => d?.payments, []);
    const ren = settled(results[2], (d) => d?.renewals, []);
    const ev = settled(results[3], (d) => d?.events, []);
    const rec = settled(results[4], (d) => d?.items, []);
    const open = settled(results[5], (d) => d?.invoices, []);
    const hist = settled(results[6], (d) => d?.items, []);

    setSummary(sum.data);
    setPayments(pay.data);
    setRenewals(ren.data);
    setEvents(ev.data);
    setReconciliation(rec.data);
    setOpenInvoices((open.data || []).filter(isOpen));
    setHistoricalItems(Array.isArray(hist.data) ? hist.data : []);
    setUnavailable({
      summary: sum.unavailable,
      payments: pay.unavailable,
      renewals: ren.unavailable,
      events: ev.unavailable,
      reconciliation: rec.unavailable,
      historical: hist.unavailable,
    });
    const firstError = [sum, pay, ren, ev, rec, open, hist].find((r) => r.error);
    if (firstError) showFinanceError(firstError.error);
    setLoading(false);
  }, [base, companyId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadInvoices(1);
  }, [loadInvoices]);

  const reloadSubscription = sub?.reload;
  const refresh = useCallback(async () => {
    setTimelineKey((k) => k + 1);
    await Promise.all([
      loadAll(),
      loadInvoices(1),
      reloadSubscription ? reloadSubscription() : Promise.resolve(),
    ]);
  }, [loadAll, loadInvoices, reloadSubscription]);

  const notifyCompanyChanged = useCallback(() => {
    if (onCompanyChanged) onCompanyChanged();
  }, [onCompanyChanged]);

  // ---------- dados derivados ----------
  const totals = summary?.totals || {};
  const planName = summary?.plan?.name || summary?.planName || null;
  const nextDueDate =
    subData?.currentDueDate || summary?.nextDueDate || summary?.dueDate || company?.dueDate || null;
  const contracted =
    subData?.contractedValue ?? summary?.contractedValue ?? company?.contractedPlanValue ?? null;
  const recurrence = summary?.recurrence || company?.recurrence;
  const billed = totals.billed ?? totals.invoiced;

  const renewCompany = useMemo(
    () => ({
      id: companyId,
      name: company?.name || summary?.companyName,
      dueDate: subData?.currentDueDate ?? company?.dueDate ?? summary?.dueDate,
      recurrence: company?.recurrence ?? summary?.recurrence,
    }),
    [companyId, company, summary, subData]
  );
  const paymentCompany = useMemo(
    () => ({
      id: companyId,
      name: company?.name || summary?.companyName,
      dueDate: company?.dueDate ?? summary?.dueDate,
    }),
    [companyId, company, summary]
  );

  const historicalByInvoice = useMemo(() => {
    const map = new Map();
    historicalItems.forEach((it) => {
      const inv = it?.invoice;
      if (inv?.id != null && isUnresolvedHistorical(it)) map.set(Number(inv.id), it);
    });
    return map;
  }, [historicalItems]);
  const isHistoricalCandidate = (i) =>
    isOpen(i) && (Boolean(i.isHistoricalCandidate) || historicalByInvoice.has(Number(i.id)));

  const displayedInvoices = historicalFilter
    ? historicalItems
        .filter(isUnresolvedHistorical)
        .map((it) => ({
          ...it.invoice,
          isHistoricalCandidate: true,
          signals: it.signals,
          historicalReview: it.review || null,
        }))
    : invoices;
  const hasLegacy = displayedInvoices.some((i) => i.isLegacy);
  const openReconCount = reconciliation.length;
  const historicalCount = historicalByInvoice.size;
  const keptPendingReview = (i) => {
    if (!isHistoricalCandidate(i)) return null;
    const review = i.historicalReview || historicalByInvoice.get(Number(i.id))?.review || null;
    return review?.decision === "keep_pending" ? review : null;
  };

  if (!companyId) {
    return (
      <AppSectionCard>
        <AppEmptyState title="Salve a empresa para ver o financeiro." />
      </AppSectionCard>
    );
  }

  const openPayment = (mode, invoiceId) => setPaymentDialog({ mode, invoiceId });
  const openHistorical = (i) =>
    setHistoricalTarget({
      invoice: i,
      signals: i.signals || historicalByInvoice.get(Number(i.id))?.signals || null,
    });
  const afterChange = () => {
    refresh();
    notifyCompanyChanged();
  };

  const handleCenterAction = (name) => {
    const firstOpen = subData?.nextExpectedCharge?.invoiceId || openInvoices[0]?.id;
    if (name === "payment") openPayment("paid_offline", firstOpen);
    else if (name === "courtesy") openPayment("courtesy", firstOpen);
    else if (name === "invoice") setInvoiceForm({});
    else if (name === "renew") setRenewOpen(true);
    else if (name === "adjust") setAdjustOpen(true);
  };

  const handlePendency = (name) => {
    if (name === "recon") {
      setTab("recon");
    } else if (name === "historical") {
      setTab("invoices");
      setStatusFilter("historical");
    } else {
      setTab("invoices");
      setStatusFilter("open");
    }
  };
  const openGenerateInvoice = () => {
    setPaymentDialog(null);
    setInvoiceForm({});
  };

  // ---------- colunas ----------
  const invoiceColumns = [
    {
      key: "id",
      label: "Fatura",
      render: (i) => (
        <Box display="flex" alignItems="center" style={{ gap: 6 }} flexWrap="wrap">
          #{i.id} {i.isLegacy ? <LegacyChip /> : null}
          {isHistoricalCandidate(i) ? <HistoricalCandidateChip /> : null}
          {keptPendingReview(i) ? (
            <Typography
              variant="caption"
              color="textSecondary"
              display="block"
              style={{ width: "100%" }}
              data-testid={`kept-pending-${i.id}`}
            >
              revisada — mantida pendente
              {keptPendingReview(i).note ? ` · “${keptPendingReview(i).note}”` : ""}
            </Typography>
          ) : null}
        </Box>
      ),
    },
    { key: "detail", label: "Descrição", render: (i) => i.detail || "—" },
    { key: "competence", label: "Competência", render: (i) => formatCompetence(i.competence) },
    { key: "dueDate", label: "Vencimento", render: (i) => formatDate(i.dueDate) },
    { key: "value", label: "Valor", render: (i) => formatBrl(i.value) },
    { key: "status", label: "Situação", render: (i) => <InvoiceStatusChip invoice={i} /> },
    {
      key: "sync",
      label: "Situação na Efí",
      render: (i) => <SyncStatusChip status={i.gatewaySyncStatus} />,
    },
  ];

  const invoiceActions = (i) => {
    const open = isOpen(i);
    const editable = open && !Number(i.paymentsCount);
    const historical = isHistoricalCandidate(i);
    return (
      <span className={classes.rowActions}>
        <Button size="small" onClick={() => setDetailId(i.id)}>
          Detalhe
        </Button>
        {historical ? (
          <Button size="small" color="secondary" variant="outlined" onClick={() => openHistorical(i)}>
            Regularizar
          </Button>
        ) : null}
        {open ? (
          <Button size="small" color="primary" onClick={() => openPayment("paid_offline", i.id)}>
            Registrar pagamento
          </Button>
        ) : null}
        {editable ? (
          <Button size="small" onClick={() => setInvoiceForm({ invoice: i })}>
            Editar
          </Button>
        ) : null}
        {open ? (
          <Button size="small" style={{ color: "inherit", opacity: 0.8 }} onClick={() => setCancelTarget(i)}>
            Cancelar
          </Button>
        ) : null}
      </span>
    );
  };

  const paymentColumns = [
    {
      key: "paidAt",
      label: "Data",
      render: (p) => formatPaidAt(p.paidAt, p.paidAtUnknown || p.metadata?.paidAtUnknown),
    },
    {
      key: "kind",
      label: "Tipo",
      render: (p) => <PaymentKindChip source={p.source} countsAsRevenue={p.countsAsRevenue} />,
    },
    { key: "invoiceId", label: "Fatura", render: (p) => (p.invoiceId ? `#${p.invoiceId}` : "—") },
    { key: "amount", label: "Valor", render: (p) => formatBrl(p.amount) },
    { key: "method", label: "Forma", render: (p) => methodLabel(p.method) },
    { key: "source", label: "Origem", render: (p) => sourceLabel(p.source) },
    {
      key: "revenue",
      label: "Receita",
      render: (p) => (p.countsAsRevenue ? "Sim" : "Não"),
    },
    {
      key: "sync",
      label: "Situação na Efí",
      render: (p) => <SyncStatusChip status={p.gatewaySyncStatus} />,
    },
  ];

  const renewalColumns = [
    { key: "createdAt", label: "Quando", render: (r) => formatDateTime(r.createdAt) },
    {
      key: "reason",
      label: "Origem",
      render: (r) =>
        String(r.reason || "").toLowerCase() === "manual_renew" ? (
          <ToneChip
            tone="warning"
            label="Renovação administrativa"
            tooltip="Feita por um administrador, sem pagamento. Não conta como receita."
          />
        ) : (
          renewalReasonLabel(r.reason)
        ),
    },
    { key: "prev", label: "Vencimento anterior", render: (r) => formatDate(r.previousDueDate) },
    { key: "next", label: "Novo vencimento", render: (r) => formatDate(r.newDueDate) },
    {
      key: "months",
      label: "Período",
      render: (r) => recurrenceLabel(r.recurrence, r.monthsAdded),
    },
    { key: "invoiceId", label: "Fatura", render: (r) => (r.invoiceId ? `#${r.invoiceId}` : "—") },
  ];

  const eventColumns = [
    { key: "createdAt", label: "Quando", render: (e) => formatDateTime(e.createdAt) },
    { key: "eventType", label: "Evento", render: (e) => eventLabel(e.eventType) },
    { key: "invoiceId", label: "Fatura", render: (e) => (e.invoiceId ? `#${e.invoiceId}` : "—") },
    {
      key: "reason",
      label: "Justificativa",
      render: (e) => e.reason || e.payload?.reason || e.metadata?.reason || "—",
    },
  ];

  const reconColumns = [
    { key: "createdAt", label: "Desde", render: (r) => formatDateTime(r.createdAt) },
    { key: "kind", label: "Pendência", render: (r) => reconKindLabel(r.kind) },
    { key: "invoiceId", label: "Fatura", render: (r) => (r.invoiceId ? `#${r.invoiceId}` : "—") },
    { key: "status", label: "Situação", render: (r) => reconStatusLabel(r.status) },
    { key: "retryCount", label: "Tentativas", render: (r) => r.retryCount ?? 0 },
  ];

  const unavailableNotice = (key) =>
    unavailable[key] ? (
      <Alert severity="info" className={classes.mb}>
        Esta seção ainda não está disponível neste servidor.
      </Alert>
    ) : null;

  return (
    <AppSectionCard id="company-finance-section">
      <Box className={classes.header}>
        <Box>
          <Typography variant="h6" component="h2">
            Financeiro
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Histórico exclusivo desta empresa. Cortesia e renovação administrativa não
            entram como receita recebida.
          </Typography>
        </Box>
        <Box className={classes.actions}>
          <Tooltip title="Atualizar">
            <span>
              <Button onClick={refresh} disabled={loading} aria-label="Atualizar">
                <RefreshIcon fontSize="small" />
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <SubscriptionCenter
        state={sub}
        onAction={handleCenterAction}
        onPendency={handlePendency}
        onReload={reloadSubscription}
      />

      {loading && !summary ? (
        <AppLoadingState />
      ) : (
        <>
          {unavailableNotice("summary")}
          <Box className={classes.kpiGrid}>
            {subData ? null : (
              <>
                <Kpi
                  label="Plano"
                  value={planName || "—"}
                  hint={recurrence ? recurrenceLabel(recurrence) : null}
                />
                <Kpi label="Valor contratado" value={formatBrl(contracted)} />
                <Kpi label="Próximo vencimento" value={formatDate(nextDueDate)} />
              </>
            )}
            <Kpi label="Total faturado" value={formatBrl(billed)} />
            <Kpi label="Recebido" value={formatBrl(totals.received)} hint="Somente pagamentos que contam como receita" />
            <Kpi label="Em aberto" value={formatBrl(totals.open)} />
            <Kpi label="Vencido" value={formatBrl(totals.overdue)} alert={Number(totals.overdue) > 0} />
            {totals.courtesy !== undefined ? (
              <Kpi label="Cortesias" value={formatBrl(totals.courtesy)} hint="Não é receita" />
            ) : null}
          </Box>

          <AppTabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            indicatorColor="primary"
            textColor="primary"
            className={classes.tabs}
          >
            <Tab value="invoices" label="Cobranças" />
            <Tab value="timeline" label="Linha do tempo" />
            <Tab value="payments" label="Pagamentos" />
            <Tab value="renewals" label="Renovações" />
            <Tab value="events" label="Auditoria" />
            <Tab
              value="recon"
              label={openReconCount ? `Conciliação (${openReconCount})` : "Conciliação"}
            />
          </AppTabs>

          {tab === "invoices" && (
            <>
              <Box className={classes.filters}>
                <TextField
                  select
                  size="small"
                  variant="outlined"
                  label="Situação"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={classes.filterField}
                >
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="open">Abertas</MenuItem>
                  <MenuItem value="paid">Pagas</MenuItem>
                  <MenuItem value="cancelled">Canceladas</MenuItem>
                  <MenuItem value="historical">
                    Históricas não resolvidas{historicalCount ? ` (${historicalCount})` : ""}
                  </MenuItem>
                </TextField>
                <TextField
                  select
                  size="small"
                  variant="outlined"
                  label="Origem"
                  value={legacyFilter}
                  onChange={(e) => setLegacyFilter(e.target.value)}
                  className={classes.filterField}
                  disabled={historicalFilter}
                >
                  <MenuItem value="">Todas</MenuItem>
                  <MenuItem value="false">Novas</MenuItem>
                  <MenuItem value="true">Legado</MenuItem>
                </TextField>
              </Box>
              {hasLegacy ? (
                <Alert severity="info" className={classes.mb}>
                  Faturas marcadas como <strong>Legado</strong> foram criadas antes da
                  reorganização do faturamento e não têm ciclo identificado com segurança.
                  Revise cada uma individualmente — nenhum cancelamento em massa é feito
                  automaticamente.
                </Alert>
              ) : null}
              {historicalFilter ? (
                <Alert severity="info" className={classes.mb}>
                  Faturas antigas sem pagamento registrado. Use <strong>Regularizar</strong> para
                  dizer o que aconteceu com cada uma (pagamento antigo, indevida, cortesia ou ainda
                  devida). Faturas já revisadas e mantidas pendentes também aparecem aqui. Nenhuma
                  delas renova a assinatura.
                  {unavailable.historical
                    ? " A revisão histórica ainda não está disponível neste servidor."
                    : ""}
                </Alert>
              ) : null}
              {invoicesLoading && !displayedInvoices.length ? (
                <AppLoadingState />
              ) : (
                <FinanceTable
                  columns={invoiceColumns}
                  rows={displayedInvoices}
                  actions={invoiceActions}
                  rowClassName={(i) =>
                    needsAttention(i.gatewaySyncStatus)
                      ? classes.rowAttention
                      : isHistoricalCandidate(i)
                      ? classes.rowHistorical
                      : undefined
                  }
                  emptyTitle={historicalFilter ? "Nenhuma fatura antiga para revisar" : "Nenhuma fatura"}
                  emptyDescription={
                    historicalFilter
                      ? "Todas as faturas antigas já foram resolvidas."
                      : statusFilter || legacyFilter
                      ? "Nenhuma fatura com os filtros selecionados."
                      : "Gere uma fatura para começar a registrar cobranças."
                  }
                />
              )}
              {invoiceMeta.hasMore && !historicalFilter ? (
                <Box display="flex" justifyContent="center" mt={2}>
                  <AppSecondaryButton
                    loading={invoicesLoading}
                    onClick={() => loadInvoices(invoiceMeta.page + 1)}
                  >
                    Carregar mais
                  </AppSecondaryButton>
                </Box>
              ) : null}
            </>
          )}

          {tab === "timeline" && (
            <CompanyTimeline
              companyId={companyId}
              reloadKey={timelineKey}
              onOpenInvoice={(id) => setDetailId(id)}
            />
          )}

          {tab === "payments" && (
            <>
              {unavailableNotice("payments")}
              <FinanceTable columns={paymentColumns} rows={payments} emptyTitle="Nenhum pagamento" />
            </>
          )}

          {tab === "renewals" && (
            <>
              {unavailableNotice("renewals")}
              <FinanceTable columns={renewalColumns} rows={renewals} emptyTitle="Nenhuma renovação" />
            </>
          )}

          {tab === "events" && (
            <>
              {unavailableNotice("events")}
              <FinanceTable columns={eventColumns} rows={events} emptyTitle="Nenhum evento registrado" />
            </>
          )}

          {tab === "recon" && (
            <>
              {unavailableNotice("reconciliation")}
              <Typography variant="body2" color="textSecondary" paragraph>
                Pendências entre os registros deste sistema e a Efí que precisam de
                acompanhamento.
              </Typography>
              <FinanceTable
                columns={reconColumns}
                rows={reconciliation}
                emptyTitle="Sem pendências de conciliação"
              />
            </>
          )}
        </>
      )}

      <ManualPaymentDialog
        open={Boolean(paymentDialog)}
        mode={paymentDialog?.mode}
        companyId={companyId}
        company={paymentCompany}
        openInvoices={openInvoices}
        initialInvoiceId={paymentDialog?.invoiceId}
        onClose={() => setPaymentDialog(null)}
        onDone={afterChange}
        onGenerateInvoice={openGenerateInvoice}
      />

      <InvoiceFormDialog
        open={Boolean(invoiceForm)}
        companyId={companyId}
        invoice={invoiceForm?.invoice}
        defaultValue={contracted}
        defaultDueDate={nextDueDate}
        onClose={() => setInvoiceForm(null)}
        onSaved={refresh}
      />

      <CancelInvoiceDialog
        open={Boolean(cancelTarget)}
        companyId={companyId}
        invoice={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={refresh}
      />

      <InvoiceDetailDialog
        open={Boolean(detailId)}
        companyId={companyId}
        invoiceId={detailId}
        onClose={() => setDetailId(null)}
      />

      <RenewSubscriptionDialog
        open={renewOpen}
        company={renewCompany}
        onClose={() => setRenewOpen(false)}
        onRenewed={afterChange}
      />

      <AdjustDueDateDialog
        open={adjustOpen}
        companyId={companyId}
        companyName={company?.name || subData?.company?.name}
        currentDueDate={subData?.currentDueDate ?? company?.dueDate ?? null}
        onClose={() => setAdjustOpen(false)}
        onDone={afterChange}
      />

      <HistoricalReviewDialog
        open={Boolean(historicalTarget)}
        companyId={companyId}
        invoice={historicalTarget?.invoice}
        signals={historicalTarget?.signals}
        onClose={() => setHistoricalTarget(null)}
        onDone={afterChange}
      />
    </AppSectionCard>
  );
}
