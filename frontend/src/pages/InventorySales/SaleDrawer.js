import React, { useCallback, useEffect, useState } from "react";
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
  listInventoryProducts,
  updateInventorySale,
  updateInventorySalePayment,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import ConfirmationModal from "../../components/ConfirmationModal";
import SaleItemsEditor from "./SaleItemsEditor";
import SalePaymentDialog from "./SalePaymentDialog";
import SaleReceiptDialog from "./SaleReceiptDialog";
import { PAYMENT_METHODS } from "./constants";
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
  const [saving, setSaving] = useState(false);
  const [sale, setSale] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState("");

  const [headerForm, setHeaderForm] = useState({
    contactId: "",
    sellerUserId: "",
    notes: "",
    paymentMethod: "",
    paymentNotes: "",
  });

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const applySaleToForm = useCallback((data) => {
    setHeaderForm({
      contactId: data.contactId != null ? String(data.contactId) : "",
      sellerUserId:
        data.sellerUserId != null ? String(data.sellerUserId) : "",
      notes: data.notes || "",
      paymentMethod: data.paymentMethod || "",
      paymentNotes: data.paymentNotes || "",
    });
  }, []);

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
      const [productsRes, usersRes] = await Promise.all([
        listInventoryProducts({ active: true }),
        api.get("/users/list"),
      ]);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (err) {
      toastError(err);
    }
  }, []);

  const loadContacts = useCallback(async (search) => {
    try {
      const { data } = await api.get("/contacts", {
        params: { searchParam: search || "", pageNumber: 1 },
      });
      setContacts(Array.isArray(data.contacts) ? data.contacts : []);
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadRefs();
    if (!ticketLink) {
      loadContacts("");
    }
  }, [open, loadRefs, loadContacts, ticketLink]);

  useEffect(() => {
    if (!open || !saleId) return;
    loadSale();
  }, [open, saleId, loadSale]);

  useEffect(() => {
    if (!open || ticketLink) return;
    const t = setTimeout(() => loadContacts(contactSearch), contactSearch ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, contactSearch, loadContacts, ticketLink]);

  const editable = isSaleEditable(sale) && perms.canCreateSale;

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
      paymentNotes: headerForm.paymentNotes.trim() || null,
      paymentStatus: "unpaid",
      paidAmount: 0,
    });
    return data;
  };

  const handleSaveHeader = async () => {
    if (!sale?.id || !editable) return;
    setSaving(true);
    try {
      await persistHeader();
      if (perms.canManagePayments) {
        await persistDraftPayment();
      }
      const fresh = await refreshSale();
      if (fresh) applySaleToForm(fresh);
      toast.success(i18n.t("inventorySales.sales.toasts.saved"));
      if (onChanged) onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
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

  const displayDate = getSaleDisplayDate(sale);

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
                    <>
                      <FormControl
                        variant="outlined"
                        size="small"
                        fullWidth
                        disabled={!editable}
                      >
                        <InputLabel id="sale-contact-label">
                          {i18n.t("inventorySales.sales.fields.contact")}
                        </InputLabel>
                        <Select
                          labelId="sale-contact-label"
                          value={headerForm.contactId}
                          onChange={(e) =>
                            setHeaderForm((prev) => ({
                              ...prev,
                              contactId: e.target.value,
                            }))
                          }
                          label={i18n.t("inventorySales.sales.fields.contact")}
                          onOpen={() => loadContacts(contactSearch)}
                        >
                          <MenuItem value="">
                            <em>{i18n.t("inventorySales.common.none")}</em>
                          </MenuItem>
                          {contacts.map((c) => (
                            <MenuItem key={c.id} value={String(c.id)}>
                              {c.name}
                              {c.number ? ` (${c.number})` : ""}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {!editable && sale.contact ? (
                        <Typography variant="caption" color="textSecondary">
                          {sale.contact.name}
                        </Typography>
                      ) : (
                        <TextField
                          size="small"
                          variant="outlined"
                          placeholder={i18n.t(
                            "inventorySales.sales.searchContact"
                          )}
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          disabled={!editable}
                          fullWidth
                        />
                      )}
                    </>
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
                  />

                  ) : null}

                  {sale.status === "cancelled" && sale.cancelReason ? (
                    <Typography variant="body2" color="textSecondary">
                      {i18n.t("inventorySales.sales.cancelReasonLabel")}:{" "}
                      {sale.cancelReason}
                    </Typography>
                  ) : null}
                </div>

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
                          onChange={(e) =>
                            setHeaderForm((prev) => ({
                              ...prev,
                              paymentMethod: e.target.value,
                            }))
                          }
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
                        <AppSecondaryButton onClick={handleSaveHeader} disabled={saving}>
                          {i18n.t("inventorySales.sales.saveHeader")}
                        </AppSecondaryButton>
                      </Box>
                    </>
                  ) : sale.status === "completed" ? (
                    <>
                      <div className={classes.paymentInfoRow}>
                        <Chip
                          size="small"
                          color={paymentStatusChipColor(sale.paymentStatus)}
                          label={paymentStatusLabel(sale.paymentStatus)}
                        />
                        <Typography variant="body2">
                          {paymentMethodLabel(sale.paymentMethod)}
                        </Typography>
                      </div>
                      <Typography variant="body2">
                        {i18n.t("inventorySales.sales.payment.paidAmount")}:{" "}
                        {formatCurrencyBRL(sale.paidAmount)} /{" "}
                        {formatCurrencyBRL(sale.totalAmount)}
                      </Typography>
                      {sale.paidAt ? (
                        <Typography variant="body2" color="textSecondary">
                          {i18n.t("inventorySales.sales.payment.paidAt")}:{" "}
                          {formatDate(sale.paidAt)}
                        </Typography>
                      ) : null}
                      {sale.paymentNotes ? (
                        <Typography variant="body2" color="textSecondary">
                          {sale.paymentNotes}
                        </Typography>
                      ) : null}
                      <Box>
                        {perms.canManagePayments ? (
                          <AppSecondaryButton onClick={() => setPaymentDialogOpen(true)}>
                            {i18n.t("inventorySales.sales.payment.update")}
                          </AppSecondaryButton>
                        ) : null}
                      </Box>
                    </>
                  ) : sale.status === "cancelled" && sale.paymentStatus === "refunded" ? (
                    <Chip
                      size="small"
                      label={paymentStatusLabel(sale.paymentStatus)}
                    />
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      {paymentMethodLabel(sale.paymentMethod)}
                    </Typography>
                  )}
                </div>

                <SaleItemsEditor
                  sale={sale}
                  products={products}
                  readOnly={!editable}
                  onSaleUpdated={refreshSale}
                />
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
