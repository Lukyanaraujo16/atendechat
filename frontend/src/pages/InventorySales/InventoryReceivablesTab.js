import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
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
import SearchIcon from "@material-ui/icons/Search";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import VisibilityIcon from "@material-ui/icons/Visibility";
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
import ConfirmationModal from "../../components/ConfirmationModal";
import {
  createInventoryReceivablePayment,
  getInventoryReceivable,
  getInventoryReceivablesSummary,
  listInventoryReceivables,
  reverseInventoryReceivablePayment,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import {
  RECEIVABLE_BUCKETS,
  RECEIVABLE_COLLECTION_METHODS,
  RECEIVABLE_STATUSES,
} from "./constants";
import CurrencyInput from "./CurrencyInput";
import { printReceivablePaymentReceipt } from "./printReceivablePaymentReceipt";
import { formatReceivablePaymentHistoryLine } from "./receivablePaymentDisplay";
import {
  combineCivilDateWithLocalClockToIso,
  formatCivilDueDate,
  formatStoreCreditInstallmentPreviewLine,
  todayCivilDate,
} from "./storeCreditInstallmentDisplay";

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
  statCard: {
    padding: theme.spacing(2),
    borderRadius: 14,
    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
    height: "100%",
    cursor: "pointer",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
  statValue: {
    fontSize: "1.25rem",
    fontWeight: 700,
    marginTop: 4,
  },
  paginationRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing(2),
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

function formatDue(value) {
  return formatCivilDueDate(value);
}

function statusLabel(status) {
  return i18n.t(`inventorySales.receivables.status.${status}`, status);
}

function methodLabel(method) {
  return i18n.t(`inventorySales.sales.paymentMethods.${method}`, method);
}

export default function InventoryReceivablesTab({
  initialCustomerId = "",
}) {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const perms = useInventoryPermissions();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [bucket, setBucket] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [customerId, setCustomerId] = useState(
    initialCustomerId != null ? String(initialCustomerId) : ""
  );

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveReceivableId, setReceiveReceivableId] = useState(null);
  const [receiveAmount, setReceiveAmount] = useState(0);
  const [receiveMethod, setReceiveMethod] = useState("pix");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receivePaidAt, setReceivePaidAt] = useState("");
  const [receiveInstallmentIds, setReceiveInstallmentIds] = useState([]);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);

  const [reversePaymentId, setReversePaymentId] = useState(null);
  const [reverseReason, setReverseReason] = useState("");

  useEffect(() => {
    if (initialCustomerId != null && initialCustomerId !== "") {
      setCustomerId(String(initialCustomerId));
    }
  }, [initialCustomerId]);

  const loadSummary = useCallback(async () => {
    try {
      const params = {};
      if (customerId) params.customerId = customerId;
      const { data } = await getInventoryReceivablesSummary(params);
      setSummary(data);
    } catch (err) {
      toastError(err);
    }
  }, [customerId]);

  const loadList = useCallback(async () => {
    if (!perms.canViewReceivables) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const params = { page, limit };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      if (bucket) params.bucket = bucket;
      if (dueFrom) params.dueFrom = dueFrom;
      if (dueTo) params.dueTo = dueTo;
      if (customerId) params.customerId = customerId;
      const { data } = await listInventoryReceivables(params);
      setRows(Array.isArray(data?.installments) ? data.installments : []);
      setCount(data?.count ?? 0);
    } catch (err) {
      setLoadError(true);
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [
    perms.canViewReceivables,
    page,
    limit,
    search,
    status,
    bucket,
    dueFrom,
    dueTo,
    customerId,
  ]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const t = setTimeout(loadList, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadList, search]);

  useEffect(() => {
    setPage(1);
  }, [search, status, bucket, dueFrom, dueTo, customerId]);

  const openDetail = async (receivableId) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const { data } = await getInventoryReceivable(receivableId);
      setDetail(data);
    } catch (err) {
      toastError(err);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const openReceive = async (row) => {
    const receivableId = row.receivableId || row.id;
    setReceiveReceivableId(receivableId);
    setReceiveMethod("pix");
    setReceiveNotes("");
    setReceivePaidAt(todayCivilDate());
    setReceiveInstallmentIds(
      row.installmentId != null ? [row.installmentId] : []
    );
    setReceiveAmount(Number(row.openAmount) > 0 ? Number(row.openAmount) : 0);
    if (!row.openAmount) {
      try {
        const { data } = await getInventoryReceivable(receivableId);
        setDetail(data);
        setReceiveAmount(Number(data.openAmount) || 0);
      } catch (err) {
        toastError(err);
        return;
      }
    }
    setReceiveOpen(true);
  };

  const submitReceive = async () => {
    if (!(receiveAmount > 0)) {
      toast.error(i18n.t("inventorySales.receivables.validation.amount"));
      return;
    }
    if (!receiveMethod) {
      toast.error(i18n.t("inventorySales.receivables.validation.method"));
      return;
    }
    // DATA = civil escolhida (type=date). HORA = relógio local na confirmação.
    // Evita new Date("YYYY-MM-DD") (UTC midnight → dia errado em BR).
    let paidAtIso = null;
    if (receivePaidAt) {
      paidAtIso = combineCivilDateWithLocalClockToIso(receivePaidAt);
      if (!paidAtIso) {
        toast.error(i18n.t("inventorySales.receivables.validation.paidAt"));
        return;
      }
    }
    setReceiveSubmitting(true);
    try {
      const body = {
        amount: receiveAmount,
        paymentMethod: receiveMethod,
        notes: receiveNotes.trim() || null,
      };
      if (paidAtIso) body.paidAt = paidAtIso;
      if (receiveInstallmentIds.length) {
        body.installmentIds = receiveInstallmentIds;
      }
      const { data: updated } = await createInventoryReceivablePayment(
        receiveReceivableId,
        body
      );
      toast.success(i18n.t("inventorySales.receivables.toasts.received"));
      try {
        const allocs = Array.isArray(updated?.lastPaymentAllocations)
          ? updated.lastPaymentAllocations
          : [];
        const received =
          updated?.receivedAmount != null
            ? Number(updated.receivedAmount)
            : receiveAmount;
        const remainingOpen =
          updated?.openAmount != null ? Number(updated.openAmount) : null;
        const previousOpen =
          remainingOpen != null && Number.isFinite(received)
            ? Math.round((remainingOpen + received) * 100) / 100
            : null;
        const payments = Array.isArray(updated?.payments)
          ? updated.payments
          : [];
        const lastPay = [...payments]
          .reverse()
          .find((p) => !p.reverseOfPaymentId);
        const saleNumber =
          updated?.sale?.saleNumber ?? detail?.sale?.saleNumber ?? null;
        await printReceivablePaymentReceipt({
          customerName:
            updated?.customer?.name || detail?.customer?.name || "",
          customerDocument:
            updated?.customer?.document || detail?.customer?.document || "",
          amount: received,
          paymentMethod: receiveMethod,
          paidAt:
            lastPay?.paidAt ||
            body.paidAt ||
            new Date().toISOString(),
          notes: body.notes,
          remainingOpenAmount: remainingOpen,
          previousOpenAmount: previousOpen,
          saleNumber,
          operatorName: lastPay?.createdByUser?.name || null,
          paymentId: lastPay?.id ?? null,
          allocations: allocs.map((a) => ({
            saleNumber,
            sequence: a.sequence,
            dueDate: a.dueDate,
            amount: a.amount,
            openAmountAfter: a.openAmountAfter,
          })),
        });
      } catch (_) {
        /* print é best-effort */
      }
      setReceiveOpen(false);
      setDetailOpen(false);
      loadSummary();
      loadList();
    } catch (err) {
      toastError(err);
    } finally {
      setReceiveSubmitting(false);
    }
  };

  const confirmReverse = async () => {
    if (!reversePaymentId) return;
    try {
      await reverseInventoryReceivablePayment(reversePaymentId, {
        reason: reverseReason.trim() || null,
      });
      toast.success(i18n.t("inventorySales.receivables.toasts.reversed"));
      setReversePaymentId(null);
      setReverseReason("");
      if (detail?.id) {
        const { data } = await getInventoryReceivable(detail.id);
        setDetail(data);
      }
      loadSummary();
      loadList();
    } catch (err) {
      toastError(err);
    }
  };

  if (!perms.canViewReceivables) {
    return (
      <AppEmptyState
        title={i18n.t("inventorySales.permissions.noTabAccessTitle")}
        description={i18n.t("inventorySales.permissions.noTabAccessDescription")}
      />
    );
  }

  const hasMore = page * limit < count;

  return (
    <Box data-testid="inventory-receivables-tab">
      <div className={classes.headerRow}>
        <Typography variant="h6" style={{ fontWeight: 600 }}>
          {i18n.t("inventorySales.receivables.title")}
        </Typography>
      </div>

      <Grid container spacing={2} style={{ marginBottom: 16 }}>
        {[
          ["open", summary?.openAmount, ""],
          ["overdue", summary?.overdueAmount, "overdue"],
          ["dueToday", summary?.dueTodayAmount, "today"],
          ["next7", summary?.next7DaysAmount, "next7"],
        ].map(([key, value, bucketKey]) => (
          <Grid item xs={6} sm={3} key={key}>
            <Paper
              className={classes.statCard}
              elevation={0}
              onClick={() => setBucket(bucketKey)}
              data-testid={`receivables-summary-${key}`}
            >
              <Typography className={classes.statLabel}>
                {i18n.t(`inventorySales.receivables.summary.${key}`)}
              </Typography>
              <Typography className={classes.statValue}>
                {formatCurrencyBRL(value)}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <div className={classes.filtersRow}>
        <TextField
          size="small"
          variant="outlined"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={i18n.t("inventorySales.receivables.search")}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          style={{ minWidth: 220, flex: 1, maxWidth: 360 }}
          inputProps={{ "data-testid": "inventory-receivables-search" }}
        />
        <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
          <InputLabel>
            {i18n.t("inventorySales.receivables.filters.status")}
          </InputLabel>
          <Select
            label={i18n.t("inventorySales.receivables.filters.status")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <MenuItem value="">{i18n.t("inventorySales.common.all")}</MenuItem>
            {RECEIVABLE_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {statusLabel(s)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" size="small" style={{ minWidth: 140 }}>
          <InputLabel>
            {i18n.t("inventorySales.receivables.filters.bucket")}
          </InputLabel>
          <Select
            label={i18n.t("inventorySales.receivables.filters.bucket")}
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
          >
            <MenuItem value="">{i18n.t("inventorySales.common.all")}</MenuItem>
            {RECEIVABLE_BUCKETS.map((b) => (
              <MenuItem key={b} value={b}>
                {i18n.t(`inventorySales.receivables.filters.buckets.${b}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          variant="outlined"
          type="date"
          label={i18n.t("inventorySales.receivables.filters.dueFrom")}
          value={dueFrom}
          onChange={(e) => setDueFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          variant="outlined"
          type="date"
          label={i18n.t("inventorySales.receivables.filters.dueTo")}
          value={dueTo}
          onChange={(e) => setDueTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </div>

      {loading && rows.length === 0 ? (
        <AppLoadingState message={i18n.t("inventorySales.common.loading")} />
      ) : loadError && rows.length === 0 ? (
        <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
          <AppSecondaryButton onClick={loadList}>
            {i18n.t("inventorySales.common.retry")}
          </AppSecondaryButton>
        </AppEmptyState>
      ) : rows.length === 0 ? (
        <AppEmptyState
          title={i18n.t("inventorySales.receivables.emptyTitle")}
          description={i18n.t("inventorySales.receivables.emptyDescription")}
        />
      ) : isMobile ? (
        <MobileCardList>
          {rows.map((row) => (
            <MobileEntityCard
              key={row.installmentId}
              title={row.customerName || "—"}
              subtitle={`${formatDue(row.dueDate)} · ${statusLabel(
                row.displayStatus
              )}`}
              onClick={() => openDetail(row.receivableId)}
            >
              <Typography variant="body2">
                {formatCurrencyBRL(row.openAmount)}
              </Typography>
              {perms.canReceiveReceivables && row.openAmount > 0 ? (
                <AppPrimaryButton
                  size="small"
                  onClick={() => openReceive(row)}
                >
                  {i18n.t("inventorySales.receivables.receive")}
                </AppPrimaryButton>
              ) : null}
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
                    {i18n.t("inventorySales.receivables.columns.customer")}
                  </TableCell>
                  <TableCell>
                    {i18n.t("inventorySales.receivables.columns.sale")}
                  </TableCell>
                  <TableCell>
                    {i18n.t("inventorySales.receivables.columns.installment")}
                  </TableCell>
                  <TableCell>
                    {i18n.t("inventorySales.receivables.columns.dueDate")}
                  </TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.receivables.columns.original")}
                  </TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.receivables.columns.paid")}
                  </TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.receivables.columns.open")}
                  </TableCell>
                  <TableCell>
                    {i18n.t("inventorySales.receivables.columns.status")}
                  </TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.common.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <AppTableRowSkeleton columns={9} />
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.installmentId} hover>
                      <TableCell>{row.customerName || "—"}</TableCell>
                      <TableCell>
                        {row.saleNumber != null ? `#${row.saleNumber}` : "—"}
                      </TableCell>
                      <TableCell>{row.sequence}</TableCell>
                      <TableCell>{formatDue(row.dueDate)}</TableCell>
                      <TableCell align="right">
                        {formatCurrencyBRL(row.originalAmount)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrencyBRL(row.paidAmount)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrencyBRL(row.openAmount)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={
                            row.displayStatus === "overdue"
                              ? "secondary"
                              : "default"
                          }
                          label={statusLabel(row.displayStatus)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => openDetail(row.receivableId)}
                          aria-label={i18n.t(
                            "inventorySales.receivables.detail"
                          )}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        {perms.canReceiveReceivables && row.openAmount > 0 ? (
                          <AppPrimaryButton
                            size="small"
                            onClick={() => openReceive(row)}
                            data-testid={`receivable-receive-${row.installmentId}`}
                          >
                            {i18n.t("inventorySales.receivables.receive")}
                          </AppPrimaryButton>
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
            {i18n.t("inventorySales.receivables.count", { count })}
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

      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        fullWidth
        maxWidth="md"
        data-testid="receivable-detail-dialog"
      >
        <DialogTitle>
          {i18n.t("inventorySales.receivables.detail.title")}
        </DialogTitle>
        <DialogContent>
          {detailLoading || !detail ? (
            <AppLoadingState message={i18n.t("inventorySales.common.loading")} />
          ) : (
            <>
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                {detail.customer?.name}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                {detail.sale?.saleNumber != null
                  ? `#${detail.sale.saleNumber}`
                  : ""}{" "}
                · {formatCurrencyBRL(detail.openAmount)}{" "}
                {i18n.t("inventorySales.receivables.columns.open").toLowerCase()}
              </Typography>
              <Typography variant="subtitle2" style={{ marginTop: 12 }}>
                {i18n.t("inventorySales.receivables.detail.installments")}
              </Typography>
              {(detail.installments || []).map((inst) => (
                <Box
                  key={inst.id}
                  display="flex"
                  justifyContent="space-between"
                  py={0.5}
                >
                  <Typography variant="body2">
                    {i18n.t(
                      "inventorySales.sales.wizard.payment.installmentLine",
                      { n: inst.sequence }
                    )}{" "}
                    · {formatDue(inst.dueDate)} ·{" "}
                    {statusLabel(inst.displayStatus)}
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrencyBRL(inst.openAmount)}
                  </Typography>
                </Box>
              ))}
              <Typography variant="subtitle2" style={{ marginTop: 12 }}>
                {i18n.t("inventorySales.receivables.detail.payments")}
              </Typography>
              {(detail.payments || []).length === 0 ? (
                <Typography variant="body2" color="textSecondary">
                  {i18n.t("inventorySales.receivables.detail.noPayments")}
                </Typography>
              ) : (
                (detail.payments || []).map((p) => (
                  <Box
                    key={p.id}
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    py={0.5}
                  >
                    <Typography
                      variant="body2"
                      data-testid={`receivable-payment-line-${p.id}`}
                    >
                      {formatReceivablePaymentHistoryLine(p, {
                        includeOperator: true,
                        includeNotes: true,
                      })}
                    </Typography>
                    {perms.canReverseReceivablePayments &&
                    !p.reversedAt &&
                    !p.reverseOfPaymentId ? (
                      <AppSecondaryButton
                        size="small"
                        onClick={() => setReversePaymentId(p.id)}
                      >
                        {i18n.t("inventorySales.receivables.reverse")}
                      </AppSecondaryButton>
                    ) : null}
                  </Box>
                ))
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton onClick={() => setDetailOpen(false)}>
            {i18n.t("inventorySales.common.cancel")}
          </AppSecondaryButton>
          {perms.canReceiveReceivables && detail?.openAmount > 0 ? (
            <AppPrimaryButton
              onClick={() =>
                openReceive({
                  receivableId: detail.id,
                  openAmount: detail.openAmount,
                })
              }
            >
              {i18n.t("inventorySales.receivables.receive")}
            </AppPrimaryButton>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog
        open={receiveOpen}
        onClose={() => !receiveSubmitting && setReceiveOpen(false)}
        fullWidth
        maxWidth="xs"
        data-testid="receivable-receive-dialog"
      >
        <DialogTitle>
          {i18n.t("inventorySales.receivables.receiveDialog.title")}
        </DialogTitle>
        <DialogContent>
          <Box className={classes.formStack}>
            <CurrencyInput
              label={i18n.t("inventorySales.receivables.receiveDialog.amount")}
              value={receiveAmount}
              onChange={setReceiveAmount}
              disabled={receiveSubmitting}
              fullWidth
              size="small"
              variant="outlined"
            />
            <FormControl variant="outlined" size="small" fullWidth>
              <InputLabel>
                {i18n.t("inventorySales.receivables.receiveDialog.method")}
              </InputLabel>
              <Select
                label={i18n.t(
                  "inventorySales.receivables.receiveDialog.method"
                )}
                value={receiveMethod}
                onChange={(e) => setReceiveMethod(e.target.value)}
                disabled={receiveSubmitting}
              >
                {RECEIVABLE_COLLECTION_METHODS.map((m) => (
                  <MenuItem key={m} value={m}>
                    {methodLabel(m)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              type="date"
              label={i18n.t("inventorySales.receivables.receiveDialog.paidAt")}
              value={receivePaidAt}
              onChange={(e) => setReceivePaidAt(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              disabled={receiveSubmitting}
              inputProps={{
                "data-testid": "receivable-receive-paid-at",
              }}
            />
            {detail?.installments?.length ? (
              <Box>
                <Typography variant="caption" color="textSecondary">
                  {i18n.t(
                    "inventorySales.receivables.receiveDialog.selectInstallments"
                  )}
                </Typography>
                <Typography variant="caption" display="block" gutterBottom>
                  {i18n.t("inventorySales.receivables.receiveDialog.allOpen")}
                </Typography>
                {detail.installments
                  .filter((i) => i.openAmount > 0)
                  .map((inst) => (
                    <FormControlLabel
                      key={inst.id}
                      control={
                        <Checkbox
                          checked={receiveInstallmentIds.includes(inst.id)}
                          onChange={(e) => {
                            setReceiveInstallmentIds((prev) =>
                              e.target.checked
                                ? [...prev, inst.id]
                                : prev.filter((id) => id !== inst.id)
                            );
                          }}
                          color="primary"
                          size="small"
                        />
                      }
                      label={formatStoreCreditInstallmentPreviewLine({
                        sequence: inst.sequence,
                        dueDate: inst.dueDate,
                        amount: inst.openAmount,
                      })}
                    />
                  ))}
              </Box>
            ) : null}
            <TextField
              label={i18n.t("inventorySales.receivables.receiveDialog.notes")}
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
              multiline
              rows={2}
              disabled={receiveSubmitting}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton
            onClick={() => setReceiveOpen(false)}
            disabled={receiveSubmitting}
          >
            {i18n.t("inventorySales.common.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton
            onClick={submitReceive}
            disabled={receiveSubmitting}
            data-testid="receivable-receive-submit"
          >
            {i18n.t("inventorySales.receivables.receiveDialog.confirm")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        open={reversePaymentId != null}
        onClose={() => {
          setReversePaymentId(null);
          setReverseReason("");
        }}
        onConfirm={confirmReverse}
        title={i18n.t("inventorySales.receivables.reverseDialog.title")}
        destructive
      >
        <Typography gutterBottom>
          {i18n.t("inventorySales.receivables.reverseDialog.message")}
        </Typography>
        <TextField
          label={i18n.t("inventorySales.receivables.reverseDialog.reason")}
          value={reverseReason}
          onChange={(e) => setReverseReason(e.target.value)}
          variant="outlined"
          size="small"
          fullWidth
          multiline
          rows={2}
        />
      </ConfirmationModal>
    </Box>
  );
}
