import React, { useCallback, useEffect, useState } from "react";
import { Box, Chip, Grid, Paper, Typography } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import { format } from "date-fns";
import AddIcon from "@material-ui/icons/Add";
import CategoryIcon from "@material-ui/icons/Category";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import ShoppingBasketIcon from "@material-ui/icons/ShoppingBasket";
import SwapHorizIcon from "@material-ui/icons/SwapHoriz";
import WarningIcon from "@material-ui/icons/Warning";
import ReceiptIcon from "@material-ui/icons/Receipt";

import {
  AppEmptyState,
  AppLoadingState,
  AppPrimaryButton,
  AppSecondaryButton,
  AppSectionCard,
} from "../../ui";
import {
  listInventoryCategories,
  listInventoryProducts,
  listInventorySales,
  listLowStockProducts,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { INVENTORY_TABS } from "./constants";
import { formatQuantity, formatSaleNumber, getSaleDisplayDate } from "./utils";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import { useManualSale } from "./ManualSaleProvider";

const useStyles = makeStyles((theme) => ({
  statCard: {
    padding: theme.spacing(2),
    borderRadius: 14,
    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
    height: "100%",
    background:
      theme.palette.type === "dark"
        ? alpha(theme.palette.background.paper, 0.95)
        : theme.palette.background.paper,
  },
  statHead: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  statLabel: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  statValue: {
    fontSize: "1.75rem",
    fontWeight: 700,
    marginTop: theme.spacing(1),
    lineHeight: 1.1,
    color: theme.palette.text.primary,
  },
  actionsBlock: {
    marginTop: theme.spacing(2.5),
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  saleRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:last-child": { borderBottom: "none" },
  },
  saleIdentity: {
    flex: "1 1 140px",
    minWidth: 0,
  },
  saleParty: {
    flex: "1 1 100px",
    minWidth: 0,
  },
  saleAmount: {
    marginLeft: "auto",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  lowStockItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing(1.25, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    gap: theme.spacing(1),
    "&:last-child": { borderBottom: "none" },
  },
}));

function StatCard({ label, value, icon }) {
  const classes = useStyles();
  return (
    <Paper className={classes.statCard} elevation={0}>
      <Box className={classes.statHead}>
        {icon}
        <Typography className={classes.statLabel}>{label}</Typography>
      </Box>
      <Typography className={classes.statValue}>{value}</Typography>
    </Paper>
  );
}

function saleStatusColor(status) {
  if (status === "completed") return "primary";
  return "default";
}

function formatRecentSaleDate(value) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  } catch (err) {
    return "—";
  }
}

