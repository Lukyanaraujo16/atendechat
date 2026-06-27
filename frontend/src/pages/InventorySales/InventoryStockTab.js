import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import { format } from "date-fns";

import {
  AppEmptyState,
  AppLoadingState,
  AppPrimaryButton,
  AppSecondaryButton,
  AppSectionCard,
  AppTableContainer,
  AppTableRowSkeleton,
  MobileCardList,
  MobileEntityCard,
} from "../../ui";
import {
  listInventoryProducts,
  listStockMovements,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import StockMovementFormDialog from "./StockMovementFormDialog";
import { STOCK_MOVEMENT_TYPES } from "./constants";
import { formatQuantity } from "./utils";

const useStyles = makeStyles((theme) => ({
  headerRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  filtersRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));

export default function InventoryStockTab({
  productFilter,
  autoOpenCreate,
  onAutoOpenConsumed,
}) {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const { data } = await listInventoryProducts({ active: true });
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    }
  }, []);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = { limit: 50, page: 1 };
      if (productId) params.productId = productId;
      if (typeFilter) params.type = typeFilter;
      const { data } = await listStockMovements(params);
      setMovements(Array.isArray(data?.movements) ? data.movements : []);
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [productId, typeFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (productFilter != null && productFilter !== "") {
      setProductId(String(productFilter));
    }
  }, [productFilter]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  useEffect(() => {
    if (autoOpenCreate) {
      setFormOpen(true);
      if (onAutoOpenConsumed) onAutoOpenConsumed();
    }
  }, [autoOpenCreate, onAutoOpenConsumed]);

  const formatDate = (value) => {
    if (!value) return "—";
    try {
      return format(new Date(value), "dd/MM/yyyy HH:mm");
    } catch {
      return "—";
    }
  };

  const typeLabel = (type) =>
    i18n.t(`inventorySales.stock.types.${type}`, type);

  return (
    <Box>
      <div className={classes.headerRow}>
        <Typography variant="h6" style={{ fontWeight: 600 }}>
          {i18n.t("inventorySales.stock.title")}
        </Typography>
        <AppPrimaryButton startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
          {i18n.t("inventorySales.stock.new")}
        </AppPrimaryButton>
      </div>

      <div className={classes.filtersRow}>
        <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
          <InputLabel id="stock-product-filter">
            {i18n.t("inventorySales.stock.filterProduct")}
          </InputLabel>
          <Select
            labelId="stock-product-filter"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            label={i18n.t("inventorySales.stock.filterProduct")}
          >
            <MenuItem value="">{i18n.t("inventorySales.common.all")}</MenuItem>
            {products.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" style={{ minWidth: 160 }}>
          <InputLabel id="stock-type-filter">
            {i18n.t("inventorySales.stock.filterType")}
          </InputLabel>
          <Select
            labelId="stock-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            label={i18n.t("inventorySales.stock.filterType")}
          >
            <MenuItem value="">{i18n.t("inventorySales.common.all")}</MenuItem>
            {STOCK_MOVEMENT_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {typeLabel(type)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      <AppSectionCard variant="outlined" dense>
        {loading ? (
          <AppTableRowSkeleton columns={isMobile ? 1 : 6} />
        ) : loadError ? (
          <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
            <AppSecondaryButton onClick={loadMovements}>
              {i18n.t("inventorySales.common.retry")}
            </AppSecondaryButton>
          </AppEmptyState>
        ) : movements.length === 0 ? (
          <AppEmptyState
            title={i18n.t("inventorySales.stock.emptyTitle")}
            description={i18n.t("inventorySales.stock.emptyDescription")}
          >
            <AppPrimaryButton startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
              {i18n.t("inventorySales.stock.new")}
            </AppPrimaryButton>
          </AppEmptyState>
        ) : isMobile ? (
          <MobileCardList>
            {movements.map((m) => (
              <MobileEntityCard
                key={m.id}
                title={m.product?.name || "—"}
                subtitle={formatDate(m.createdAt)}
                badges={
                  <Typography component="span" variant="caption" color="primary">
                    {typeLabel(m.type)}
                  </Typography>
                }
              >
                <Typography variant="body2">
                  {i18n.t("inventorySales.stock.columns.quantity")}:{" "}
                  {formatQuantity(m.quantity)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {i18n.t("inventorySales.stock.columns.balance")}:{" "}
                  {formatQuantity(m.balanceAfter)}
                </Typography>
                {m.notes ? (
                  <Typography variant="caption" color="textSecondary">
                    {m.notes}
                  </Typography>
                ) : null}
              </MobileEntityCard>
            ))}
          </MobileCardList>
        ) : (
          <AppTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("inventorySales.stock.columns.date")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.stock.columns.product")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.stock.columns.type")}</TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.stock.columns.quantity")}
                  </TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.stock.columns.balance")}
                  </TableCell>
                  <TableCell>{i18n.t("inventorySales.stock.columns.notes")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{formatDate(m.createdAt)}</TableCell>
                    <TableCell>{m.product?.name || "—"}</TableCell>
                    <TableCell>{typeLabel(m.type)}</TableCell>
                    <TableCell align="right">{formatQuantity(m.quantity)}</TableCell>
                    <TableCell align="right">{formatQuantity(m.balanceAfter)}</TableCell>
                    <TableCell>{m.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AppTableContainer>
        )}
      </AppSectionCard>

      <StockMovementFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        products={products}
        defaultProductId={productId || undefined}
        onSaved={loadMovements}
      />
    </Box>
  );
}
