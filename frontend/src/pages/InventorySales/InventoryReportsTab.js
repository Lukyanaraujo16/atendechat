import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import { format } from "date-fns";

import {
  AppEmptyState,
  AppLoadingState,
  AppSecondaryButton,
  AppSectionCard,
  AppTableContainer,
  AppTableRowSkeleton,
  MobileCardList,
  MobileEntityCard,
} from "../../ui";
import api from "../../services/api";
import {
  getInventoryReportCustomers,
  getInventoryReportProducts,
  getInventoryReportSellers,
  getInventoryReportSummary,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { formatQuantity } from "./utils";

const useStyles = makeStyles((theme) => ({
  filtersRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    alignItems: "center",
  },
  statCard: {
    padding: theme.spacing(2),
    borderRadius: 14,
    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
    height: "100%",
    background: theme.palette.background.paper,
  },
  statLabel: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  statValue: {
    fontSize: "1.35rem",
    fontWeight: 700,
    marginTop: theme.spacing(0.5),
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  },
}));

function StatCard({ label, value }) {
  const classes = useStyles();
  return (
    <Paper className={classes.statCard} elevation={0}>
      <Typography className={classes.statLabel}>{label}</Typography>
      <Typography className={classes.statValue}>{value}</Typography>
    </Paper>
  );
}

function formatReportDate(value) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy");
  } catch {
    return "—";
  }
}

function buildParams(startDate, endDate, sellerUserId) {
  const params = {};
  if (startDate) {
    params.startDate = new Date(startDate).toISOString();
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    params.endDate = end.toISOString();
  }
  if (sellerUserId) params.sellerUserId = sellerUserId;
  return params;
}

