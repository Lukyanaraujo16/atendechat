import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Autocomplete from "@material-ui/lab/Autocomplete";
import CloseIcon from "@material-ui/icons/Close";
import ReceiptIcon from "@material-ui/icons/Receipt";
import { toast } from "react-toastify";

import {
  AppDangerAction,
  AppEmptyState,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import api from "../../services/api";
import {
  cancelInventorySale,
  completeInventorySale,
  deleteInventorySale,
  getInventorySale,
  searchInventoryCustomers,
  updateInventorySale,
  updateInventorySalePayment,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import ConfirmationModal from "../../components/ConfirmationModal";
import SaleItemsEditor from "./SaleItemsEditor";
import SalePaymentDialog from "./SalePaymentDialog";
import SalePaymentsSection from "./SalePaymentsSection";
import SaleReceiptDialog from "./SaleReceiptDialog";
import { PAYMENT_METHODS } from "./constants";
import {
  CARD_INSTALLMENT_OPTIONS,
  cardInstallmentFormValue,
  formatCardInstallmentCaption,
} from "./cardInstallments";
import { describeSalePaymentMethod } from "./paymentDisplay";
import {
  formatSaleNumber,
  getSaleDisplayDate,
  isSaleEditable,
  paymentStatusChipColor,
} from "./utils";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import { format } from "date-fns";
import useIsMobile from "../../hooks/useIsMobile";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import {
  axiosAbortConfig,
  isAbortError,
  shouldAutofocusSaleProductSearch,
} from "./saleProductSearch";

function contactOptionFromSale(data) {
  const contact = data?.contact;
  if (contact?.id == null) return null;
  return {
    id: contact.id,
    name: contact.name || "",
    number: contact.number || "",
  };
}

function sameHeaderId(left, right) {
  const a = left == null || left === "" ? "" : String(left);
  const b = right == null || right === "" ? "" : String(right);
  return a === b;
}

const useStyles = makeStyles((theme) => ({
  drawerPaper: {
    width: "100%",
    maxWidth: 720,
    [theme.breakpoints.down("sm")]: {
      maxWidth: "100vw",
    },
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    gap: theme.spacing(1),
  },
  content: {
    padding: theme.spacing(2),
    overflowY: "auto",
    overflowX: "hidden",
    flex: 1,
    minWidth: 0,
    ...theme.scrollbarStyles,
  },
  footer: {
    padding: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
  },
  inner: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  cancelReasonField: {
    marginTop: theme.spacing(2),
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  paymentInfoRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
}));

function statusChipColor(status) {
  if (status === "completed") return "primary";
  if (status === "cancelled") return "default";
  return "default";
}

export default function SaleDrawer({
  open,
  saleId,
  onClose,
  onChanged,
  ticketLink = null,
}) {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const perms = useInventoryPermissions();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [sale, setSale] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactOptions, setContactOptions] = useState([]);
  const [contactInput, setContactInput] = useState("");
  const [contactSearchLoading, setContactSearchLoading] = useState(false);
  const [contactSearchError, setContactSearchError] = useState(false);
  const [contactPopupOpen, setContactPopupOpen] = useState(false);
  const contactAbortRef = useRef(null);
  const contactRequestRef = useRef(0);
  const contactTypedRef = useRef("");
  const contactDebounceRef = useRef(null);
  const openRef = useRef(open);
  const mountedRef = useRef(true);

  const [headerForm, setHeaderForm] = useState({
    contactId: "",
    sellerUserId: "",
    notes: "",
    paymentMethod: "",
    cardInstallmentCount: "",
    paymentNotes: "",
  });

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const applyContact = useCallback((contact) => {
    setSelectedContact(contact);
    setContactInput(contact?.name || "");
    setContactOptions(contact ? [contact] : []);
    setContactSearchError(false);
    setContactSearchLoading(false);
  }, []);

  const applySaleToForm = useCallback((data) => {
    setHeaderForm({
      contactId: data.contactId != null ? String(data.contactId) : "",
      sellerUserId:
        data.sellerUserId != null ? String(data.sellerUserId) : "",
      notes: data.notes || "",
      paymentMethod: data.paymentMethod || "",
      cardInstallmentCount: cardInstallmentFormValue(
        data.paymentMethod,
        data.cardInstallmentCount
      ),
      paymentNotes: data.paymentNotes || "",
    });
    applyContact(contactOptionFromSale(data));
  }, [applyContact]);

  const loadSale = useCallback(async () => {
    if (!saleId) return null;
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await getInventorySale(saleId);
      setSale(data);
      applySaleToForm(data);
      return data;
    } catch (err) {
      setLoadError(true);
      setSale(null);
      toastError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [saleId, applySaleToForm]);

  // Atualiza a venda (ex.: após alterar itens) sem sobrescrever os campos que o
  // utilizador ainda não guardou (cliente, vendedor, pagamento, notas).
  const refreshSale = useCallback(async () => {
    if (!saleId) return null;
    try {
      const { data } = await getInventorySale(saleId);
      setSale(data);
      return data;
    } catch (err) {
      toastError(err);
      return null;
    }
  }, [saleId]);

  const loadRefs = useCallback(async () => {
    try {
      const { data } = await api.get("/users/list");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    }
  }, []);

  const runContactSearch = useCallback(async (rawTerm, { browse } = {}) => {
    const query = String(rawTerm ?? "").trim();
    if (!query && !browse) {
      setContactSearchLoading(false);
      setContactSearchError(false);
      return;
    }

    contactTypedRef.current = query;
    if (contactAbortRef.current) contactAbortRef.current.abort();
    const controller = new AbortController();
    contactAbortRef.current = controller;
    const requestId = ++contactRequestRef.current;
    setContactSearchLoading(true);
    setContactSearchError(false);

    try {
      const params = { limit: 20 };
      if (query) params.search = query;
      const { data } = await searchInventoryCustomers(
        params,
        axiosAbortConfig(controller)
      );
      if (
        !mountedRef.current ||
        !openRef.current ||
        controller.signal.aborted ||
        requestId !== contactRequestRef.current ||
        contactTypedRef.current !== query
      ) {
        return;
      }
      const rows = Array.isArray(data?.customers) ? data.customers : [];
      setContactOptions(rows);
    } catch (err) {
      if (
        !mountedRef.current ||
        !openRef.current ||
        controller.signal.aborted ||
        isAbortError(err) ||
        requestId !== contactRequestRef.current ||
        contactTypedRef.current !== query
      ) {
        return;
      }
      setContactSearchError(true);
      setContactOptions([]);
    } finally {
      if (
        mountedRef.current &&
        requestId === contactRequestRef.current &&
        !controller.signal.aborted
      ) {
        setContactSearchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => () => {
    mountedRef.current = false;
    if (contactAbortRef.current) contactAbortRef.current.abort();
    clearTimeout(contactDebounceRef.current);
  }, []);

  useEffect(() => {
    if (!open) {
      if (contactAbortRef.current) contactAbortRef.current.abort();
      clearTimeout(contactDebounceRef.current);
      return;
    }
    loadRefs();
  }, [open, loadRefs]);

  useEffect(() => {
    if (!open || !saleId) return;
    loadSale();
  }, [open, saleId, loadSale]);

  const editable = isSaleEditable(sale) && perms.canCreateSale;

  useEffect(() => {
    if (!open || ticketLink || !editable) return undefined;
    const query = contactInput.trim();
    const queryChanged = contactTypedRef.current !== query;
    contactTypedRef.current = query;
    if (!query && !contactPopupOpen) {
      if (contactAbortRef.current) {
        contactAbortRef.current.abort();
        contactAbortRef.current = null;
      }
      setContactOptions(selectedContact ? [selectedContact] : []);
      setContactSearchLoading(false);
      setContactSearchError(false);
      return undefined;
    }
    if (!query) {
      runContactSearch("", { browse: true });
      return undefined;
    }
    if (
      selectedContact &&
      query === String(selectedContact.name || "").trim()
    ) {
      setContactSearchLoading(false);
      return undefined;
    }
    if (!queryChanged) return undefined;
    if (contactAbortRef.current) {
      contactAbortRef.current.abort();
      contactAbortRef.current = null;
    }
    contactDebounceRef.current = setTimeout(() => {
      runContactSearch(query);
    }, 300);
    return () => clearTimeout(contactDebounceRef.current);
  }, [
    open,
    ticketLink,
    editable,
    contactInput,
    contactPopupOpen,
    selectedContact,
    runContactSearch
  ]);

  // Persiste apenas o cabeçalho da venda (rascunho). Nunca envia campos
  // financeiros pelo endpoint geral — pagamento só vai pela rota protegida.
  const persistHeader = async () => {
    const payload = {
      notes: headerForm.notes.trim() || null,
      sellerUserId: headerForm.sellerUserId
        ? Number(headerForm.sellerUserId)
        : null,
      contactId: ticketLink
        ? ticketLink.contactId
        : headerForm.contactId
          ? Number(headerForm.contactId)
          : null,
    };
    if (ticketLink?.ticketId != null) {
      payload.ticketId = ticketLink.ticketId;
    }
    const { data } = await updateInventorySale(sale.id, payload);
    return data;
  };

  // Grava os metadados de pagamento do rascunho pela rota protegida
  // (exige managePayments). Financeiro permanece zerado em rascunho.
  const persistDraftPayment = async () => {
    const { data } = await updateInventorySalePayment(sale.id, {
      paymentMethod: headerForm.paymentMethod || null,
      cardInstallmentCount:
        headerForm.paymentMethod === "credit_card"
          ? Number(headerForm.cardInstallmentCount)
          : null,
      paymentNotes: headerForm.paymentNotes.trim() || null,
      paymentStatus: "unpaid",
      paidAmount: 0,
    });
    return data;
  };

  const handleSaveHeader = async () => {
    if (!sale?.id || !editable || savingHeader || savingPayment) return;
    setSavingHeader(true);
    try {
      const data = await persistHeader();
      setSale(data);
      setHeaderForm((prev) => ({
        ...prev,
        contactId: data.contactId != null ? String(data.contactId) : "",
        sellerUserId: data.sellerUserId != null ? String(data.sellerUserId) : "",
        notes: data.notes || "",
      }));
      applyContact(contactOptionFromSale(data));
      toast.success(i18n.t("inventorySales.sales.toasts.headerSaved"));
      if (onChanged) onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setSavingHeader(false);
    }
  };

  const handleSavePayment = async () => {
    if (!sale?.id || !editable || !perms.canManagePayments || savingHeader || savingPayment) {
      return;
    }
    setSavingPayment(true);
    try {
      const data = await persistDraftPayment();
      setSale(data);
      setHeaderForm((prev) => ({
        ...prev,
        paymentMethod: data.paymentMethod || "",
        cardInstallmentCount: cardInstallmentFormValue(
          data.paymentMethod,
          data.cardInstallmentCount
        ),
        paymentNotes: data.paymentNotes || "",
      }));
      toast.success(i18n.t("inventorySales.sales.toasts.paymentSaved"));
      if (onChanged) onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleComplete = async () => {
    if (!sale?.id) return;
    const sellerUserId =
      headerForm.sellerUserId || (sale.sellerUserId != null ? String(sale.sellerUserId) : "");
    if (!sellerUserId) {
      toast.error(i18n.t("inventorySales.sales.validation.sellerRequired"));
      setConfirmComplete(false);
      return;
    }

    setActionLoading(true);
    try {
      // 1) Salva o cabeçalho pendente (cliente/vendedor/notas) e aguarda o PUT
      // terminar antes de concluir — evita depender de setState e não limpa os
      // campos preenchidos.
      if (editable) {
        await persistHeader();
        // 2) Grava a forma de pagamento do rascunho pela rota protegida,
        // apenas quando o utilizador tem permissão de gerir pagamentos.
        if (perms.canManagePayments) {
          await persistDraftPayment();
        }
      }
      // 3) Conclui a venda; o backend valida itens/estoque/permissão.
      const { data } = await completeInventorySale(sale.id, {
        sellerUserId: Number(sellerUserId),
      });
      // 4) Sincroniza a UI com a venda concluída, sem apagar dados.
      setSale(data);
      applySaleToForm(data);
      setConfirmComplete(false);
      toast.success(i18n.t("inventorySales.sales.toasts.completed"));
      if (onChanged) onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!sale?.id || !perms.canCancelSale) return;
    if (!cancelReason.trim()) {
      toast.error(i18n.t("inventorySales.sales.validation.cancelReason"));
      return;
    }
    setActionLoading(true);
    try {
      const { data } = await cancelInventorySale(sale.id, {
        cancelReason: cancelReason.trim(),
      });
      setSale(data);
      setConfirmCancel(false);
      setCancelReason("");
      toast.success(i18n.t("inventorySales.sales.toasts.cancelled"));
      if (onChanged) onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!sale?.id || !perms.canCancelSale) return;
    setActionLoading(true);
    try {
      await deleteInventorySale(sale.id);
      setConfirmDelete(false);
      toast.success(i18n.t("inventorySales.sales.toasts.deleted"));
      if (onChanged) onChanged();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setActionLoading(false);
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

  const statusLabel = (status) =>
    i18n.t(`inventorySales.sales.status.${status}`, status);

  const paymentStatusLabel = (status) =>
    i18n.t(`inventorySales.sales.paymentStatus.${status}`, status);

  const paymentMethodLabel = (method) =>
    method
      ? i18n.t(`inventorySales.sales.paymentMethods.${method}`, method)
      : i18n.t("inventorySales.sales.payment.noMethod");

  const salePaymentLabel = (current) => describeSalePaymentMethod(current);

  const displayDate = getSaleDisplayDate(sale);
  const customerOptions = useMemo(() => {
    if (!selectedContact) return contactOptions;
    if (contactOptions.some((row) => row.id === selectedContact.id)) {
      return contactOptions;
    }
    return [selectedContact, ...contactOptions];
  }, [contactOptions, selectedContact]);
  const headerDirty = Boolean(
    editable &&
      sale &&
      (!sameHeaderId(headerForm.contactId, sale.contactId) ||
        !sameHeaderId(headerForm.sellerUserId, sale.sellerUserId) ||
        (headerForm.notes || "") !== (sale.notes || ""))
  );
  const savesLocked = savingHeader || savingPayment || actionLoading;

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        classes={{ paper: classes.drawerPaper }}
        PaperProps={isMobile ? { style: { width: "100%" } } : undefined}
      >
        <div className={classes.inner}>
          <div className={classes.header}>
            <Box minWidth={0}>
              <Typography variant="h6" style={{ fontWeight: 600 }}>
                {i18n.t("inventorySales.sales.drawerTitle", {
                  number: formatSaleNumber(sale),
                })}
              </Typography>
              <Box display="flex" alignItems="center" style={{ gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                {sale?.status ? (
                  <Chip
                    size="small"
                    color={statusChipColor(sale.status)}
                    label={statusLabel(sale.status)}
                  />
                ) : null}
                {sale?.status === "completed" && sale?.paymentStatus ? (
                  <Chip
                    size="small"
                    color={paymentStatusChipColor(sale.paymentStatus)}
                    label={paymentStatusLabel(sale.paymentStatus)}
                  />
                ) : null}
                {displayDate ? (
                  <Typography variant="caption" color="textSecondary">
                    {formatDate(displayDate)}
                  </Typography>
                ) : null}
              </Box>
            </Box>
            <IconButton onClick={onClose} edge="end" aria-label="close">
              <CloseIcon />
            </IconButton>
          </div>

          <div className={classes.content}>
            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress size={32} />
              </Box>
            ) : loadError ? (
              <AppEmptyState title={i18n.t("inventorySales.common.loadError")}>
                <AppSecondaryButton onClick={loadSale}>
                  {i18n.t("inventorySales.common.retry")}
                </AppSecondaryButton>
              </AppEmptyState>
            ) : sale ? (
              <>
                <div className={classes.fieldGroup}>
                  <Typography variant="subtitle1" className={classes.sectionTitle}>
                    {i18n.t("inventorySales.sales.sections.saleData")}
                  </Typography>
                  {ticketLink ? (
                    <>
                      <TextField
                        label={i18n.t("inventorySales.sales.fields.contact")}
                        value={
                          ticketLink.contactName ||
                          sale.contact?.name ||
                          "—"
                        }
                        variant="outlined"
                        size="small"
                        fullWidth
                        disabled
                      />
                      <TextField
                        label={i18n.t("inventorySales.ticket.ticketLabel")}
                        value={`#${ticketLink.ticketId}`}
                        variant="outlined"
                        size="small"
                        fullWidth
                        disabled
                      />
                    </>
                  ) : (
                    <Autocomplete
                      options={customerOptions}
                      value={selectedContact}
                      inputValue={contactInput}
                      open={contactPopupOpen}
                      onOpen={() => setContactPopupOpen(true)}
                      onClose={() => {
                        if (contactAbortRef.current) contactAbortRef.current.abort();
                        setContactSearchLoading(false);
                        setContactPopupOpen(false);
                      }}
                      disabled={!editable}
                      onChange={(_, value) => {
                        setSelectedContact(value);
                        setHeaderForm((prev) => ({
                          ...prev,
                          contactId: value?.id != null ? String(value.id) : "",
                        }));
                        if (!value) {
                          setContactOptions([]);
                          setContactInput("");
                          setContactSearchError(false);
                        }
                      }}
                      onInputChange={(_, value, reason) => {
                        setContactInput(value);
                        if (reason === "input" || reason === "clear") {
                          setSelectedContact(null);
                          setHeaderForm((prev) => ({ ...prev, contactId: "" }));
                          setContactPopupOpen(true);
                          if (reason === "clear") {
                            setContactSearchError(false);
                          }
                        }
                      }}
                      loading={contactSearchLoading}
                      filterOptions={(opts) => opts}
                      getOptionSelected={(option, value) => option.id === value.id}
                      getOptionLabel={(option) => option?.name || ""}
                      noOptionsText={
                        contactSearchError
                          ? i18n.t("inventorySales.sales.customerSearch.error")
                          : i18n.t("inventorySales.sales.customerSearch.empty")
                      }
                      loadingText={i18n.t("inventorySales.sales.customerSearch.loading")}
                      renderOption={(option) => (
                        <Box minWidth={0} style={{ overflowWrap: "anywhere" }}>
                          <Typography variant="body2">{option.name}</Typography>
                          {option.number ? (
                            <Typography variant="caption" color="textSecondary" display="block">
                              {option.number}
                            </Typography>
                          ) : null}
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={i18n.t("inventorySales.sales.fields.contact")}
                          placeholder={i18n.t("inventorySales.sales.customerSearch.placeholder")}
                          variant="outlined"
                          size="small"
                          autoFocus={editable && shouldAutofocusSaleProductSearch()}
                          inputProps={{
                            ...params.inputProps,
                            "data-testid": "sale-customer-search",
                          }}
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {contactSearchLoading ? (
                                  <CircularProgress color="inherit" size={18} />
                                ) : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  )}

                  <FormControl
                    variant="outlined"
                    size="small"
                    fullWidth
                    disabled={!editable}
                  >
                    <InputLabel id="sale-seller-label">
                      {i18n.t("inventorySales.sales.fields.seller")}
                    </InputLabel>
                    <Select
                      labelId="sale-seller-label"
                      value={headerForm.sellerUserId}
                      onChange={(e) =>
                        setHeaderForm((prev) => ({
                          ...prev,
                          sellerUserId: e.target.value,
                        }))
                      }
                      label={i18n.t("inventorySales.sales.fields.seller")}
                    >
                      <MenuItem value="">
                        <em>{i18n.t("inventorySales.common.select")}</em>
                      </MenuItem>
                      {users.map((u) => (
                        <MenuItem key={u.id} value={String(u.id)}>
                          {u.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label={i18n.t("inventorySales.sales.fields.notes")}
                    value={headerForm.notes}
                    onChange={(e) =>
                      setHeaderForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    variant="outlined"
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    disabled={!editable}
                    inputProps={{ "data-testid": "sale-notes" }}
                  />

                  {sale.status === "cancelled" && sale.cancelReason ? (
                    <Typography variant="body2" color="textSecondary">
                      {i18n.t("inventorySales.sales.cancelReasonLabel")}:{" "}
                      {sale.cancelReason}
                    </Typography>
                  ) : null}

                  {editable ? (
                    <Box>
                      {headerDirty ? (
                        <Typography variant="caption" color="textSecondary" display="block">
                          {i18n.t("inventorySales.sales.unsavedChanges")}
                        </Typography>
                      ) : null}
                      <AppSecondaryButton onClick={handleSaveHeader} disabled={savesLocked}>
                        {i18n.t("inventorySales.sales.saveHeader")}
                      </AppSecondaryButton>
                    </Box>
                  ) : null}
                </div>

                <SaleItemsEditor
                  sale={sale}
                  readOnly={!editable}
                  onSaleUpdated={refreshSale}
                />

                <Typography variant="subtitle1" className={classes.sectionTitle}>
                  {i18n.t("inventorySales.sales.payment.sectionTitle")}
                </Typography>
                <div className={classes.fieldGroup}>
                  {editable && perms.canManagePayments ? (
                    <>
                      <FormControl variant="outlined" size="small" fullWidth>
                        <InputLabel id="sale-payment-method-label">
                          {i18n.t("inventorySales.sales.fields.paymentMethod")}
                        </InputLabel>
                        <Select
                          labelId="sale-payment-method-label"
                          value={headerForm.paymentMethod}
                          onChange={(e) => {
                            const nextMethod = e.target.value;
                            setHeaderForm((prev) => ({
                              ...prev,
                              paymentMethod: nextMethod,
                              cardInstallmentCount:
                                nextMethod === "credit_card" ? "1" : "",
                            }));
                          }}
                          label={i18n.t("inventorySales.sales.fields.paymentMethod")}
                        >
                          <MenuItem value="">
                            <em>{i18n.t("inventorySales.common.none")}</em>
                          </MenuItem>
                          {PAYMENT_METHODS.map((method) => (
                            <MenuItem key={method} value={method}>
                              {i18n.t(
                                `inventorySales.sales.paymentMethods.${method}`,
                                method
                              )}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {headerForm.paymentMethod === "credit_card" ? (
                        <>
                          <FormControl variant="outlined" size="small" fullWidth>
                            <InputLabel id="sale-card-installments-label">
                              {i18n.t("inventorySales.sales.payment.installments")}
                            </InputLabel>
                            <Select
                              labelId="sale-card-installments-label"
                              value={headerForm.cardInstallmentCount || "1"}
                              onChange={(e) =>
                                setHeaderForm((prev) => ({
                                  ...prev,
                                  cardInstallmentCount: String(e.target.value),
                                }))
                              }
                              label={i18n.t("inventorySales.sales.payment.installments")}
                              SelectDisplayProps={{
                                "data-testid": "sale-card-installments",
                              }}
                            >
                              {CARD_INSTALLMENT_OPTIONS.map((count) => (
                                <MenuItem key={count} value={String(count)}>
                                  {count}x
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            data-testid="sale-card-installment-caption"
                          >
                            {formatCardInstallmentCaption(
                              Number(headerForm.cardInstallmentCount || 1),
                              sale.totalAmount
                            )}
                          </Typography>
                        </>
                      ) : null}
                      <TextField
                        label={i18n.t("inventorySales.sales.fields.paymentNotes")}
                        value={headerForm.paymentNotes}
                        onChange={(e) =>
                          setHeaderForm((prev) => ({
                            ...prev,
                            paymentNotes: e.target.value,
                          }))
                        }
                        variant="outlined"
                        size="small"
                        fullWidth
                        multiline
                        rows={2}
                      />
                      <Box>
                        <AppSecondaryButton onClick={handleSavePayment} disabled={savesLocked}>
                          {i18n.t("inventorySales.sales.payment.savePayment")}
                        </AppSecondaryButton>
                      </Box>
                    </>
                  ) : sale.status === "completed" || sale.status === "cancelled" ? (
                    <SalePaymentsSection
                      sale={sale}
                      canManagePayments={perms.canManagePayments}
                      onSaleMaybeChanged={async () => {
                        await refreshSale();
                        if (onChanged) onChanged();
                      }}
                      onLegacyUpdateClick={
                        sale.status === "completed"
                          ? () => setPaymentDialogOpen(true)
                          : undefined
                      }
                    />
                  ) : (
                    <Typography variant="body2" color="textSecondary" data-testid="sale-payment-method-display">
                      {salePaymentLabel(sale)}
                    </Typography>
                  )}
                </div>

                <Typography variant="subtitle1" className={classes.sectionTitle}>
                  {i18n.t("inventorySales.sales.sections.summary")}
                  </Typography>
                  {sale.deliveryMethodName ? (
                    <Box mb={1} data-testid="sale-drawer-delivery">
                      <Typography variant="body2">
                        <strong>
                          {i18n.t("inventorySales.sales.wizard.delivery.reviewLabel")}:
                        </strong>{" "}
                        {sale.deliveryMethodName}
                      </Typography>
                      {Number(sale.freightAmount) > 0 ? (
                        <Typography variant="body2" color="textSecondary">
                          {i18n.t("inventorySales.sales.wizard.delivery.feeLabel")}:{" "}
                          {formatCurrencyBRL(sale.freightAmount)}
                        </Typography>
                      ) : null}
                      {sale.delivery?.street || sale.InventorySaleDelivery?.street ? (
                        <Typography variant="body2" color="textSecondary">
                          {[
                            sale.delivery?.street || sale.InventorySaleDelivery?.street,
                            sale.delivery?.number || sale.InventorySaleDelivery?.number,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                          {(sale.delivery?.city || sale.InventorySaleDelivery?.city)
                            ? ` — ${sale.delivery?.city || sale.InventorySaleDelivery?.city}/${sale.delivery?.state || sale.InventorySaleDelivery?.state || ""}`
                            : ""}
                        </Typography>
                      ) : null}
                    </Box>
                  ) : null}
                <Box display="flex" flexDirection="column" alignItems="flex-end" style={{ gap: 4 }}>
                  <Typography variant="body2" color="textSecondary">
                    {i18n.t("inventorySales.sales.totals.subtotal")}:{" "}
                    {formatCurrencyBRL(sale.subtotalAmount)}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {i18n.t("inventorySales.sales.totals.discount")}:{" "}
                    {formatCurrencyBRL(sale.discountAmount)}
                  </Typography>
                  {Number(sale.freightAmount) > 0 ? (
                    <Typography variant="body2" color="textSecondary" data-testid="sale-drawer-freight">
                      {i18n.t("inventorySales.sales.wizard.totals.freight")}:{" "}
                      {formatCurrencyBRL(sale.freightAmount)}
                    </Typography>
                  ) : null}
                  <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                    {i18n.t("inventorySales.sales.totals.total")}:{" "}
                    {formatCurrencyBRL(sale.totalAmount)}
                  </Typography>
                  {sale.status === "completed" && sale.commissionAmount != null ? (
                    <Typography variant="body2" color="textSecondary">
                      {i18n.t("inventorySales.sales.totals.commission")} (
                      {Number(sale.commissionRate) || 0}%):{" "}
                      {formatCurrencyBRL(sale.commissionAmount)}
                    </Typography>
                  ) : null}
                </Box>
              </>
            ) : null}
          </div>

          {sale ? (
            <div className={classes.footer}>
              {editable ? (
                <>
                  {perms.canCancelSale ? (
                    <AppDangerAction onClick={() => setConfirmDelete(true)}>
                      {i18n.t("inventorySales.sales.deleteDraft")}
                    </AppDangerAction>
                  ) : null}
                  {perms.canCancelSale ? (
                    <AppSecondaryButton onClick={() => setConfirmCancel(true)}>
                      {i18n.t("inventorySales.sales.cancelSale")}
                    </AppSecondaryButton>
                  ) : null}
                  {perms.canCreateSale ? (
                    <AppPrimaryButton onClick={() => setConfirmComplete(true)}>
                      {i18n.t("inventorySales.sales.complete")}
                    </AppPrimaryButton>
                  ) : null}
                </>
              ) : sale.status === "completed" ? (
                <>
                  <AppSecondaryButton
                    startIcon={<ReceiptIcon />}
                    onClick={() => setReceiptOpen(true)}
                  >
                    {i18n.t("inventorySales.sales.receipt.open")}
                  </AppSecondaryButton>
                  {perms.canCancelSale ? (
                    <AppSecondaryButton onClick={() => setConfirmCancel(true)}>
                      {i18n.t("inventorySales.sales.cancelSale")}
                    </AppSecondaryButton>
                  ) : null}
                </>
              ) : sale.status === "cancelled" ? (
                <AppSecondaryButton
                  startIcon={<ReceiptIcon />}
                  onClick={() => setReceiptOpen(true)}
                >
                  {i18n.t("inventorySales.sales.receipt.open")}
                </AppSecondaryButton>
              ) : null}
            </div>
          ) : null}
        </div>
      </Drawer>

      <ConfirmationModal
        open={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={handleComplete}
        title={i18n.t("inventorySales.sales.confirmCompleteTitle")}
      >
        {i18n.t("inventorySales.sales.confirmCompleteMessage")}
      </ConfirmationModal>

      <ConfirmationModal
        open={confirmCancel}
        onClose={() => {
          setConfirmCancel(false);
          setCancelReason("");
        }}
        onConfirm={handleCancel}
        title={i18n.t("inventorySales.sales.confirmCancelTitle")}
        destructive
      >
        <Typography variant="body2" gutterBottom>
          {sale?.status === "completed"
            ? i18n.t("inventorySales.sales.confirmCancelCompletedMessage")
            : i18n.t("inventorySales.sales.confirmCancelDraftMessage")}
        </Typography>
        <TextField
          className={classes.cancelReasonField}
          label={i18n.t("inventorySales.sales.fields.cancelReason")}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          variant="outlined"
          size="small"
          fullWidth
          required
          multiline
          rows={2}
        />
      </ConfirmationModal>

      <ConfirmationModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={i18n.t("inventorySales.sales.confirmDeleteTitle")}
        destructive
      >
        {i18n.t("inventorySales.sales.confirmDeleteMessage")}
      </ConfirmationModal>

      {actionLoading ? (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          style={{ pointerEvents: "none", zIndex: 1400 }}
        >
          <CircularProgress />
        </Box>
      ) : null}

      <SalePaymentDialog
        open={paymentDialogOpen && perms.canManagePayments}
        onClose={() => setPaymentDialogOpen(false)}
        sale={sale}
        onSaved={(data) => {
          setSale(data);
          if (onChanged) onChanged();
        }}
      />

      <SaleReceiptDialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        sale={sale}
      />
    </>
  );
}
