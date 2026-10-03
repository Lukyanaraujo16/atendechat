import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import SearchIcon from "@material-ui/icons/Search";
import HistoryIcon from "@material-ui/icons/History";

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
  deleteInventoryProduct,
  listInventoryCategories,
  listInventoryProducts,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import ProductFormDialog from "./ProductFormDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { describeProductStock } from "./utils";
import { toast } from "react-toastify";
import { useInventoryPermissions } from "../../utils/inventoryAccess";

const useStyles = makeStyles((theme) => ({
  filtersRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    alignItems: "center",
    maxWidth: "100%",
  },
  headerRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5),
  },
}));

export default function InventoryProductsTab({
  autoOpenCreate,
  onAutoOpenConsumed,
  onViewStockHistory,
}) {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const perms = useInventoryPermissions();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await listInventoryCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (categoryId) params.categoryId = categoryId;
      if (activeFilter === "active") params.active = true;
      if (activeFilter === "inactive") params.active = false;
      const { data } = await listInventoryProducts(params);
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, activeFilter]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const t = setTimeout(loadProducts, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadProducts, search]);

  useEffect(() => {
    if (autoOpenCreate && perms.canManageProducts) {
      setEditId(null);
      setFormOpen(true);
      if (onAutoOpenConsumed) onAutoOpenConsumed();
    } else if (autoOpenCreate && onAutoOpenConsumed) {
      onAutoOpenConsumed();
    }
  }, [autoOpenCreate, onAutoOpenConsumed, perms.canManageProducts]);

  const openCreate = () => {
    setEditId(null);
    setFormOpen(true);
  };

  const openEdit = (product) => {
    setEditId(product.id);
    setFormOpen(true);
  };

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInventoryProduct(deleteTarget.id);
      toast.success(i18n.t("inventorySales.products.toasts.deactivated"));
      setConfirmOpen(false);
      setDeleteTarget(null);
      loadProducts();
    } catch (err) {
      toastError(err);
    }
  };

  const renderStockCell = (product) => {
    const stock = describeProductStock(product);
    if (stock.status === "untracked") {
      return (
        <Typography variant="body2" color="textSecondary">
          {i18n.t("inventorySales.products.noStockTracking")}
        </Typography>
      );
    }
    const detail =
      stock.status === "out"
        ? i18n.t("inventorySales.products.outOfStock")
        : stock.status === "low"
          ? [
              stock.minText
                ? i18n.t("inventorySales.products.minLabel", { value: stock.minText })
                : null,
              i18n.t("inventorySales.products.lowStockBadge"),
            ]
              .filter(Boolean)
              .join(" · ")
          : stock.minText
            ? i18n.t("inventorySales.products.minLabel", { value: stock.minText })
            : null;
    return (
      <Box>
        <Typography variant="body2">{stock.quantityText}</Typography>
        {detail ? (
          <Typography variant="caption" color="textSecondary">
            {detail}
          </Typography>
        ) : null}
      </Box>
    );
  };

  const renderActions = (product) => (
    <Box display="flex" justifyContent="flex-end">
      {product.trackStock ? (
        <Tooltip title={i18n.t("inventorySales.products.viewHistory")}>
          <IconButton
            size="small"
            onClick={() => {
              if (onViewStockHistory) onViewStockHistory(product.id);
            }}
          >
            <HistoryIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
      {perms.canManageProducts ? (
        <>
          <IconButton size="small" onClick={() => openEdit(product)}>
            <EditIcon fontSize="small" />
          </IconButton>
          {product.active !== false ? (
            <IconButton
              size="small"
              onClick={() => {
                setDeleteTarget(product);
                setConfirmOpen(true);
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          ) : null}
        </>
      ) : null}
    </Box>
  );

  return (
    <Box>
      <div className={classes.headerRow}>
        <Box>
          <Typography variant="h6" style={{ fontWeight: 600 }}>
            {i18n.t("inventorySales.products.title")}
          </Typography>
          {!loading && !loadError ? (
            <Typography variant="caption" color="textSecondary">
              {i18n.t("inventorySales.products.count", { count: products.length })}
            </Typography>
          ) : null}
        </Box>
        {perms.canManageProducts ? (
          <AppPrimaryButton startIcon={<AddIcon />} onClick={openCreate}>
            {i18n.t("inventorySales.products.new")}
          </AppPrimaryButton>
        ) : null}
      </div>

      <div className={classes.filtersRow}>
        <TextField
          size="small"
          variant="outlined"
          placeholder={i18n.t("inventorySales.products.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 200, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
        <FormControl variant="outlined" size="small" style={{ minWidth: 160 }}>
          <InputLabel id="product-cat-filter">
            {i18n.t("inventorySales.products.filterCategory")}
          </InputLabel>
          <Select
            labelId="product-cat-filter"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            label={i18n.t("inventorySales.products.filterCategory")}
          >
            <MenuItem value="">{i18n.t("inventorySales.common.all")}</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={String(cat.id)}>
                {cat.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
          <InputLabel id="product-active-filter">
            {i18n.t("inventorySales.products.filterActive")}
          </InputLabel>
          <Select
            labelId="product-active-filter"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            label={i18n.t("inventorySales.products.filterActive")}
          >
            <MenuItem value="all">{i18n.t("inventorySales.common.all")}</MenuItem>
            <MenuItem value="active">
              {i18n.t("inventorySales.common.active")}
            </MenuItem>
            <MenuItem value="inactive">
              {i18n.t("inventorySales.common.inactive")}
            </MenuItem>
          </Select>
        </FormControl>
      </div>

      <AppSectionCard variant="outlined" dense>
        {loading ? (
          <AppTableRowSkeleton columns={isMobile ? 1 : 6} />
        ) : loadError ? (
          <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
            <AppSecondaryButton onClick={loadProducts}>
              {i18n.t("inventorySales.common.retry")}
            </AppSecondaryButton>
          </AppEmptyState>
        ) : products.length === 0 ? (
          <AppEmptyState
            title={i18n.t("inventorySales.products.emptyTitle")}
            description={i18n.t("inventorySales.products.emptyDescription")}
          >
            {perms.canManageProducts ? (
              <AppPrimaryButton startIcon={<AddIcon />} onClick={openCreate}>
                {i18n.t("inventorySales.products.new")}
              </AppPrimaryButton>
            ) : null}
          </AppEmptyState>
        ) : isMobile ? (
          <MobileCardList>
            {products.map((product) => (
              <MobileEntityCard
                key={product.id}
                title={product.name}
                subtitle={product.sku || product.barcode || "—"}
                badges={
                  <Box className={classes.chipRow}>
                    {product.active === false ? (
                      <Chip
                        size="small"
                        label={i18n.t("inventorySales.common.inactive")}
                      />
                    ) : null}
                  </Box>
                }
                footer={renderActions(product)}
              >
                <Typography variant="body2">
                  {formatCurrencyBRL(product.salePrice)}
                </Typography>
                {renderStockCell(product)}
              </MobileEntityCard>
            ))}
          </MobileCardList>
        ) : (
          <AppTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("inventorySales.products.columns.name")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.products.columns.sku")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.products.columns.category")}</TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.products.columns.price")}
                  </TableCell>
                  <TableCell>{i18n.t("inventorySales.products.columns.stock")}</TableCell>
                  {perms.canManageProducts ? (
                    <TableCell align="right">
                      {i18n.t("inventorySales.common.actions")}
                    </TableCell>
                  ) : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                        <span>{product.name}</span>
                        {product.active === false ? (
                          <Chip
                            size="small"
                            label={i18n.t("inventorySales.common.inactive")}
                          />
                        ) : null}
                      </Box>
                    </TableCell>
                    <TableCell>{product.sku || "—"}</TableCell>
                    <TableCell>{product.category?.name || "—"}</TableCell>
                    <TableCell align="right">
                      {formatCurrencyBRL(product.salePrice)}
                    </TableCell>
                    <TableCell>{renderStockCell(product)}</TableCell>
                    {perms.canManageProducts ? (
                      <TableCell align="right">{renderActions(product)}</TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AppTableContainer>
        )}
      </AppSectionCard>

      <ProductFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        productId={editId}
        categories={categories}
        onSaved={loadProducts}
      />

      <ConfirmationModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDeactivate}
        title={i18n.t("inventorySales.products.deactivateTitle")}
      >
        {i18n.t("inventorySales.products.deactivateMessage", {
          name: deleteTarget?.name || "",
        })}
      </ConfirmationModal>
    </Box>
  );
}