export default function InventoryReportsTab() {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sellerUserId, setSellerUserId] = useState("");
  const [users, setUsers] = useState([]);

  const [summary, setSummary] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    api
      .get("/users/list")
      .then(({ data }) => setUsers(Array.isArray(data) ? data : []))
      .catch(toastError);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const params = buildParams(startDate, endDate, sellerUserId);
    try {
      const [summaryRes, sellersRes, productsRes, customersRes] =
        await Promise.all([
          getInventoryReportSummary(params),
          getInventoryReportSellers(params),
          getInventoryReportProducts(params),
          getInventoryReportCustomers(params),
        ]);
      setSummary(summaryRes.data || null);
      setSellers(Array.isArray(sellersRes.data) ? sellersRes.data : []);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, sellerUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const hasData =
    summary &&
    (summary.completedSalesCount > 0 ||
      summary.cancelledSalesCount > 0 ||
      sellers.length > 0 ||
      products.length > 0 ||
      customers.length > 0);

  if (loading && !summary) {
    return (
      <AppLoadingState message={i18n.t("inventorySales.common.loading")} />
    );
  }

  if (loadError && !summary) {
    return (
      <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
        <AppSecondaryButton onClick={load}>
          {i18n.t("inventorySales.common.retry")}
        </AppSecondaryButton>
      </AppEmptyState>
    );
  }

  return (
    <Box>
      <Typography variant="h6" style={{ fontWeight: 600, marginBottom: 16 }}>
        {i18n.t("inventorySales.reports.title")}
      </Typography>

      <div className={classes.filtersRow}>
        <TextField
          size="small"
          variant="outlined"
          type="date"
          label={i18n.t("inventorySales.reports.startDate")}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          variant="outlined"
          type="date"
          label={i18n.t("inventorySales.reports.endDate")}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <FormControl variant="outlined" size="small" style={{ minWidth: 180 }}>
          <InputLabel id="report-seller-filter">
            {i18n.t("inventorySales.reports.filterSeller")}
          </InputLabel>
          <Select
            labelId="report-seller-filter"
            value={sellerUserId}
            onChange={(e) => setSellerUserId(e.target.value)}
            label={i18n.t("inventorySales.reports.filterSeller")}
          >
            <MenuItem value="">{i18n.t("inventorySales.common.all")}</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                {u.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      {!hasData && !loading ? (
        <AppEmptyState
          title={i18n.t("inventorySales.reports.emptyTitle")}
          description={i18n.t("inventorySales.reports.emptyDescription")}
        />
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={4} md={2}>
              <StatCard
                label={i18n.t("inventorySales.reports.summary.totalSold")}
                value={formatCurrencyBRL(summary?.totalSold)}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <StatCard
                label={i18n.t("inventorySales.reports.summary.completedCount")}
                value={summary?.completedSalesCount ?? 0}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <StatCard
                label={i18n.t("inventorySales.reports.summary.averageTicket")}
                value={formatCurrencyBRL(summary?.averageTicket)}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <StatCard
                label={i18n.t("inventorySales.reports.summary.totalCommission")}
                value={formatCurrencyBRL(summary?.totalCommission)}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <StatCard
                label={i18n.t("inventorySales.reports.summary.cancelledCount")}
                value={summary?.cancelledSalesCount ?? 0}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <StatCard
                label={i18n.t("inventorySales.reports.summary.cancelledTotal")}
                value={formatCurrencyBRL(summary?.cancelledTotal)}
              />
            </Grid>
          </Grid>

          <Typography variant="subtitle1" className={classes.sectionTitle}>
            {i18n.t("inventorySales.reports.sellersTitle")}
          </Typography>
          <AppSectionCard variant="outlined" dense>
            {loading ? (
              <AppTableRowSkeleton columns={isMobile ? 1 : 5} />
            ) : sellers.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                {i18n.t("inventorySales.reports.noRows")}
              </Typography>
            ) : isMobile ? (
              <MobileCardList>
                {sellers.map((row) => (
                  <MobileEntityCard
                    key={row.sellerUserId ?? "none"}
                    title={row.sellerName || i18n.t("inventorySales.reports.noSeller")}
                    subtitle={`${row.salesCount} ${i18n.t("inventorySales.reports.salesShort")}`}
                  >
                    <Typography variant="body2">
                      {formatCurrencyBRL(row.totalSold)} ·{" "}
                      {i18n.t("inventorySales.reports.columns.commission")}:{" "}
                      {formatCurrencyBRL(row.totalCommission)}
                    </Typography>
                  </MobileEntityCard>
                ))}
              </MobileCardList>
            ) : (
              <AppTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        {i18n.t("inventorySales.reports.columns.seller")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.reports.columns.salesCount")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.reports.columns.totalSold")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.reports.columns.commission")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.reports.columns.averageTicket")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sellers.map((row) => (
                      <TableRow key={row.sellerUserId ?? "none"}>
                        <TableCell>
                          {row.sellerName ||
                            i18n.t("inventorySales.reports.noSeller")}
                        </TableCell>
                        <TableCell align="right">{row.salesCount}</TableCell>
                        <TableCell align="right">
                          {formatCurrencyBRL(row.totalSold)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrencyBRL(row.totalCommission)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrencyBRL(row.averageTicket)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AppTableContainer>
            )}
          </AppSectionCard>

          <Typography variant="subtitle1" className={classes.sectionTitle}>
            {i18n.t("inventorySales.reports.productsTitle")}
          </Typography>
          <AppSectionCard variant="outlined" dense>
            {loading ? (
              <AppTableRowSkeleton columns={isMobile ? 1 : 4} />
            ) : products.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                {i18n.t("inventorySales.reports.noRows")}
              </Typography>
            ) : isMobile ? (
              <MobileCardList>
                {products.map((row) => (
                  <MobileEntityCard
                    key={row.productId}
                    title={row.productName}
                    subtitle={row.productSku || undefined}
                  >
                    <Typography variant="body2">
                      {formatQuantity(row.quantitySold)} ·{" "}
                      {formatCurrencyBRL(row.totalSold)}
                    </Typography>
                  </MobileEntityCard>
                ))}
              </MobileCardList>
            ) : (
              <AppTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        {i18n.t("inventorySales.reports.columns.product")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.reports.columns.quantitySold")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.reports.columns.totalSold")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.reports.columns.salesCount")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {products.map((row) => (
                      <TableRow key={row.productId}>
                        <TableCell>
                          {row.productName}
                          {row.productSku ? (
                            <Typography variant="caption" display="block" color="textSecondary">
                              {row.productSku}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell align="right">
                          {formatQuantity(row.quantitySold)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrencyBRL(row.totalSold)}
                        </TableCell>
                        <TableCell align="right">{row.salesCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AppTableContainer>
            )}
          </AppSectionCard>

          <Typography variant="subtitle1" className={classes.sectionTitle}>
            {i18n.t("inventorySales.reports.customersTitle")}
          </Typography>
          <AppSectionCard variant="outlined" dense>
            {loading ? (
              <AppTableRowSkeleton columns={isMobile ? 1 : 4} />
            ) : customers.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                {i18n.t("inventorySales.reports.noRows")}
              </Typography>
            ) : isMobile ? (
              <MobileCardList>
                {customers.map((row) => (
                  <MobileEntityCard
                    key={row.contactId}
                    title={row.contactName || "—"}
                    subtitle={formatReportDate(row.lastPurchaseAt)}
                  >
                    <Typography variant="body2">
                      {row.salesCount}{" "}
                      {i18n.t("inventorySales.reports.salesShort")} ·{" "}
                      {formatCurrencyBRL(row.totalSold)}
                    </Typography>
                  </MobileEntityCard>
                ))}
              </MobileCardList>
            ) : (
              <AppTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        {i18n.t("inventorySales.reports.columns.customer")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.reports.columns.salesCount")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.reports.columns.totalSold")}
                      </TableCell>
                      <TableCell>
                        {i18n.t("inventorySales.reports.columns.lastPurchase")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customers.map((row) => (
                      <TableRow key={row.contactId}>
                        <TableCell>{row.contactName || "—"}</TableCell>
                        <TableCell align="right">{row.salesCount}</TableCell>
                        <TableCell align="right">
                          {formatCurrencyBRL(row.totalSold)}
                        </TableCell>
                        <TableCell>
                          {formatReportDate(row.lastPurchaseAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AppTableContainer>
            )}
          </AppSectionCard>
        </>
      )}
    </Box>
  );
}
