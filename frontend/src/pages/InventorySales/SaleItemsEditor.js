import React, { useState } from "react";
import {
  Box,
  FormControl,
  IconButton,
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
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import SaveIcon from "@material-ui/icons/Save";
import AddIcon from "@material-ui/icons/Add";
import { toast } from "react-toastify";

import {
  AppPrimaryButton,
  AppSectionCard,
  AppTableContainer,
  MobileCardList,
  MobileEntityCard,
} from "../../ui";
import {
  addInventorySaleItem,
  deleteInventorySaleItem,
  updateInventorySaleItem,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import { formatCurrencyBRL, parseBrazilianCurrencyToNumber } from "../../utils/brazilianCurrency";
import { formatQuantity, toNumber } from "./utils";

const emptyAddForm = {
  productId: "",
  quantity: "1",
  unitPrice: "",
  discountAmount: "0",
};

export default function SaleItemsEditor({
  sale,
  products,
  readOnly,
  onSaleUpdated,
}) {
  const isMobile = useIsMobile();
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [adding, setAdding] = useState(false);
  const [rowSaving, setRowSaving] = useState(null);
  const [rowDrafts, setRowDrafts] = useState({});

  const items = Array.isArray(sale?.items) ? sale.items : [];
  const activeProducts = (products || []).filter((p) => p.active !== false);

  const getRowDraft = (item) => {
    if (!item?.id) {
      return { quantity: "", unitPrice: "", discountAmount: "0" };
    }
    if (rowDrafts[item.id]) return rowDrafts[item.id];
    return {
      quantity: String(item.quantity ?? ""),
      unitPrice: String(item.unitPrice ?? ""),
      discountAmount: String(item.discountAmount ?? "0"),
    };
  };

  const setRowField = (itemId, field, value) => {
    const item = items.find((i) => i.id === itemId);
    const base = item
      ? {
          quantity: String(item.quantity ?? ""),
          unitPrice: String(item.unitPrice ?? ""),
          discountAmount: String(item.discountAmount ?? "0"),
        }
      : { quantity: "", unitPrice: "", discountAmount: "0" };
    setRowDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...base,
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const handleAddItem = async () => {
    if (!sale?.id) return;
    const productId = Number(addForm.productId);
    if (!Number.isFinite(productId)) {
      toast.error(i18n.t("inventorySales.sales.items.validation.product"));
      return;
    }
    const quantity = Number(addForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error(i18n.t("inventorySales.sales.items.validation.quantity"));
      return;
    }

    const payload = { productId, quantity };
    if (addForm.unitPrice.trim()) {
      const unitPrice = parseBrazilianCurrencyToNumber(addForm.unitPrice);
      if (unitPrice == null || unitPrice < 0) {
        toast.error(i18n.t("inventorySales.sales.items.validation.unitPrice"));
        return;
      }
      payload.unitPrice = unitPrice;
    }
    const discount = parseBrazilianCurrencyToNumber(addForm.discountAmount);
    if (discount != null && discount > 0) {
      payload.discountAmount = discount;
    }

    setAdding(true);
    try {
      await addInventorySaleItem(sale.id, payload);
      toast.success(i18n.t("inventorySales.sales.items.toasts.added"));
      setAddForm(emptyAddForm);
      if (onSaleUpdated) await onSaleUpdated();
    } catch (err) {
      toastError(err);
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateItem = async (item) => {
    if (!sale?.id) return;
    const draft = getRowDraft(item);
    const quantity = Number(draft.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error(i18n.t("inventorySales.sales.items.validation.quantity"));
      return;
    }
    const unitPrice = parseBrazilianCurrencyToNumber(draft.unitPrice);
    if (unitPrice == null || unitPrice < 0) {
      toast.error(i18n.t("inventorySales.sales.items.validation.unitPrice"));
      return;
    }
    const discountAmount =
      parseBrazilianCurrencyToNumber(draft.discountAmount) ?? 0;

    setRowSaving(item.id);
    try {
      await updateInventorySaleItem(sale.id, item.id, {
        quantity,
        unitPrice,
        discountAmount,
      });
      toast.success(i18n.t("inventorySales.sales.items.toasts.updated"));
      setRowDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      if (onSaleUpdated) await onSaleUpdated();
    } catch (err) {
      toastError(err);
    } finally {
      setRowSaving(null);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!sale?.id) return;
    try {
      await deleteInventorySaleItem(sale.id, item.id);
      toast.success(i18n.t("inventorySales.sales.items.toasts.removed"));
      if (onSaleUpdated) await onSaleUpdated();
    } catch (err) {
      toastError(err);
    }
  };

  const renderItemActions = (item) => {
    if (readOnly) return null;
    const draft = getRowDraft(item);
    const originalQty = String(item.quantity ?? "");
    const originalPrice = String(item.unitPrice ?? "");
    const originalDiscount = String(item.discountAmount ?? "0");
    const dirty =
      draft.quantity !== originalQty ||
      draft.unitPrice !== originalPrice ||
      draft.discountAmount !== originalDiscount;

    return (
      <Box display="flex" justifyContent="flex-end">
        {dirty ? (
          <IconButton
            size="small"
            onClick={() => handleUpdateItem(item)}
            disabled={rowSaving === item.id}
          >
            <SaveIcon fontSize="small" />
          </IconButton>
        ) : null}
        <IconButton size="small" onClick={() => handleDeleteItem(item)}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 8 }}>
        {i18n.t("inventorySales.sales.items.title")}
      </Typography>

      <AppSectionCard variant="outlined" dense>
        {items.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("inventorySales.sales.items.empty")}
          </Typography>
        ) : isMobile ? (
          <MobileCardList>
            {items.map((item) => {
              const draft = getRowDraft(item);
              return (
                <MobileEntityCard
                  key={item.id}
                  title={item.productName}
                  subtitle={item.productSku || undefined}
                  footer={readOnly ? null : renderItemActions(item)}
                >
                  {readOnly ? (
                    <>
                      <Typography variant="body2">
                        {formatQuantity(draft.quantity)} ×{" "}
                        {formatCurrencyBRL(draft.unitPrice)}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {i18n.t("inventorySales.sales.items.discount")}:{" "}
                        {formatCurrencyBRL(draft.discountAmount)}
                      </Typography>
                      <Typography variant="body2" style={{ fontWeight: 600 }}>
                        {formatCurrencyBRL(item.totalAmount)}
                      </Typography>
                    </>
                  ) : (
                    <>
                      <TextField
                        size="small"
                        variant="outlined"
                        label={i18n.t("inventorySales.sales.items.quantity")}
                        value={draft.quantity}
                        onChange={(e) =>
                          setRowField(item.id, "quantity", e.target.value)
                        }
                        type="number"
                        inputProps={{ min: 0, step: "any" }}
                        fullWidth
                        style={{ marginBottom: 8 }}
                      />
                      <TextField
                        size="small"
                        variant="outlined"
                        label={i18n.t("inventorySales.sales.items.unitPrice")}
                        value={draft.unitPrice}
                        onChange={(e) =>
                          setRowField(item.id, "unitPrice", e.target.value)
                        }
                        fullWidth
                        style={{ marginBottom: 8 }}
                      />
                      <TextField
                        size="small"
                        variant="outlined"
                        label={i18n.t("inventorySales.sales.items.discount")}
                        value={draft.discountAmount}
                        onChange={(e) =>
                          setRowField(item.id, "discountAmount", e.target.value)
                        }
                        fullWidth
                        style={{ marginBottom: 8 }}
                      />
                      <Typography variant="body2" style={{ fontWeight: 600 }}>
                        {formatCurrencyBRL(item.totalAmount)}
                      </Typography>
                    </>
                  )}
                </MobileEntityCard>
              );
            })}
          </MobileCardList>
        ) : (
          <AppTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("inventorySales.sales.items.product")}</TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.sales.items.quantity")}
                  </TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.sales.items.unitPrice")}
                  </TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.sales.items.discount")}
                  </TableCell>
                  <TableCell align="right">
                    {i18n.t("inventorySales.sales.items.total")}
                  </TableCell>
                  {!readOnly ? (
                    <TableCell align="right">
                      {i18n.t("inventorySales.common.actions")}
                    </TableCell>
                  ) : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const draft = getRowDraft(item);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Typography variant="body2">{item.productName}</Typography>
                        {item.productSku ? (
                          <Typography variant="caption" color="textSecondary">
                            {item.productSku}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell align="right">
                        {readOnly ? (
                          formatQuantity(draft.quantity)
                        ) : (
                          <TextField
                            size="small"
                            variant="outlined"
                            value={draft.quantity}
                            onChange={(e) =>
                              setRowField(item.id, "quantity", e.target.value)
                            }
                            type="number"
                            inputProps={{ min: 0, step: "any" }}
                            style={{ width: 88 }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {readOnly ? (
                          formatCurrencyBRL(draft.unitPrice)
                        ) : (
                          <TextField
                            size="small"
                            variant="outlined"
                            value={draft.unitPrice}
                            onChange={(e) =>
                              setRowField(item.id, "unitPrice", e.target.value)
                            }
                            style={{ width: 100 }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {readOnly ? (
                          formatCurrencyBRL(draft.discountAmount)
                        ) : (
                          <TextField
                            size="small"
                            variant="outlined"
                            value={draft.discountAmount}
                            onChange={(e) =>
                              setRowField(item.id, "discountAmount", e.target.value)
                            }
                            style={{ width: 100 }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrencyBRL(item.totalAmount)}
                      </TableCell>
                      {!readOnly ? (
                        <TableCell align="right">{renderItemActions(item)}</TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AppTableContainer>
        )}
      </AppSectionCard>

      {!readOnly ? (
        <Box mt={2} p={2} border={1} borderColor="divider" borderRadius={8}>
          <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 12 }}>
            {i18n.t("inventorySales.sales.items.addTitle")}
          </Typography>
          <Box display="flex" flexDirection="column" style={{ gap: 12 }}>
            <FormControl variant="outlined" size="small" fullWidth>
              <InputLabel id="sale-add-product">
                {i18n.t("inventorySales.sales.items.product")}
              </InputLabel>
              <Select
                labelId="sale-add-product"
                value={addForm.productId}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, productId: e.target.value }))
                }
                label={i18n.t("inventorySales.sales.items.product")}
              >
                <MenuItem value="">
                  <em>{i18n.t("inventorySales.common.select")}</em>
                </MenuItem>
                {activeProducts.map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.name}
                    {p.sku ? ` (${p.sku})` : ""} — {formatCurrencyBRL(p.salePrice)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box display="flex" flexWrap="wrap" style={{ gap: 12 }}>
              <TextField
                size="small"
                variant="outlined"
                label={i18n.t("inventorySales.sales.items.quantity")}
                value={addForm.quantity}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, quantity: e.target.value }))
                }
                type="number"
                inputProps={{ min: 0, step: "any" }}
                style={{ flex: 1, minWidth: 100 }}
              />
              <TextField
                size="small"
                variant="outlined"
                label={i18n.t("inventorySales.sales.items.unitPriceOptional")}
                value={addForm.unitPrice}
                onChange={(e) =>
                  setAddForm((prev) => ({ ...prev, unitPrice: e.target.value }))
                }
                style={{ flex: 1, minWidth: 120 }}
              />
              <TextField
                size="small"
                variant="outlined"
                label={i18n.t("inventorySales.sales.items.discount")}
                value={addForm.discountAmount}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    discountAmount: e.target.value,
                  }))
                }
                style={{ flex: 1, minWidth: 100 }}
              />
            </Box>
            <Box>
              <AppPrimaryButton
                startIcon={<AddIcon />}
                onClick={handleAddItem}
                disabled={adding}
              >
                {i18n.t("inventorySales.sales.items.addButton")}
              </AppPrimaryButton>
            </Box>
          </Box>
        </Box>
      ) : null}

      <Box mt={2} display="flex" flexDirection="column" alignItems="flex-end" style={{ gap: 4 }}>
        <Typography variant="body2" color="textSecondary">
          {i18n.t("inventorySales.sales.totals.subtotal")}:{" "}
          {formatCurrencyBRL(sale?.subtotalAmount)}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {i18n.t("inventorySales.sales.totals.discount")}:{" "}
          {formatCurrencyBRL(sale?.discountAmount)}
        </Typography>
        <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
          {i18n.t("inventorySales.sales.totals.total")}:{" "}
          {formatCurrencyBRL(sale?.totalAmount)}
        </Typography>
        {sale?.status === "completed" && sale.commissionAmount != null ? (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("inventorySales.sales.totals.commission")} (
            {toNumber(sale.commissionRate)}%):{" "}
            {formatCurrencyBRL(sale.commissionAmount)}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
