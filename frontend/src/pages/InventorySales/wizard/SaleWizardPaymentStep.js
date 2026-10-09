import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import {
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../../ui";
import { formatCurrencyBRL } from "../../../utils/brazilianCurrency";
import { i18n } from "../../../translate/i18n";
import toastError from "../../../errors/toastError";
import {
  addInventorySalePayment,
  deleteInventorySalePaymentLine,
  getInventoryCustomerCredit,
  getInventorySalePayments,
  previewInventoryStoreCreditSchedule,
  settleInventorySalePaymentLine,
} from "../../../services/inventoryApi";
import { PAYMENT_METHODS, STORE_CREDIT_FREQUENCIES } from "../constants";
import {
  CARD_INSTALLMENT_OPTIONS,
  formatCardInstallmentCaption,
} from "../cardInstallments";
import { defaultPaymentStatusForMethod } from "../paymentDisplay";
import CurrencyInput from "../CurrencyInput";
import { useInventoryPermissions } from "../../../utils/inventoryAccess";
import { formatStoreCreditInstallmentPreviewLine } from "../storeCreditInstallmentDisplay";
import SaleGlobalDiscountEditor from "../SaleGlobalDiscountEditor";
import { resolvePaymentSummaryDisplay } from "../paymentSummaryDisplay";
import SaleWizardTotals from "./SaleWizardTotals";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  title: {
    fontWeight: 700,
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing(1.5),
    [theme.breakpoints.up("sm")]: {
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    },
  },
  summaryItem: {
    minWidth: 0,
  },
  summaryLabel: {
    color: theme.palette.text.secondary,
    fontSize: "0.75rem",
  },
  summaryValue: {
    fontWeight: 700,
    fontSize: "1.05rem",
  },
  remaining: {
    color: theme.palette.primary.main,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  rowMain: {
    minWidth: 0,
    flex: 1,
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  statusPaid: {
    color: theme.palette.success.main,
    fontWeight: 600,
    fontSize: "0.8rem",
  },
  statusPending: {
    color: theme.palette.warning.dark,
    fontWeight: 600,
    fontSize: "0.8rem",
  },
  empty: {
    padding: theme.spacing(3, 0),
    color: theme.palette.text.secondary,
  },
  readonly: {
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

function methodLabel(method) {
  return i18n.t(`inventorySales.sales.paymentMethods.${method}`, method);
}

function todayCivilDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function paymentLineCaption(payment) {
  const base = methodLabel(payment.method);
  if (payment.method === "credit_card" && payment.cardInstallmentCount) {
    return `${base} · ${formatCardInstallmentCaption(
      payment.cardInstallmentCount,
      payment.amount
    )}`;
  }
  return base;
}

export default function SaleWizardPaymentStep({
  sale,
  canManagePayments,
  disabled,
  paymentsBundle,
  setPaymentsBundle,
  onSaleCacheMaybeChanged,
  customerId,
  storeCreditSchedule,
  setStoreCreditSchedule,
  storeCreditOverride,
  setStoreCreditOverride,
  onSaleUpdated,
  canApplyDiscount = true,
}) {
  const classes = useStyles();
  const perms = useInventoryPermissions();
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const submitLock = useRef(false);

  const [formMethod, setFormMethod] = useState("cash");
  const [formAmount, setFormAmount] = useState(0);
  const [formStatus, setFormStatus] = useState("paid");
  const [formInstallments, setFormInstallments] = useState("1");
  const [formNotes, setFormNotes] = useState("");

  const [creditSummary, setCreditSummary] = useState(null);
  const [schedulePreview, setSchedulePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** Rascunho textual p/ digitar Nº parcelas sem clamp forçar 1 no meio da digitação. */
  const [installmentCountDraft, setInstallmentCountDraft] = useState("");
  const [installmentCountFocused, setInstallmentCountFocused] = useState(false);

  const summary = resolvePaymentSummaryDisplay(
    sale,
    paymentsBundle?.summary
  );
  const payments = Array.isArray(paymentsBundle?.payments)
    ? paymentsBundle.payments
    : [];

  const storeCreditLines = payments.filter((p) => p.method === "store_credit");
  const storeCreditAmount = storeCreditLines.reduce(
    (acc, p) => acc + Number(p.amount || 0),
    0
  );
  const hasStoreCredit = storeCreditAmount > 0;

  const canOfferStoreCredit =
    perms.canUseStoreCredit === true && Boolean(customerId);
  const showDisabledStoreCreditHint =
    perms.canUseStoreCredit === true && !customerId;
  const availableMethods = PAYMENT_METHODS.filter((method) => {
    if (method !== "store_credit") return true;
    return canOfferStoreCredit;
  });

  const loadPayments = useCallback(
    async ({ quiet = false } = {}) => {
      if (!sale?.id || !canManagePayments) {
        setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      try {
        const { data } = await getInventorySalePayments(sale.id);
        setPaymentsBundle(data);
      } catch (err) {
        toastError(err);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [sale?.id, canManagePayments, setPaymentsBundle]
  );

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Após desconto global / totais da venda mudarem, reidrata o summary
  // sem spinner (display já usa sale.totalAmount via resolvePaymentSummaryDisplay).
  useEffect(() => {
    if (!sale?.id || !canManagePayments) return;
    const summaryTotal = Number(paymentsBundle?.summary?.totalAmount);
    const saleTotal = Number(sale?.totalAmount);
    if (paymentsBundle?.summary == null) return;
    if (
      Number.isFinite(summaryTotal) &&
      Number.isFinite(saleTotal) &&
      Math.round(summaryTotal * 100) === Math.round(saleTotal * 100)
    ) {
      return;
    }
    loadPayments({ quiet: true });
    // Intencional: não depender de paymentsBundle (evita loop). Display já usa sale.totalAmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sale?.id,
    sale?.totalAmount,
    sale?.globalDiscountAmount,
    sale?.globalDiscountType,
    sale?.globalDiscountPercent,
    canManagePayments,
    loadPayments,
  ]);

  const handleGlobalDiscountUpdated = useCallback(async () => {
    if (onSaleUpdated) await onSaleUpdated();
    await loadPayments({ quiet: true });
  }, [onSaleUpdated, loadPayments]);

  useEffect(() => {
    if (!hasStoreCredit || !customerId) {
      setCreditSummary(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getInventoryCustomerCredit(customerId);
        if (!cancelled) setCreditSummary(data);
      } catch (err) {
        if (!cancelled) toastError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasStoreCredit, customerId]);

  useEffect(() => {
    if (!hasStoreCredit || !setStoreCreditSchedule) return;
    if (!storeCreditSchedule?.firstDueDate) {
      setStoreCreditSchedule({
        frequency: storeCreditSchedule?.frequency || "monthly",
        installmentCount: storeCreditSchedule?.installmentCount || 1,
        firstDueDate: todayCivilDate(),
      });
    }
  }, [hasStoreCredit, setStoreCreditSchedule, storeCreditSchedule]);

  useEffect(() => {
    if (!hasStoreCredit) {
      setInstallmentCountDraft("");
      return;
    }
    // Não sobrescrever enquanto o operador digita (pai pode não ter recomputado ainda).
    if (installmentCountFocused) return;
    const n = Number(storeCreditSchedule?.installmentCount);
    if (Number.isFinite(n) && n >= 1) {
      setInstallmentCountDraft(String(n));
    }
  }, [
    hasStoreCredit,
    storeCreditSchedule?.installmentCount,
    installmentCountFocused,
  ]);

  const commitInstallmentCount = (raw) => {
    const digits = String(raw ?? "").replace(/\D/g, "");
    let n = digits === "" ? 1 : Number(digits);
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > 48) n = 48;
    setInstallmentCountDraft(String(n));
    setStoreCreditSchedule((prev) => ({
      ...(prev || {}),
      installmentCount: n,
    }));
  };

  useEffect(() => {
    if (
      !hasStoreCredit ||
      !(storeCreditAmount > 0) ||
      !storeCreditSchedule?.frequency ||
      !storeCreditSchedule?.firstDueDate ||
      !storeCreditSchedule?.installmentCount
    ) {
      setSchedulePreview(null);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const { data } = await previewInventoryStoreCreditSchedule({
          financedAmount: storeCreditAmount,
          frequency: storeCreditSchedule.frequency,
          installmentCount: Number(storeCreditSchedule.installmentCount),
          firstDueDate: storeCreditSchedule.firstDueDate,
          customerId: customerId ? Number(customerId) : undefined,
        });
        if (!cancelled) setSchedulePreview(data);
      } catch (err) {
        if (!cancelled) {
          setSchedulePreview(null);
          toastError(err);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [hasStoreCredit, storeCreditAmount, storeCreditSchedule, customerId]);

  const openAddDialog = () => {
    const remaining = Number(summary?.remainingToAllocate ?? sale?.totalAmount ?? 0);
    setFormMethod("cash");
    setFormAmount(remaining > 0 ? remaining : 0);
    setFormStatus("paid");
    setFormInstallments("1");
    setFormNotes("");
    setDialogOpen(true);
  };

  const handleMethodChange = (method) => {
    setFormMethod(method);
    const nextStatus =
      method === "credit_card" ? "paid" : defaultPaymentStatusForMethod(method);
    setFormStatus(nextStatus);
    if (method !== "credit_card") setFormInstallments("1");
  };

  const handleAdd = async () => {
    if (submitLock.current || submitting || !sale?.id) return;
    if (!(formAmount > 0)) {
      return;
    }
    if (formMethod === "store_credit" && !customerId) {
      toast.error(
        i18n.t("inventorySales.sales.wizard.payment.storeCreditNeedsCustomer")
      );
      return;
    }
    if (formMethod === "credit_card") {
      const count = Number(formInstallments);
      if (!Number.isInteger(count) || count < 1 || count > 18) return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const body = {
        method: formMethod,
        amount: formAmount,
        status:
          formMethod === "credit_card" || formMethod === "store_credit"
            ? formMethod === "store_credit"
              ? "pending"
              : "paid"
            : formStatus,
        notes: formNotes.trim() || null,
      };
      if (formMethod === "credit_card") {
        body.cardInstallmentCount = Number(formInstallments);
      }
      const { data } = await addInventorySalePayment(sale.id, body);
      setPaymentsBundle(data);
      setDialogOpen(false);
      if (onSaleCacheMaybeChanged) await onSaleCacheMaybeChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  const handleDelete = async (payment) => {
    if (payment.status !== "pending" || busyId != null) return;
    setBusyId(payment.id);
    try {
      const { data } = await deleteInventorySalePaymentLine(sale.id, payment.id);
      setPaymentsBundle(data);
      if (onSaleCacheMaybeChanged) await onSaleCacheMaybeChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleSettle = async (payment) => {
    if (payment.status !== "pending" || busyId != null) return;
    setBusyId(payment.id);
    try {
      const { data } = await settleInventorySalePaymentLine(sale.id, payment.id);
      setPaymentsBundle(data);
      if (onSaleCacheMaybeChanged) await onSaleCacheMaybeChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setBusyId(null);
    }
  };

  if (!canManagePayments) {
    return (
      <Box className={classes.root} data-testid="sale-wizard-payment-step">
        <Typography variant="h5" className={classes.title}>
          {i18n.t("inventorySales.sales.wizard.payment.titleSplit")}
        </Typography>
        <Box className={classes.readonly}>
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            {i18n.t("inventorySales.sales.wizard.payment.noPermissionTitle")}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("inventorySales.sales.wizard.payment.noPermissionBody")}
          </Typography>
        </Box>
      </Box>
    );
  }

  const itemCount = Array.isArray(sale?.items) ? sale.items.length : 0;

  return (
    <Box className={classes.root} data-testid="sale-wizard-payment-step">
      <Typography variant="h5" className={classes.title}>
        {i18n.t("inventorySales.sales.wizard.payment.titleSplit")}
      </Typography>

      <SaleGlobalDiscountEditor
        sale={sale}
        disabled={disabled}
        canApplyDiscount={canApplyDiscount}
        onSaleUpdated={handleGlobalDiscountUpdated}
      />

      <SaleWizardTotals sale={sale} itemCount={itemCount} dense />

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          <Box className={classes.summary} data-testid="sale-wizard-payment-summary">
            <Box className={classes.summaryItem}>
              <Typography className={classes.summaryLabel}>
                {i18n.t("inventorySales.sales.wizard.payment.total")}
              </Typography>
              <Typography
                className={classes.summaryValue}
                data-testid="sale-wizard-payment-total"
              >
                {formatCurrencyBRL(summary.totalAmount)}
              </Typography>
            </Box>
            <Box className={classes.summaryItem}>
              <Typography className={classes.summaryLabel}>
                {i18n.t("inventorySales.sales.wizard.payment.received")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {formatCurrencyBRL(summary?.effectivePaid ?? 0)}
              </Typography>
            </Box>
            <Box className={classes.summaryItem}>
              <Typography className={classes.summaryLabel}>
                {i18n.t("inventorySales.sales.wizard.payment.pending")}
              </Typography>
              <Typography className={classes.summaryValue}>
                {formatCurrencyBRL(summary?.pendingAmount ?? 0)}
              </Typography>
            </Box>
            <Box className={classes.summaryItem}>
              <Typography className={classes.summaryLabel}>
                {i18n.t("inventorySales.sales.wizard.payment.remaining")}
              </Typography>
              <Typography
                className={`${classes.summaryValue} ${classes.remaining}`}
                data-testid="sale-wizard-payment-remaining"
              >
                {formatCurrencyBRL(summary?.remainingToAllocate ?? 0)}
              </Typography>
            </Box>
          </Box>

          <Box className={classes.list} data-testid="sale-wizard-payment-list">
            {payments.length === 0 ? (
              <Typography className={classes.empty}>
                {i18n.t("inventorySales.sales.wizard.payment.empty")}
              </Typography>
            ) : (
              payments.map((payment) => (
                <Box
                  key={payment.id}
                  className={classes.row}
                  data-testid={`sale-wizard-payment-row-${payment.id}`}
                >
                  <Box className={classes.rowMain}>
                    <Typography style={{ fontWeight: 600 }}>
                      {paymentLineCaption(payment)}
                    </Typography>
                    <Typography variant="body2">
                      {formatCurrencyBRL(payment.amount)}
                    </Typography>
                    <Typography
                      className={
                        payment.status === "paid"
                          ? classes.statusPaid
                          : classes.statusPending
                      }
                    >
                      {payment.status === "paid"
                        ? i18n.t("inventorySales.sales.wizard.payment.statusPaid")
                        : i18n.t(
                            "inventorySales.sales.wizard.payment.statusPending"
                          )}
                    </Typography>
                  </Box>
                  <Box className={classes.rowActions}>
                    {payment.status === "pending" && (
                      <>
                        {payment.method !== "store_credit" ? (
                          <IconButton
                            size="small"
                            aria-label={i18n.t(
                              "inventorySales.sales.wizard.payment.markReceived"
                            )}
                            disabled={disabled || busyId === payment.id}
                            onClick={() => handleSettle(payment)}
                            data-testid={`wizard-payment-settle-${payment.id}`}
                          >
                            {busyId === payment.id ? (
                              <CircularProgress size={18} />
                            ) : (
                              <CheckCircleOutlineIcon fontSize="small" />
                            )}
                          </IconButton>
                        ) : null}
                        <IconButton
                          size="small"
                          aria-label={i18n.t(
                            "inventorySales.sales.wizard.payment.remove"
                          )}
                          disabled={disabled || busyId === payment.id}
                          onClick={() => handleDelete(payment)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                    {payment.status === "paid" && (
                      <Typography variant="caption" color="textSecondary">
                        {i18n.t("inventorySales.sales.wizard.payment.registered")}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))
            )}
          </Box>

          {hasStoreCredit ? (
            <Box
              className={classes.readonly}
              data-testid="sale-wizard-store-credit-panel"
            >
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                {i18n.t(
                  "inventorySales.sales.wizard.payment.storeCreditScheduleTitle"
                )}
              </Typography>
              {!customerId ? (
                <Typography variant="body2" color="error">
                  {i18n.t(
                    "inventorySales.sales.wizard.payment.storeCreditNeedsCustomer"
                  )}
                </Typography>
              ) : null}
              {creditSummary ? (
                <Box className={classes.summary} style={{ marginTop: 12 }}>
                  <Box className={classes.summaryItem}>
                    <Typography className={classes.summaryLabel}>
                      {i18n.t(
                        "inventorySales.sales.wizard.payment.storeCreditLimit"
                      )}
                    </Typography>
                    <Typography className={classes.summaryValue}>
                      {formatCurrencyBRL(creditSummary.creditLimit)}
                    </Typography>
                  </Box>
                  <Box className={classes.summaryItem}>
                    <Typography className={classes.summaryLabel}>
                      {i18n.t(
                        "inventorySales.sales.wizard.payment.storeCreditUsed"
                      )}
                    </Typography>
                    <Typography className={classes.summaryValue}>
                      {formatCurrencyBRL(creditSummary.creditUsed)}
                    </Typography>
                  </Box>
                  <Box className={classes.summaryItem}>
                    <Typography className={classes.summaryLabel}>
                      {i18n.t(
                        "inventorySales.sales.wizard.payment.storeCreditAvailable"
                      )}
                    </Typography>
                    <Typography className={classes.summaryValue}>
                      {formatCurrencyBRL(creditSummary.creditAvailable)}
                    </Typography>
                  </Box>
                  <Box className={classes.summaryItem}>
                    <Typography className={classes.summaryLabel}>
                      {i18n.t(
                        "inventorySales.sales.wizard.payment.storeCreditFinanced"
                      )}
                    </Typography>
                    <Typography className={classes.summaryValue}>
                      {formatCurrencyBRL(storeCreditAmount)}
                    </Typography>
                  </Box>
                </Box>
              ) : null}
              {setStoreCreditSchedule ? (
                <Box className={classes.formStack} style={{ marginTop: 12 }}>
                  <FormControl variant="outlined" fullWidth size="small">
                    <InputLabel>
                      {i18n.t(
                        "inventorySales.sales.wizard.payment.storeCreditFrequency"
                      )}
                    </InputLabel>
                    <Select
                      label={i18n.t(
                        "inventorySales.sales.wizard.payment.storeCreditFrequency"
                      )}
                      value={storeCreditSchedule?.frequency || "monthly"}
                      onChange={(e) =>
                        setStoreCreditSchedule((prev) => ({
                          ...(prev || {}),
                          frequency: e.target.value,
                          installmentCount:
                            e.target.value === "once"
                              ? 1
                              : prev?.installmentCount || 1,
                        }))
                      }
                      disabled={disabled}
                      data-testid="store-credit-frequency"
                    >
                      {STORE_CREDIT_FREQUENCIES.map((freq) => (
                        <MenuItem key={freq} value={freq}>
                          {i18n.t(
                            `inventorySales.sales.wizard.payment.frequencies.${freq}`
                          )}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {storeCreditSchedule?.frequency !== "once" ? (
                    <TextField
                      type="text"
                      label={i18n.t(
                        "inventorySales.sales.wizard.payment.storeCreditInstallments"
                      )}
                      value={
                        installmentCountFocused
                          ? installmentCountDraft
                          : String(
                              installmentCountDraft !== ""
                                ? installmentCountDraft
                                : storeCreditSchedule?.installmentCount || 1
                            )
                      }
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, "");
                        setInstallmentCountDraft(raw);
                        if (raw === "") return;
                        const n = Number(raw);
                        if (!Number.isFinite(n) || n < 1) return;
                        const clamped = Math.min(48, n);
                        setStoreCreditSchedule((prev) => ({
                          ...(prev || {}),
                          installmentCount: clamped,
                        }));
                        if (n > 48) setInstallmentCountDraft("48");
                      }}
                      onFocus={() => {
                        setInstallmentCountFocused(true);
                      }}
                      onBlur={() => {
                        commitInstallmentCount(installmentCountDraft);
                        setInstallmentCountFocused(false);
                      }}
                      variant="outlined"
                      size="small"
                      fullWidth
                      disabled={disabled}
                      inputProps={{
                        inputMode: "numeric",
                        pattern: "[0-9]*",
                        min: 1,
                        max: 48,
                        "data-testid": "store-credit-installments",
                      }}
                    />
                  ) : null}
                  <TextField
                    type="date"
                    label={i18n.t(
                      "inventorySales.sales.wizard.payment.storeCreditFirstDue"
                    )}
                    value={storeCreditSchedule?.firstDueDate || ""}
                    onChange={(e) =>
                      setStoreCreditSchedule((prev) => ({
                        ...(prev || {}),
                        firstDueDate: e.target.value,
                      }))
                    }
                    variant="outlined"
                    size="small"
                    fullWidth
                    disabled={disabled}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ "data-testid": "store-credit-first-due" }}
                  />
                </Box>
              ) : null}
              {previewLoading ? (
                <Box display="flex" justifyContent="center" py={1}>
                  <CircularProgress size={20} />
                </Box>
              ) : schedulePreview?.installments?.length ? (
                <Box mt={1} data-testid="store-credit-preview">
                  <Typography variant="caption" color="textSecondary">
                    {i18n.t(
                      "inventorySales.sales.wizard.payment.storeCreditPreview"
                    )}
                  </Typography>
                  {schedulePreview.installments.map((inst) => (
                    <Typography
                      key={inst.sequence}
                      variant="body2"
                      data-testid={`store-credit-preview-line-${inst.sequence}`}
                    >
                      {formatStoreCreditInstallmentPreviewLine(inst)}
                    </Typography>
                  ))}
                </Box>
              ) : null}
              {perms.canAuthorizeStoreCreditOverride &&
              setStoreCreditOverride ? (
                <Box mt={2}>
                  <Typography variant="caption" color="textSecondary" display="block">
                    {i18n.t(
                      "inventorySales.sales.wizard.payment.storeCreditOverrideHint"
                    )}
                  </Typography>
                  <FormControl variant="outlined" fullWidth size="small" style={{ marginTop: 8 }}>
                    <InputLabel>
                      {i18n.t(
                        "inventorySales.sales.wizard.payment.storeCreditOverride"
                      )}
                    </InputLabel>
                    <Select
                      label={i18n.t(
                        "inventorySales.sales.wizard.payment.storeCreditOverride"
                      )}
                      value={
                        storeCreditOverride?.authorizeOverride ? "yes" : "no"
                      }
                      onChange={(e) =>
                        setStoreCreditOverride((prev) => ({
                          ...(prev || {}),
                          authorizeOverride: e.target.value === "yes",
                        }))
                      }
                      disabled={disabled}
                    >
                      <MenuItem value="no">
                        {i18n.t("inventorySales.common.none")}
                      </MenuItem>
                      <MenuItem value="yes">
                        {i18n.t(
                          "inventorySales.sales.wizard.payment.storeCreditOverride"
                        )}
                      </MenuItem>
                    </Select>
                  </FormControl>
                  {storeCreditOverride?.authorizeOverride ? (
                    <TextField
                      label={i18n.t(
                        "inventorySales.sales.wizard.payment.storeCreditOverrideReason"
                      )}
                      value={storeCreditOverride?.reason || ""}
                      onChange={(e) =>
                        setStoreCreditOverride((prev) => ({
                          ...(prev || {}),
                          reason: e.target.value,
                        }))
                      }
                      variant="outlined"
                      size="small"
                      fullWidth
                      style={{ marginTop: 8 }}
                      disabled={disabled}
                    />
                  ) : null}
                </Box>
              ) : null}
            </Box>
          ) : null}

          <AppPrimaryButton
            onClick={openAddDialog}
            disabled={disabled || Number(summary?.remainingToAllocate) <= 0}
            data-testid="sale-wizard-payment-add"
          >
            {i18n.t("inventorySales.sales.wizard.payment.add")}
          </AppPrimaryButton>
        </>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => !submitting && setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        data-testid="sale-wizard-payment-dialog"
      >
        <DialogTitle>
          {i18n.t("inventorySales.sales.wizard.payment.add")}
        </DialogTitle>
        <DialogContent>
          <Box className={classes.formStack}>
            <FormControl variant="outlined" fullWidth size="small">
              <InputLabel>
                {i18n.t("inventorySales.sales.wizard.payment.method")}
              </InputLabel>
              <Select
                label={i18n.t("inventorySales.sales.wizard.payment.method")}
                value={formMethod}
                onChange={(e) => handleMethodChange(e.target.value)}
                disabled={submitting}
                data-testid="sale-wizard-payment-method"
              >
                {availableMethods.map((method) => (
                  <MenuItem key={method} value={method}>
                    {methodLabel(method)}
                  </MenuItem>
                ))}
                {showDisabledStoreCreditHint ? (
                  <MenuItem value="store_credit" disabled>
                    {methodLabel("store_credit")} —{" "}
                    {i18n.t(
                      "inventorySales.sales.wizard.payment.storeCreditNeedsCustomer"
                    )}
                  </MenuItem>
                ) : null}
              </Select>
            </FormControl>

            <CurrencyInput
              label={i18n.t("inventorySales.sales.wizard.payment.amount")}
              value={formAmount}
              onChange={setFormAmount}
              disabled={submitting}
              fullWidth
              size="small"
              variant="outlined"
            />

            {formMethod === "credit_card" ? (
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel>
                  {i18n.t("inventorySales.sales.wizard.payment.installments")}
                </InputLabel>
                <Select
                  label={i18n.t(
                    "inventorySales.sales.wizard.payment.installments"
                  )}
                  value={formInstallments}
                  onChange={(e) => setFormInstallments(e.target.value)}
                  disabled={submitting}
                >
                  {CARD_INSTALLMENT_OPTIONS.map((n) => (
                    <MenuItem key={n} value={String(n)}>
                      {formatCardInstallmentCaption(n, formAmount)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : formMethod === "store_credit" ? (
              <Typography variant="body2" color="textSecondary">
                {i18n.t(
                  "inventorySales.sales.wizard.payment.storeCreditScheduleTitle"
                )}
              </Typography>
            ) : (
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel>
                  {i18n.t("inventorySales.sales.wizard.payment.situation")}
                </InputLabel>
                <Select
                  label={i18n.t(
                    "inventorySales.sales.wizard.payment.situation"
                  )}
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  disabled={submitting}
                >
                  <MenuItem value="paid">
                    {i18n.t("inventorySales.sales.wizard.payment.statusPaid")}
                  </MenuItem>
                  <MenuItem value="pending">
                    {i18n.t(
                      "inventorySales.sales.wizard.payment.statusPending"
                    )}
                  </MenuItem>
                </Select>
              </FormControl>
            )}

            <TextField
              label={i18n.t("inventorySales.sales.wizard.payment.notes")}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              disabled={submitting}
              fullWidth
              size="small"
              variant="outlined"
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <AppSecondaryButton
            onClick={() => setDialogOpen(false)}
            disabled={submitting}
          >
            {i18n.t("inventorySales.sales.wizard.nav.back")}
          </AppSecondaryButton>
          <AppPrimaryButton
            onClick={handleAdd}
            disabled={submitting || !(formAmount > 0)}
            data-testid="sale-wizard-payment-submit"
          >
            {submitting
              ? i18n.t("inventorySales.sales.wizard.nav.saving")
              : i18n.t("inventorySales.sales.wizard.payment.save")}
          </AppPrimaryButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
