import React, { useState, useEffect, useMemo, useContext, useCallback } from "react";
import { alpha, makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import SearchIcon from "@material-ui/icons/Search";
import Alert from "@material-ui/lab/Alert";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Grid from "@material-ui/core/Grid";
import Hidden from "@material-ui/core/Hidden";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import moment from "moment";

import MainContainer from "../../components/MainContainer";
import SubscriptionModal from "../../components/SubscriptionModal";
import {
  AppPageHeader,
  AppSectionCard,
  AppActionBar,
  AppPrimaryButton,
  AppEmptyState,
  AppLoadingState,
} from "../../ui";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  pageRoot: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    flex: 1,
    minHeight: 0,
  },
  summaryCard: {
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    height: "100%",
  },
  summaryLabel: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
  },
  summaryValue: {
    fontWeight: 700,
    fontSize: "1.25rem",
    marginTop: theme.spacing(0.5),
  },
  mobileCard: {
    marginBottom: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  rowOverdue: {
    backgroundColor: alpha(theme.palette.error.main, 0.06),
  },
  rowPaid: {
    backgroundColor: alpha(theme.palette.success.main, 0.06),
  },
  searchField: {
    flex: "1 1 220px",
    minWidth: 180,
    maxWidth: 420,
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

function getInvoiceVisualStatus(record) {
  const paid = String(record.status).toLowerCase() === "paid";
  if (paid) return "paid";
  if (String(record.status).toLowerCase() === "cancelled") return "cancelled";
  const vencimento = moment(record.dueDate);
  const hoje = moment().startOf("day");
  if (vencimento.isBefore(hoje, "day")) return "overdue";
  return "open";
}

const Financeiro = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParam, setSearchParam] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, sumRes] = await Promise.all([
        api.get("/invoices/all"),
        api.get("/finance/summary").catch(() => ({ data: null })),
      ]);
      setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
      setSummary(sumRes.data);
    } catch (e) {
      setError(e);
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = searchParam.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        String(inv.id).includes(q) ||
        String(inv.detail || "")
          .toLowerCase()
          .includes(q)
    );
  }, [invoices, searchParam]);

  const handlePay = (invoice) => {
    setSelectedInvoice(invoice);
    setContactModalOpen(true);
  };

  const delinquent = user?.finance?.delinquent;

  const renderStatusChip = (inv) => {
    const st = getInvoiceVisualStatus(inv);
    if (st === "paid") return <Chip size="small" color="primary" label="Paga" />;
    if (st === "overdue") return <Chip size="small" color="secondary" label="Vencida" />;
    if (st === "cancelled") return <Chip size="small" label="Cancelada" />;
    return <Chip size="small" variant="outlined" label="Pendente" />;
  };

  return (
    <MainContainer>
      <Box className={classes.pageRoot}>
        <AppPageHeader
          title={i18n.t("invoices.title") || "Financeiro"}
          subtitle="Assinatura, faturas e pagamentos da sua empresa."
        />

        {delinquent ? (
          <Alert severity="warning">
            Sua assinatura está em atraso. Regularize o pagamento das faturas
            pendentes para evitar bloqueios.
          </Alert>
        ) : null}

        {error ? (
          <Alert severity="error" action={
            <AppPrimaryButton onClick={fetchData}>Tentar novamente</AppPrimaryButton>
          }>
            Não foi possível carregar o financeiro.
          </Alert>
        ) : null}

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.summaryCard} elevation={0}>
              <CardContent>
                <Typography className={classes.summaryLabel}>Plano</Typography>
                <Typography className={classes.summaryValue}>
                  {summary?.planName || user?.company?.plan?.name || "—"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.summaryCard} elevation={0}>
              <CardContent>
                <Typography className={classes.summaryLabel}>Valor</Typography>
                <Typography className={classes.summaryValue}>
                  {formatBrl(summary?.contractedValue)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.summaryCard} elevation={0}>
              <CardContent>
                <Typography className={classes.summaryLabel}>
                  Próximo vencimento
                </Typography>
                <Typography className={classes.summaryValue}>
                  {summary?.dueDate
                    ? moment(summary.dueDate).format("DD/MM/YYYY")
                    : "—"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card className={classes.summaryCard} elevation={0}>
              <CardContent>
                <Typography className={classes.summaryLabel}>Em aberto</Typography>
                <Typography className={classes.summaryValue}>
                  {formatBrl(summary?.totals?.open)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <AppSectionCard>
          <AppActionBar>
            <TextField
              className={classes.searchField}
              placeholder="Buscar fatura"
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="disabled" />
                  </InputAdornment>
                ),
              }}
            />
          </AppActionBar>

          {loading ? (
            <AppLoadingState />
          ) : !filtered.length ? (
            <AppEmptyState
              title={i18n.t("invoices.empty") || "Nenhuma fatura"}
              description="Quando houver cobranças do seu plano, elas aparecerão aqui."
            />
          ) : (
            <>
              <Hidden smUp>
                {filtered.map((inv) => {
                  const st = getInvoiceVisualStatus(inv);
                  return (
                    <Card key={inv.id} className={classes.mobileCard} elevation={0}>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2">#{inv.id}</Typography>
                          {renderStatusChip(inv)}
                        </Box>
                        <Typography variant="body2" color="textSecondary">
                          {inv.detail}
                        </Typography>
                        <Typography variant="h6">{formatBrl(inv.value)}</Typography>
                        <Typography variant="caption" display="block">
                          Vencimento:{" "}
                          {inv.dueDate
                            ? moment(inv.dueDate).format("DD/MM/YYYY")
                            : "—"}
                        </Typography>
                        {st !== "paid" && st !== "cancelled" ? (
                          <Box mt={1}>
                            <AppPrimaryButton onClick={() => handlePay(inv)}>
                              Pagar
                            </AppPrimaryButton>
                          </Box>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </Hidden>

              <Hidden xsDown>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Detalhe</TableCell>
                      <TableCell>Vencimento</TableCell>
                      <TableCell>Valor</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((inv) => {
                      const st = getInvoiceVisualStatus(inv);
                      return (
                        <TableRow
                          key={inv.id}
                          className={
                            st === "paid"
                              ? classes.rowPaid
                              : st === "overdue"
                              ? classes.rowOverdue
                              : undefined
                          }
                        >
                          <TableCell>{inv.id}</TableCell>
                          <TableCell>{inv.detail}</TableCell>
                          <TableCell>
                            {inv.dueDate
                              ? moment(inv.dueDate).format("DD/MM/YYYY")
                              : "—"}
                          </TableCell>
                          <TableCell>{formatBrl(inv.value)}</TableCell>
                          <TableCell>{renderStatusChip(inv)}</TableCell>
                          <TableCell align="right">
                            {st !== "paid" && st !== "cancelled" ? (
                              <AppPrimaryButton onClick={() => handlePay(inv)}>
                                Pagar
                              </AppPrimaryButton>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Hidden>
            </>
          )}
        </AppSectionCard>
      </Box>

      <SubscriptionModal
        open={contactModalOpen}
        onClose={() => {
          setContactModalOpen(false);
          setSelectedInvoice(null);
          fetchData();
        }}
        Invoice={selectedInvoice}
      />
    </MainContainer>
  );
};

export default Financeiro;