export default function InventorySummaryTab({
  onNavigateTab,
  onNewProduct,
  onNewMovement,
}) {
  const classes = useStyles();
  const perms = useInventoryPermissions();
  const { startManualSale, creating } = useManualSale();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState({
    activeProducts: 0,
    categories: 0,
    lowStock: 0,
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [recentSalesError, setRecentSalesError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [productsRes, categoriesRes, lowStockRes, salesRes] = await Promise.all([
        listInventoryProducts({ active: true }),
        listInventoryCategories({ active: true }),
        listLowStockProducts(),
        listInventorySales({ page: 1, limit: 5 }).then(
          (res) => ({ ok: true, res }),
          () => ({ ok: false, res: null })
        ),
      ]);
      const products = Array.isArray(productsRes.data) ? productsRes.data : [];
      const categories = Array.isArray(categoriesRes.data)
        ? categoriesRes.data
        : [];
      const lowStock = Array.isArray(lowStockRes.data) ? lowStockRes.data : [];
      setStats({
        activeProducts: products.length,
        categories: categories.length,
        lowStock: lowStock.length,
      });
      setLowStockItems(lowStock.slice(0, 8));
      if (salesRes.ok) {
        const sales = Array.isArray(salesRes.res.data?.sales)
          ? salesRes.res.data.sales
          : [];
        setRecentSales(sales.slice(0, 5));
        setRecentSalesError(false);
      } else {
        setRecentSales([]);
        setRecentSalesError(true);
      }
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <AppLoadingState message={i18n.t("inventorySales.common.loading")} />;
  }

  if (loadError) {
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
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            label={i18n.t("inventorySales.summary.activeProducts")}
            value={stats.activeProducts}
            icon={<ShoppingBasketIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            label={i18n.t("inventorySales.summary.lowStock")}
            value={stats.lowStock}
            icon={<WarningIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            label={i18n.t("inventorySales.summary.categories")}
            value={stats.categories}
            icon={<CategoryIcon fontSize="small" />}
          />
        </Grid>
      </Grid>

      <Box className={classes.actionsBlock}>
        <Typography variant="caption" color="textSecondary">
          {i18n.t("inventorySales.summary.quickActions")}
        </Typography>
        <Box className={classes.actionsRow}>
          {perms.canCreateSale ? (
            <AppPrimaryButton
              startIcon={<ReceiptIcon />}
              onClick={startManualSale}
              disabled={creating}
            >
              {i18n.t("inventorySales.summary.actions.newSale")}
            </AppPrimaryButton>
          ) : null}
          {perms.canManageProducts ? (
            <AppSecondaryButton
              color="default"
              startIcon={<AddIcon />}
              onClick={onNewProduct}
            >
              {i18n.t("inventorySales.summary.actions.newProduct")}
            </AppSecondaryButton>
          ) : null}
          {perms.canManageStock ? (
            <AppSecondaryButton
              color="default"
              startIcon={<SwapHorizIcon />}
              onClick={onNewMovement}
            >
              {i18n.t("inventorySales.summary.actions.newMovement")}
            </AppSecondaryButton>
          ) : null}
          <AppSecondaryButton
            color="default"
            onClick={() => onNavigateTab(INVENTORY_TABS.STOCK)}
          >
            {i18n.t("inventorySales.summary.actions.viewStock")}
          </AppSecondaryButton>
        </Box>
      </Box>

      <Box mt={3}>
        <AppSectionCard variant="outlined">
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            {i18n.t("inventorySales.summary.lowStockListTitle")}
          </Typography>
          {lowStockItems.length === 0 ? (
            <Box display="flex" alignItems="center" mt={1.5} style={{ gap: 8 }}>
              <CheckCircleOutlineIcon fontSize="small" color="disabled" />
              <Typography variant="body2" color="textSecondary">
                {i18n.t("inventorySales.summary.noLowStock")}
              </Typography>
            </Box>
          ) : (
            <Box mt={1}>
              {lowStockItems.map((item) => (
                <div key={item.id} className={classes.lowStockItem}>
                  <Box minWidth={0}>
                    <Typography variant="body2" noWrap>
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {formatQuantity(item.currentQuantity)} /{" "}
                      {i18n.t("inventorySales.products.min")}{" "}
                      {formatQuantity(item.minStock)} {item.unit}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary">
                    {formatCurrencyBRL(item.salePrice)}
                  </Typography>
                </div>
              ))}
            </Box>
          )}
        </AppSectionCard>
      </Box>

      <Box mt={3}>
        <AppSectionCard variant="outlined">
          <Box className={classes.sectionHeader}>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {i18n.t("inventorySales.summary.recentSalesTitle")}
            </Typography>
            <AppSecondaryButton
              variant="text"
              size="small"
              onClick={() => onNavigateTab(INVENTORY_TABS.SALES)}
            >
              {i18n.t("inventorySales.summary.viewAllSales")}
            </AppSecondaryButton>
          </Box>
          {recentSalesError ? (
            <Box mt={1.5}>
              <Typography variant="body2" color="textSecondary">
                {i18n.t("inventorySales.summary.recentSalesError")}
              </Typography>
              <Box mt={1}>
                <AppSecondaryButton onClick={load}>
                  {i18n.t("inventorySales.common.retry")}
                </AppSecondaryButton>
              </Box>
            </Box>
          ) : recentSales.length === 0 ? (
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
              {i18n.t("inventorySales.summary.noRecentSales")}
            </Typography>
          ) : (
            <Box mt={1}>
              {recentSales.map((sale) => {
                const party = sale.contact?.name || sale.seller?.name || "—";
                return (
                  <div key={sale.id} className={classes.saleRow}>
                    <Box className={classes.saleIdentity}>
                      <Typography variant="body2" style={{ fontWeight: 600 }}>
                        {formatSaleNumber(sale)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {formatRecentSaleDate(getSaleDisplayDate(sale))}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      noWrap
                      className={classes.saleParty}
                      color="textSecondary"
                    >
                      {party}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={saleStatusColor(sale.status)}
                      label={i18n.t(
                        `inventorySales.sales.status.${sale.status}`,
                        sale.status
                      )}
                    />
                    <Typography variant="body2" className={classes.saleAmount}>
                      {formatCurrencyBRL(sale.totalAmount)}
                    </Typography>
                  </div>
                );
              })}
            </Box>
          )}
        </AppSectionCard>
      </Box>
    </Box>
  );
}
