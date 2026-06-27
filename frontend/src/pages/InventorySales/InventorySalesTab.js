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
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import SearchIcon from "@material-ui/icons/Search";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import VisibilityIcon from "@material-ui/icons/Visibility";
import { format } from "date-fns";
import { toast } from "react-toastify";

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
import api from "../../services/api";
import {
  createInventorySale,
  listInventorySales,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import SaleDrawer from "./SaleDrawer";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import {
  formatSaleNumber,
  getSaleDisplayDate,
  paymentStatusChipColor,
} from "./utils";
import { SALE_STATUSES, PAYMENT_STATUSES } from "./constants";

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
    alignItems: "center",
    maxWidth: "100%",
  },
  paginationRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing(2),
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
}));

function statusChipColor(status) {
  if (status === "completed") return "primary";
  if (status === "cancelled") return "default";
  return "default";
}

export default function InventorySalesTab() {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const perms = useInventoryPermissions();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sales, setSales] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [count, setCount] = useState(0);
  const [limit] = useState(20);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [sellerUserId, setSellerUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [users, setUsers] = useState([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/users/list");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    }
  }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = { page, limit };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      if (sellerUserId) params.sellerUserId = sellerUserId;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.endDate = end.toISOString();
      }
      const { data } = await listInventorySales(params);
      setSales(Array.isArray(data?.sales) ? data.sales : []);
      setHasMore(Boolean(data?.hasMore));
      setCount(data?.count ?? 0);
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, status, paymentStatus, sellerUserId, startDate, endDate]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const t = setTimeout(loadSales, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadSales, search]);

  useEffect(() => {
    setPage(1);
  }, [status, paymentStatus, sellerUserId, startDate, endDate, search]);

  const openSale = (id) => {
    setSelectedSaleId(id);
    setDrawerOpen(true);
  };

  const handleNewSale = async () => {
    setCreating(true);
    try {
      const { data } = await createInventorySale({ source: "manual" });
      toast.success(i18n.t("inventorySales.sales.toasts.created"));
      setSelectedSaleId(data.id);
      setDrawerOpen(true);
      loadSales();
    } catch (err) {
      toastError(err);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    try {
      return format(new Date(value), "dd/MM/yyyy HH:mm");
    } catch {
      return "—";
    }
  };

  const statusLabel = (s) =>
    i18n.t(`inventorySales.sales.status.${s}`, s);

  const paymentStatusLabel = (s) =>
    i18n.t(`inventorySales.sales.paymentStatus.${s}`, s);

  const paymentMethodLabel = (method) =>
    method
      ? i18n.t(`inventorySales.sales.paymentMethods.${method}`, method)
      : "—";

  const renderRow = (sale) => {
    const displayDate = getSaleDisplayDate(sale);
    return (
      <>
        <TableCell>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <span>{formatSaleNumber(sale)}</span>
            <Chip
              size="small"
              color={statusChipColor(sale.status)}
              label={statusLabel(sale.status)}
            />
            {sale.status === "completed" && sale.paymentStatus ? (
              <Chip
                size="small"
                color={paymentStatusChipColor(sale.paymentStatus)}
                label={paymentStatusLabel(sale.paymentStatus)}
              />
            ) : null}
          </Box>
        </TableCell>
        <TableCell>{sale.contact?.name || "—"}</TableCell>
        <TableCell>{sale.seller?.name || "—"}</TableCell>
        <TableCell align="right">{formatCurrencyBRL(sale.totalAmount)}</TableCell>
        <TableCell>{paymentMethodLabel(sale.paymentMethod)}</TableCell>
        <TableCell align="right">
          {sale.commissionAmount != null
            ? formatCurrencyBRL(sale.commissionAmount)
            : "—"}
        </TableCell>
        <TableCell>{formatDate(displayDate)}</TableCell>
        <TableCell align="right">
          <IconButton size="small" onClick={() => openSale(sale.id)}>
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </>
    );
  };

  return (
    <Box>
      <div className={classes.headerRow}>
        <Typography variant="h6" style={{ fontWeight: 600 }}>
          {i18n.t("inventorySales.sales.title")}
        </Typography>
        {perms.canCreateSale ? (
          <AppPrimaryButton
            startIcon={<AddIcon />}
            onClick={handleNewSale}
            disabled={creating}
          >
            {i18n.t("inventorySales.sales.new")}
          </AppPrimaryButton>
        ) : null}
      </div>

      <div className={classes.filtersRow}>
        <TextField
          size="small"
          variant="outlined"
          placeholder={i18n.t("inventorySales.sales.search")}
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
        <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
          <InputLabel id="sale-status-filter">
            {i18n.t("inventorySales.sales.filterStatus")}
          </InputLabel>
          <Select
            labelId="sale-status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            label={i18n.t("inventorySales.sales.filterStatus")}
          >
            <MenuItem value="">{i18n.t("inventorySales.common.all")}</MenuItem>
            {SALE_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {statusLabel(s)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" style={{ minWidth: 150 }}>
          <InputLabel id="sale-payment-status-filter">
            {i18n.t("inventorySales.sales.filterPaymentStatus")}
          </InputLabel>
          <Select
            labelId="sale-payment-status-filter"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            label={i18n.t("inventorySales.sales.filterPaymentStatus")}
          >
            <MenuItem value="">{i18n.t("inventorySales.common.all")}</MenuItem>
            {PAYMENT_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {paymentStatusLabel(s)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" style={{ minWidth: 160 }}>
          <InputLabel id="sale-seller-filter">
            {i18n.t("inventorySales.sales.filterSeller")}
          </InputLabel>
          <Select
            labelId="sale-seller-filter"
            value={sellerUserId}
            onChange={(e) => setSellerUserId(e.target.value)}
            label={i18n.t("inventorySales.sales.filterSeller")}
          >
            <MenuItem value="">{i18n.t("inventorySales.common.all")}</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={String(u.id)}>
                {u.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          variant="outlined"
          type="date"
          label={i18n.t("inventorySales.sales.startDate")}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          variant="outlined"
          type="date"
          label={i18n.t("inventorySales.sales.endDate")}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </div>

      <AppSectionCard variant="outlined" dense>
        {loading ? (
          <AppTableRowSkeleton columns={isMobile ? 1 : 8} />
        ) : loadError ? (
          <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
            <AppSecondaryButton onClick={loadSales}>
              {i18n.t("inventorySales.common.retry")}
            </AppSecondaryButton>
          </AppEmptyState>
        ) : sales.length === 0 ? (
          <AppEmptyState
            title={i18n.t("inventorySales.sales.emptyTitle")}
            description={i18n.t("inventorySales.sales.emptyDescription")}
          >
            {perms.canCreateSale ? (
              <AppPrimaryButton
                startIcon={<AddIcon />}
                onClick={handleNewSale}
                disabled={creating}
              >
                {i18n.t("inventorySales.sales.new")}
              </AppPrimaryButton>
            ) : null}
          </AppEmptyState>
        ) : isMobile ? (
          <MobileCardList>
            {sales.map((sale) => (
              <MobileEntityCard
                key={sale.id}
                title={formatSaleNumber(sale)}
                subtitle={sale.contact?.name || "—"}
                badges={
                  <>
                    <Chip
                      size="small"
                      color={statusChipColor(sale.status)}
                      label={statusLabel(sale.status)}
                    />
                    {sale.status === "completed" && sale.paymentStatus ? (
                      <Chip
                        size="small"
                        color={paymentStatusChipColor(sale.paymentStatus)}
                        label={paymentStatusLabel(sale.paymentStatus)}
                      />
                    ) : null}
                  </>
                }
                footer={
                  <IconButton size="small" onClick={() => openSale(sale.id)}>
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                }
              >
                <Typography variant="body2">
                  {sale.seller?.name || "—"} · {formatCurrencyBRL(sale.totalAmount)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {paymentMethodLabel(sale.paymentMethod)}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {formatDate(getSaleDisplayDate(sale))}
                </Typography>
              </MobileEntityCard>
            ))}
          </MobileCardList>
        ) : (
          <AppTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("inventorySales.sales.columns.number")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.sales.columns.contact")}</TableCell>
                  <TableCell>{i18n.t("inventorySales.sales.columns.seller")}</TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.sales.columns.total")}
                  </TableCell>
                  <TableCell>
                    {i18n.t("inventorySales.sales.columns.paymentMethod")}
                  </TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.sales.columns.commission")}
                  </TableCell>
                  <TableCell>{i18n.t("inventorySales.sales.columns.date")}</TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.common.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow
                    key={sale.id}
                    hover
                    style={{ cursor: "pointer" }}
                    onClick={() => openSale(sale.id)}
                  >
                    {renderRow(sale)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AppTableContainer>
        )}
      </AppSectionCard>

      {!loading && sales.length > 0 ? (
        <div className={classes.paginationRow}>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("inventorySales.sales.pagination", {
              page,
              count,
            })}
          </Typography>
          <Box display="flex" style={{ gap: 4 }}>
            <IconButton
              size="small"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              size="small"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </div>
      ) : null}

      <SaleDrawer
        open={drawerOpen}
        saleId={selectedSaleId}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedSaleId(null);
        }}
        onChanged={loadSales}
      />
    </Box>
  );
}
