import React, { useCallback, useEffect, useState } from "react";
import { Box, Grid, Paper, Typography } from "@material-ui/core";
import { makeStyles, alpha } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import SwapHorizIcon from "@material-ui/icons/SwapHoriz";
import WarningIcon from "@material-ui/icons/Warning";

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
  listLowStockProducts,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { INVENTORY_TABS } from "./constants";
import { formatQuantity } from "./utils";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { useInventoryPermissions } from "../../utils/inventoryAccess";

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
  statLabel: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  statValue: {
    fontSize: "1.75rem",
    fontWeight: 700,
    marginTop: theme.spacing(0.5),
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
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

function StatCard({ label, value, warning }) {
  const classes = useStyles();
  return (
    <Paper className={classes.statCard} elevation={0}>
      <Typography className={classes.statLabel}>{label}</Typography>
      <Box display="flex" alignItems="center" style={{ gap: 8 }}>
        <Typography className={classes.statValue}>{value}</Typography>
        {warning ? <WarningIcon color="secondary" fontSize="small" /> : null}
      </Box>
    </Paper>
  );
}

export default function InventorySummaryTab({
  onNavigateTab,
  onNewProduct,
  onNewMovement,
}) {
  const classes = useStyles();
  const perms = useInventoryPermissions();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState({
    activeProducts: 0,
    categories: 0,
    lowStock: 0,
  });
  const [lowStockItems, setLowStockItems] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [productsRes, categoriesRes, lowStockRes] = await Promise.all([
        listInventoryProducts({ active: true }),
        listInventoryCategories({ active: true }),
        listLowStockProducts(),
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
        <Grid item xs={12} sm={4}>
          <StatCard
            label={i18n.t("inventorySales.summary.activeProducts")}
            value={stats.activeProducts}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            label={i18n.t("inventorySales.summary.lowStock")}
            value={stats.lowStock}
            warning={stats.lowStock > 0}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            label={i18n.t("inventorySales.summary.categories")}
            value={stats.categories}
          />
        </Grid>
      </Grid>

      <Box className={classes.actionsRow}>
        {perms.canManageProducts ? (
          <AppPrimaryButton startIcon={<AddIcon />} onClick={onNewProduct}>
            {i18n.t("inventorySales.summary.actions.newProduct")}
          </AppPrimaryButton>
        ) : null}
        {perms.canManageStock ? (
          <AppSecondaryButton startIcon={<SwapHorizIcon />} onClick={onNewMovement}>
            {i18n.t("inventorySales.summary.actions.newMovement")}
          </AppSecondaryButton>
        ) : null}
        <AppSecondaryButton onClick={() => onNavigateTab(INVENTORY_TABS.STOCK)}>
          {i18n.t("inventorySales.summary.actions.viewStock")}
        </AppSecondaryButton>
      </Box>

      <Box mt={3}>
        <AppSectionCard variant="outlined">
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            {i18n.t("inventorySales.summary.lowStockListTitle")}
          </Typography>
          {lowStockItems.length === 0 ? (
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
              {i18n.t("inventorySales.summary.noLowStock")}
            </Typography>
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
    </Box>
  );
}
