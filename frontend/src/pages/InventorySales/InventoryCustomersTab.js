import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import SearchIcon from "@material-ui/icons/Search";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import VisibilityIcon from "@material-ui/icons/Visibility";
import EditIcon from "@material-ui/icons/Edit";

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
import { listInventoryCustomers } from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import InventoryCustomerFormDialog from "./InventoryCustomerFormDialog";
import InventoryCustomerAccountDialog from "./InventoryCustomerAccountDialog";

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

export default function InventoryCustomersTab({
  onNavigateReceivables,
}) {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const perms = useInventoryPermissions();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState("");
  const [withOpenBalance, setWithOpenBalance] = useState(false);
  const [withOverdue, setWithOverdue] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [accountId, setAccountId] = useState(null);

  const load = useCallback(async () => {
    if (!perms.canViewCustomers) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const params = { page, limit };
      if (search.trim()) params.search = search.trim();
      if (isActive !== "") params.isActive = isActive;
      if (withOpenBalance) params.withOpenBalance = true;
      if (withOverdue) params.withOverdue = true;
      const { data } = await listInventoryCustomers(params);
      setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      setCount(data?.count ?? 0);
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [
    perms.canViewCustomers,
    page,
    limit,
    search,
    isActive,
    withOpenBalance,
    withOverdue,
  ]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    setPage(1);
  }, [search, isActive, withOpenBalance, withOverdue]);

  const hasMore = page * limit < count;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setFormOpen(true);
  };

  if (!perms.canViewCustomers) {
    return (
      <AppEmptyState
        title={i18n.t("inventorySales.permissions.noTabAccessTitle")}
        description={i18n.t("inventorySales.permissions.noTabAccessDescription")}
      />
    );
  }

  return (
    <Box data-testid="inventory-customers-tab">
      <div className={classes.headerRow}>
        <Typography variant="h6" style={{ fontWeight: 600 }}>
          {i18n.t("inventorySales.customers.title")}
        </Typography>
        {perms.canManageCustomers ? (
          <AppPrimaryButton
            onClick={openCreate}
            data-testid="inventory-customers-new"
          >
            {i18n.t("inventorySales.customers.new")}
          </AppPrimaryButton>
        ) : null}
      </div>

      <div className={classes.filtersRow}>
        <TextField
          size="small"
          variant="outlined"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={i18n.t("inventorySales.customers.search")}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          style={{ minWidth: 220, flex: 1, maxWidth: 360 }}
          inputProps={{ "data-testid": "inventory-customers-search" }}
        />
        <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
          <InputLabel>
            {i18n.t("inventorySales.customers.filters.status")}
          </InputLabel>
          <Select
            label={i18n.t("inventorySales.customers.filters.status")}
            value={isActive}
            onChange={(e) => setIsActive(e.target.value)}
          >
            <MenuItem value="">{i18n.t("inventorySales.common.all")}</MenuItem>
            <MenuItem value="true">
              {i18n.t("inventorySales.customers.filters.active")}
            </MenuItem>
            <MenuItem value="false">
              {i18n.t("inventorySales.customers.filters.inactive")}
            </MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={withOpenBalance}
              onChange={(e) => setWithOpenBalance(e.target.checked)}
              color="primary"
              size="small"
            />
          }
          label={i18n.t("inventorySales.customers.filters.withOpenBalance")}
        />
        <FormControlLabel
          control={
            <Switch
              checked={withOverdue}
              onChange={(e) => setWithOverdue(e.target.checked)}
              color="primary"
              size="small"
            />
          }
          label={i18n.t("inventorySales.customers.filters.withOverdue")}
        />
      </div>

      {loading && customers.length === 0 ? (
        <AppLoadingState message={i18n.t("inventorySales.common.loading")} />
      ) : loadError && customers.length === 0 ? (
        <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
          <AppSecondaryButton onClick={load}>
            {i18n.t("inventorySales.common.retry")}
          </AppSecondaryButton>
        </AppEmptyState>
      ) : customers.length === 0 ? (
        <AppEmptyState
          title={i18n.t("inventorySales.customers.emptyTitle")}
          description={i18n.t("inventorySales.customers.emptyDescription")}
        >
          {perms.canManageCustomers ? (
            <AppPrimaryButton onClick={openCreate}>
              {i18n.t("inventorySales.customers.new")}
            </AppPrimaryButton>
          ) : null}
        </AppEmptyState>
      ) : isMobile ? (
        <MobileCardList>
          {customers.map((row) => (
            <MobileEntityCard
              key={row.id}
              title={row.name}
              subtitle={[row.document, row.phone].filter(Boolean).join(" · ")}
              onClick={() => setAccountId(row.id)}
              actions={
                <>
                  <IconButton
                    size="small"
                    aria-label={i18n.t("inventorySales.customers.openAccount")}
                    onClick={() => setAccountId(row.id)}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                  {perms.canManageCustomers ? (
                    <IconButton
                      size="small"
                      aria-label={i18n.t("inventorySales.customers.edit")}
                      onClick={() => openEdit(row)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </>
              }
            >
              {perms.canViewCustomerFinancials && row.credit ? (
                <Typography variant="body2">
                  {i18n.t("inventorySales.customers.columns.creditAvailable")}:{" "}
                  {formatCurrencyBRL(row.credit.creditAvailable)}
                </Typography>
              ) : null}
              <Chip
                size="small"
                label={
                  row.isActive
                    ? i18n.t("inventorySales.common.active")
                    : i18n.t("inventorySales.common.inactive")
                }
              />
            </MobileEntityCard>
          ))}
        </MobileCardList>
      ) : (
        <AppSectionCard variant="outlined">
          <AppTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    {i18n.t("inventorySales.customers.columns.name")}
                  </TableCell>
                  <TableCell>
                    {i18n.t("inventorySales.customers.columns.document")}
                  </TableCell>
                  <TableCell>
                    {i18n.t("inventorySales.customers.columns.phone")}
                  </TableCell>
                  {perms.canViewCustomerFinancials ? (
                    <>
                      <TableCell align="right">
                        {i18n.t("inventorySales.customers.columns.creditLimit")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.customers.columns.creditUsed")}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t(
                          "inventorySales.customers.columns.creditAvailable"
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {i18n.t("inventorySales.customers.columns.overdue")}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell>
                    {i18n.t("inventorySales.customers.columns.status")}
                  </TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.common.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <AppTableRowSkeleton
                    columns={perms.canViewCustomerFinancials ? 9 : 5}
                  />
                ) : (
                  customers.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.document || "—"}</TableCell>
                      <TableCell>{row.phone || "—"}</TableCell>
                      {perms.canViewCustomerFinancials ? (
                        <>
                          <TableCell align="right">
                            {formatCurrencyBRL(row.credit?.creditLimit)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrencyBRL(row.credit?.creditUsed)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrencyBRL(row.credit?.creditAvailable)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrencyBRL(row.credit?.overdueOpenAmount)}
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell>
                        <Chip
                          size="small"
                          color={row.isActive ? "primary" : "default"}
                          label={
                            row.isActive
                              ? i18n.t("inventorySales.common.active")
                              : i18n.t("inventorySales.common.inactive")
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label={i18n.t(
                            "inventorySales.customers.openAccount"
                          )}
                          onClick={() => setAccountId(row.id)}
                          data-testid={`customer-open-${row.id}`}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        {perms.canManageCustomers ? (
                          <IconButton
                            size="small"
                            aria-label={i18n.t(
                              "inventorySales.customers.edit"
                            )}
                            onClick={() => openEdit(row)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </AppTableContainer>
        </AppSectionCard>
      )}

      {count > 0 ? (
        <div className={classes.paginationRow}>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("inventorySales.customers.count", { count })}
          </Typography>
          <Box>
            <IconButton
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              disabled={!hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </div>
      ) : null}

      <InventoryCustomerFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customer={editing}
        canManageCustomerCredit={perms.canManageCustomerCredit}
        onSaved={() => {
          load();
        }}
      />

      <InventoryCustomerAccountDialog
        open={accountId != null}
        customerId={accountId}
        onClose={() => setAccountId(null)}
        onChanged={load}
        onEdit={(cust) => {
          setAccountId(null);
          openEdit(cust);
        }}
        onReceive={
          perms.canReceiveReceivables && onNavigateReceivables
            ? (cust) => {
                setAccountId(null);
                onNavigateReceivables(cust?.id);
              }
            : undefined
        }
        canManageCustomers={perms.canManageCustomers}
        canViewFinancials={perms.canViewCustomerFinancials}
      />
    </Box>
  );
}
