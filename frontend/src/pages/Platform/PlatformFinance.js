import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Chip from "@material-ui/core/Chip";
import { makeStyles } from "@material-ui/core/styles";
import moment from "moment";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import {
  AppPageHeader,
  AppSectionCard,
  AppActionBar,
  AppSecondaryButton,
  AppEmptyState,
  AppLoadingState,
} from "../../ui";
import AppTableContainer from "../../ui/components/AppTableContainer";
import {
  formatPaidAt,
  sourceLabel,
  methodLabel,
} from "../../components/CompanyFinanceSection/financeFormat";

const useStyles = makeStyles((theme) => ({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    width: "100%",
  },
  kpiCard: {
    height: "100%",
    minHeight: 100,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  kpiValue: {
    fontWeight: 700,
    fontSize: "1.5rem",
    marginTop: theme.spacing(0.5),
  },
  kpiLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
  filters: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    alignItems: "flex-end",
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

function Kpi({ label, value, hint }) {
  const classes = useStyles();
  return (
    <Box className={classes.kpiCard}>
      <Typography className={classes.kpiLabel}>{label}</Typography>
      <Typography className={classes.kpiValue}>{value}</Typography>
      {hint ? (
        <Typography variant="caption" color="textSecondary">
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

export default function PlatformFinance() {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tab, setTab] = useState("invoices");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [historicalPending, setHistoricalPending] = useState(null);

  // Atalho para a fila de revisão de faturas históricas (Fase 8.4-F). 404 = recurso ainda
  // não disponível no servidor: o atalho continua visível, sem contador.
  useEffect(() => {
    let alive = true;
    api
      .get("/saas/finance/historical-review/summary")
      .then(({ data }) => {
        const total = Number(data?.total);
        if (alive) setHistoricalPending(Number.isFinite(total) ? total : null);
      })
      .catch(() => {
        if (alive) setHistoricalPending(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, inv, pay] = await Promise.all([
        api.get("/saas/finance/kpis", { params: { from, to } }),
        api.get("/saas/finance/invoices", {
          params: { status: status || undefined, searchParam: search || undefined },
        }),
        api.get("/saas/finance/payments"),
      ]);
      setKpis(k.data);
      setInvoices(inv.data?.invoices || []);
      setPayments(pay.data?.payments || []);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, [from, to, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = async (kind) => {
    try {
      const { data } = await api.get("/saas/finance/export", {
        params: { kind },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = kind === "payments" ? "saas-payments.csv" : "saas-invoices.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <MainContainer>
      <Box className={classes.page}>
        <AppPageHeader
          title={i18n.t("platform.finance.title") || "Financeiro"}
          subtitle="KPIs a partir de faturas e pagamentos confirmados (cortesia não conta como receita)."
        />

        <AppActionBar>
          <Box className={classes.filters}>
            <TextField
              label="De"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <TextField
              label="Até"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <TextField
              label="Buscar fatura"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <TextField
              select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ minWidth: 140 }}
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="open">Aberta</MenuItem>
              <MenuItem value="paid">Paga</MenuItem>
              <MenuItem value="cancelled">Cancelada</MenuItem>
            </TextField>
            <AppSecondaryButton onClick={load}>Atualizar</AppSecondaryButton>
            <AppSecondaryButton onClick={() => exportCsv("invoices")}>
              Exportar faturas
            </AppSecondaryButton>
            <AppSecondaryButton onClick={() => exportCsv("payments")}>
              Exportar pagamentos
            </AppSecondaryButton>
          </Box>
        </AppActionBar>

        <AppSectionCard>
          <Box
            display="flex"
            flexWrap="wrap"
            alignItems="center"
            justifyContent="space-between"
            gridGap={12}
          >
            <Box maxWidth={640}>
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                Revisão de faturas históricas
                {historicalPending != null ? (
                  <Chip
                    size="small"
                    color={historicalPending > 0 ? "secondary" : "default"}
                    label={`${historicalPending} não resolvida${historicalPending === 1 ? "" : "s"}`}
                    style={{ marginLeft: 8 }}
                    data-testid="historical-pending-chip"
                  />
                ) : null}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Faturas antigas que precisam de uma decisão (pagas por fora, cobradas por engano ou cortesia)
                antes de cobrar o cliente.
              </Typography>
            </Box>
            <AppSecondaryButton component={Link} to="/saas/finance/historical-review?state=unresolved">
              Abrir fila de revisão
            </AppSecondaryButton>
          </Box>
        </AppSectionCard>

        {loading && !kpis ? (
          <AppLoadingState />
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={6} sm={4} md={2}>
              <Kpi label="MRR" value={formatBrl(kpis?.mrr)} hint="Contratado normalizado/mês" />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Kpi label="ARR" value={formatBrl(kpis?.arr)} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Kpi label="Faturado" value={formatBrl(kpis?.invoiced)} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Kpi
                label="Recebido"
                value={formatBrl(kpis?.received)}
                hint={
                  <>
                    Só o que conta como receita
                    {Number(kpis?.receivedDateUnknown) > 0 &&
                    (typeof kpis?.receivedIncludesDateUnknown === "boolean"
                      ? !kpis.receivedIncludesDateUnknown
                      : Boolean(from || to)) ? (
                      <span style={{ display: "block" }} data-testid="received-date-unknown-note">
                        + {formatBrl(kpis.receivedDateUnknown)} sem data informada, fora do período
                      </span>
                    ) : null}
                  </>
                }
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Kpi label="A receber" value={formatBrl(kpis?.open)} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Kpi
                label="Inadimplência"
                value={formatBrl(kpis?.overdueAmount)}
                hint={`${kpis?.delinquentCompanies || 0} empresas`}
              />
            </Grid>
          </Grid>
        )}

        {kpis?.planDistribution?.length ? (
          <AppSectionCard>
            <Typography variant="subtitle1" gutterBottom>
              Distribuição por planos (MRR)
            </Typography>
            <Box display="flex" flexWrap="wrap" gridGap={8}>
              {kpis.planDistribution.map((p) => (
                <Chip
                  key={p.planId || p.name}
                  label={`${p.name}: ${p.count} · ${formatBrl(p.mrr)}`}
                />
              ))}
            </Box>
          </AppSectionCard>
        ) : null}

        {kpis?.evolution?.length ? (
          <AppSectionCard>
            <Typography variant="subtitle1" gutterBottom>
              Evolução (6 meses)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mês</TableCell>
                  <TableCell>Faturado</TableCell>
                  <TableCell>Recebido</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {kpis.evolution.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell>{row.month}</TableCell>
                    <TableCell>{formatBrl(row.invoiced)}</TableCell>
                    <TableCell>{formatBrl(row.received)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AppSectionCard>
        ) : null}

        <AppSectionCard>
          <Box display="flex" gridGap={8} marginBottom={2}>
            <AppSecondaryButton onClick={() => setTab("invoices")}>
              Faturas
            </AppSecondaryButton>
            <AppSecondaryButton onClick={() => setTab("payments")}>
              Pagamentos
            </AppSecondaryButton>
          </Box>

          <AppTableContainer>
            {tab === "invoices" ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Detalhe</TableCell>
                    <TableCell>Competência</TableCell>
                    <TableCell>Vencimento</TableCell>
                    <TableCell>Valor</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Sync</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.id}</TableCell>
                      <TableCell>{inv.company?.name || inv.companyId}</TableCell>
                      <TableCell>{inv.detail}</TableCell>
                      <TableCell>{inv.competence || "—"}</TableCell>
                      <TableCell>
                        {inv.dueDate
                          ? moment(inv.dueDate).format("DD/MM/YYYY")
                          : "—"}
                      </TableCell>
                      <TableCell>{formatBrl(inv.value)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={inv.status} />
                      </TableCell>
                      <TableCell>{inv.gatewaySyncStatus || "—"}</TableCell>
                      <TableCell>
                        <AppSecondaryButton
                          component={Link}
                          to={`/saas/companies/${inv.companyId}/financeiro`}
                        >
                          Abrir
                        </AppSecondaryButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!invoices.length && !loading ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <AppEmptyState title="Nenhuma fatura no período/filtro" />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Valor</TableCell>
                    <TableCell>Método</TableCell>
                    <TableCell>Origem</TableCell>
                    <TableCell>Receita</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatPaidAt(p.paidAt, p.paidAtUnknown)}</TableCell>
                      <TableCell>{p.company?.name || p.companyId}</TableCell>
                      <TableCell>{formatBrl(p.amount)}</TableCell>
                      <TableCell>{methodLabel(p.method)}</TableCell>
                      <TableCell>{sourceLabel(p.source)}</TableCell>
                      <TableCell>{p.countsAsRevenue ? "Sim" : "Não"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </AppTableContainer>
        </AppSectionCard>
      </Box>
    </MainContainer>
  );
}
