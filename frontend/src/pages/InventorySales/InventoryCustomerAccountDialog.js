import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import { format } from "date-fns";
import { toast } from "react-toastify";

import {
  AppDialog,
  AppDialogActions,
  AppDialogContent,
  AppDialogTitle,
  AppPrimaryButton,
  AppSecondaryButton,
  AppTableContainer,
} from "../../ui";
import {
  activateInventoryCustomer,
  deactivateInventoryCustomer,
  getInventoryCustomerAccount,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import {
  formatInventoryCustomerDocument,
  formatInventoryCustomerPhone,
} from "./inventoryCustomerMasks";
import { formatReceivablePaymentHistoryLine } from "./receivablePaymentDisplay";

const useStyles = makeStyles((theme) => ({
  statCard: {
    padding: theme.spacing(1.5),
    borderRadius: 12,
    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
    height: "100%",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
  statValue: {
    fontWeight: 700,
    fontSize: "1.05rem",
    marginTop: 4,
  },
  section: {
    marginTop: theme.spacing(2),
  },
}));

function Stat({ label, value }) {
  const classes = useStyles();
  return (
    <Paper className={classes.statCard} elevation={0}>
      <Typography className={classes.statLabel}>{label}</Typography>
      <Typography className={classes.statValue}>{value}</Typography>
    </Paper>
  );
}

function formatDue(value) {
  if (!value) return "—";
  try {
    const [y, m, d] = String(value).split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
    return format(new Date(value), "dd/MM/yyyy");
  } catch {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  } catch {
    return String(value);
  }
}

export default function InventoryCustomerAccountDialog({
  open,
  customerId,
  onClose,
  onChanged,
  onEdit,
  onReceive,
  canManageCustomers,
  canViewFinancials,
}) {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const { data } = await getInventoryCustomerAccount(customerId);
      setAccount(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const customer = account?.customer;
  const credit = account?.credit;
  const installments = Array.isArray(account?.installments)
    ? account.installments
    : [];
  const sales = Array.isArray(account?.sales) ? account.sales : [];
  const payments = Array.isArray(account?.payments) ? account.payments : [];
  const overrides = Array.isArray(account?.overrides) ? account.overrides : [];

  const toggleActive = async () => {
    if (!customer?.id || !canManageCustomers) return;
    setBusy(true);
    try {
      if (customer.isActive) {
        await deactivateInventoryCustomer(customer.id);
        toast.success(i18n.t("inventorySales.customers.toasts.deactivated"));
      } else {
        await activateInventoryCustomer(customer.id);
        toast.success(i18n.t("inventorySales.customers.toasts.activated"));
      }
      await load();
      if (onChanged) onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      data-testid="inventory-customer-account-dialog"
    >
      <AppDialogTitle>
        {i18n.t("inventorySales.customers.account.title")}
        {customer?.name ? ` — ${customer.name}` : ""}
      </AppDialogTitle>
      <AppDialogContent>
        {loading || !customer ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <Box display="flex" alignItems="center" style={{ gap: 8 }} mb={1}>
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                {customer.name}
              </Typography>
              <Chip
                size="small"
                label={
                  customer.isActive
                    ? i18n.t("inventorySales.common.active")
                    : i18n.t("inventorySales.common.inactive")
                }
                color={customer.isActive ? "primary" : "default"}
              />
            </Box>
            {customer.document || customer.phone ? (
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {[
                  customer.document
                    ? formatInventoryCustomerDocument(customer.document)
                    : null,
                  customer.phone
                    ? formatInventoryCustomerPhone(customer.phone)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
            ) : null}

            {canViewFinancials && credit ? (
              <Grid container spacing={1} className={classes.section}>
                <Grid item xs={6} sm={4} md={2}>
                  <Stat
                    label={i18n.t(
                      "inventorySales.customers.account.creditLimit"
                    )}
                    value={formatCurrencyBRL(credit.creditLimit)}
                  />
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Stat
                    label={i18n.t(
                      "inventorySales.customers.account.creditUsed"
                    )}
                    value={formatCurrencyBRL(credit.creditUsed)}
                  />
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Stat
                    label={i18n.t(
                      "inventorySales.customers.account.creditAvailable"
                    )}
                    value={formatCurrencyBRL(credit.creditAvailable)}
                  />
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Stat
                    label={i18n.t(
                      "inventorySales.customers.account.openAmount"
                    )}
                    value={formatCurrencyBRL(credit.openAmount)}
                  />
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Stat
                    label={i18n.t(
                      "inventorySales.customers.account.overdueAmount"
                    )}
                    value={formatCurrencyBRL(credit.overdueOpenAmount)}
                  />
                </Grid>
                <Grid item xs={6} sm={4} md={2}>
                  <Stat
                    label={i18n.t(
                      "inventorySales.customers.account.upcomingAmount"
                    )}
                    value={formatCurrencyBRL(credit.upcomingOpenAmount || 0)}
                  />
                </Grid>
              </Grid>
            ) : null}

            {canViewFinancials ? (
              <Box className={classes.section}>
                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                  {i18n.t("inventorySales.customers.account.installments")}
                </Typography>
                {installments.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    {i18n.t("inventorySales.customers.account.noInstallments")}
                  </Typography>
                ) : (
                  <AppTableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            {i18n.t(
                              "inventorySales.receivables.columns.installment"
                            )}
                          </TableCell>
                          <TableCell>
                            {i18n.t(
                              "inventorySales.receivables.columns.dueDate"
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {i18n.t("inventorySales.receivables.columns.open")}
                          </TableCell>
                          <TableCell>
                            {i18n.t(
                              "inventorySales.receivables.columns.status"
                            )}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {installments.map((row) => (
                          <TableRow key={row.installmentId}>
                            <TableCell>
                              {row.sequence}
                              {row.saleNumber != null
                                ? ` · #${row.saleNumber}`
                                : ""}
                            </TableCell>
                            <TableCell>{formatDue(row.dueDate)}</TableCell>
                            <TableCell align="right">
                              {formatCurrencyBRL(row.openAmount)}
                            </TableCell>
                            <TableCell>
                              {i18n.t(
                                `inventorySales.receivables.status.${row.displayStatus}`,
                                row.displayStatus
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AppTableContainer>
                )}
              </Box>
            ) : null}

            <Box className={classes.section}>
              <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                {i18n.t("inventorySales.customers.account.sales")}
              </Typography>
              {sales.length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  {i18n.t("inventorySales.customers.account.noSales")}
                </Typography>
              ) : (
                <AppTableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>
                          {i18n.t("inventorySales.customers.account.saleDate")}
                        </TableCell>
                        <TableCell align="right">
                          {i18n.t("inventorySales.common.total", "Total")}
                        </TableCell>
                        <TableCell>
                          {i18n.t(
                            "inventorySales.sales.fields.paymentStatus"
                          )}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{sale.saleNumber ?? "—"}</TableCell>
                          <TableCell>
                            {formatDateTime(sale.completedAt || sale.createdAt)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrencyBRL(sale.totalAmount)}
                          </TableCell>
                          <TableCell>
                            {i18n.t(
                              `inventorySales.sales.paymentStatus.${sale.paymentStatus}`,
                              sale.paymentStatus
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AppTableContainer>
              )}
            </Box>

            {canViewFinancials ? (
              <Box className={classes.section}>
                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                  {i18n.t("inventorySales.customers.account.payments")}
                </Typography>
                {payments.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    {i18n.t("inventorySales.customers.account.noPayments")}
                  </Typography>
                ) : (
                  <AppTableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            {i18n.t("inventorySales.customers.account.paidAt")}
                          </TableCell>
                          <TableCell>
                            {i18n.t(
                              "inventorySales.receivables.detail.payments"
                            )}
                          </TableCell>
                          <TableCell>
                            {i18n.t("inventorySales.customers.account.operator")}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {payments.map((pay) => (
                          <TableRow
                            key={pay.id}
                            data-testid={`account-payment-row-${pay.id}`}
                          >
                            <TableCell>
                              {formatDateTime(pay.paidAt)}
                            </TableCell>
                            <TableCell
                              data-testid={`account-payment-line-${pay.id}`}
                            >
                              {formatReceivablePaymentHistoryLine(pay)}
                            </TableCell>
                            <TableCell>
                              {pay.createdByUser?.name || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AppTableContainer>
                )}
              </Box>
            ) : null}

            {canViewFinancials && overrides.length > 0 ? (
              <Box className={classes.section}>
                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                  {i18n.t("inventorySales.customers.account.overrides")}
                </Typography>
                <AppTableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          {i18n.t("inventorySales.customers.account.paidAt")}
                        </TableCell>
                        <TableCell>
                          {i18n.t(
                            "inventorySales.customers.account.overrideType"
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {i18n.t(
                            "inventorySales.customers.account.exceededAmount"
                          )}
                        </TableCell>
                        <TableCell>
                          {i18n.t("inventorySales.customers.account.operator")}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {overrides.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                          <TableCell>{row.overrideType}</TableCell>
                          <TableCell align="right">
                            {formatCurrencyBRL(row.exceededAmount)}
                          </TableCell>
                          <TableCell>
                            {row.authorizedByUser?.name || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </AppTableContainer>
              </Box>
            ) : null}
          </>
        )}
      </AppDialogContent>
      <AppDialogActions>
        <AppSecondaryButton onClick={onClose}>
          {i18n.t("inventorySales.common.cancel")}
        </AppSecondaryButton>
        {canManageCustomers ? (
          <AppSecondaryButton onClick={toggleActive} disabled={busy || loading}>
            {customer?.isActive
              ? i18n.t("inventorySales.customers.deactivate")
              : i18n.t("inventorySales.customers.activate")}
          </AppSecondaryButton>
        ) : null}
        {canManageCustomers && onEdit ? (
          <AppSecondaryButton
            onClick={() => onEdit(customer)}
            disabled={loading}
          >
            {i18n.t("inventorySales.customers.edit")}
          </AppSecondaryButton>
        ) : null}
        {onReceive && canViewFinancials ? (
          <AppPrimaryButton
            onClick={() => onReceive(customer)}
            disabled={loading || !(credit?.openAmount > 0)}
            data-testid="customer-account-receive"
          >
            {i18n.t("inventorySales.customers.receive")}
          </AppPrimaryButton>
        ) : null}
      </AppDialogActions>
    </AppDialog>
  );
}
