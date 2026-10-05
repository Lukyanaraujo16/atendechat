import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Autocomplete from "@material-ui/lab/Autocomplete";
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
  listInventoryProducts,
  updateInventorySaleItem,
} from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import { formatCurrencyBRL, parseBrazilianCurrencyToNumber } from "../../utils/brazilianCurrency";
import { formatQuantity } from "./utils";
import SaleItemIdentifiersEditor from "./SaleItemIdentifiersEditor";
import SaleItemIdentifiersList from "./SaleItemIdentifiersList";
import {
  buildCreateIdentifiersField,
  buildUpdateIdentifiersField,
  emptyIdentifierDraft,
  identifierDraftFromItem,
  identifierPayloadsEqual,
  identifierValuesFromItem,
  validateIdentifiersForSubmit,
} from "./saleItemIdentifiers";
import {
  axiosAbortConfig,
  isAbortError,
  pickExactSaleProduct,
  saleProductShowsBarcode,
  saleProductStockLabel,
  shouldAutofocusSaleProductSearch,
} from "./saleProductSearch";

const useStyles = makeStyles(() => ({
  tableContainer: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    overflowX: "visible",
  },
  table: {
    width: "100%",
    maxWidth: "100%",
    tableLayout: "fixed",
  },
  productCell: {
    minWidth: 0,
    width: "auto",
  },
  numericCell: {
    minWidth: 0,
    width: "16%",
  },
  actionsCell: {
    minWidth: 0,
    width: "12%",
  },
  numericField: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
  },
  identifiersCell: {
    paddingTop: 0,
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
  },
  identifiersInner: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
}));

const emptyAddForm = {
  productId: "",
  quantity: "1",
  unitPrice: "",
  discountAmount: "0",
  ...emptyIdentifierDraft(),
};

function toastIdentifierValidation(result) {
  if (!result || result.ok) return false;
  if (result.code === "duplicate") {
    toast.error(i18n.t("inventorySales.sales.items.identifiers.duplicate"));
    return true;
  }
  if (result.code === "reduceQuantity") {
    toast.error(
      i18n.t("inventorySales.sales.items.identifiers.reduceQuantity", {
        position: result.position,
      })
    );
    return true;
  }
  if (result.code === "integerOnly") {
    toast.error(i18n.t("inventorySales.sales.items.identifiers.integerOnly"));
    return true;
  }
  if (result.code === "fractionalNeedsClear") {
    toast.error(
      i18n.t("inventorySales.sales.items.identifiers.fractionalNeedsClear")
    );
    return true;
  }
  return true;
}

export default function SaleItemsEditor({
  sale,
  readOnly,
  onSaleUpdated,
}) {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [adding, setAdding] = useState(false);
  const [rowSaving, setRowSaving] = useState(null);
  const [rowDrafts, setRowDrafts] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const abortRef = useRef(null);
  const requestSeqRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const searchInputRef = useRef(null);
  const highlightedRef = useRef(null);
  const highlightChosenRef = useRef(false);
  const typedQueryRef = useRef("");

  const items = Array.isArray(sale?.items) ? sale.items : [];
  const saleId = sale?.id;

  const clearProductSearch = useCallback(() => {
    setSelectedProduct(null);
    setInputValue("");
    setOptions([]);
    setSearchError(false);
    setSearchLoading(false);
    setPopupOpen(false);
    highlightedRef.current = null;
    highlightChosenRef.current = false;
    typedQueryRef.current = "";
  }, []);

  const runSearch = useCallback(async (rawTerm, { exactOnSingle, browse }) => {
    const query = String(rawTerm ?? "").trim();
    if (!query && !browse) {
      setOptions([]);
      setSearchLoading(false);
      setSearchError(false);
      setPopupOpen(false);
      return;
    }

    typedQueryRef.current = query;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestSeqRef.current;
    setSearchLoading(true);
    setSearchError(false);
    setPopupOpen(true);

    try {
      const params = { active: true, limit: 20 };
      if (query) params.search = query;
      const { data } = await listInventoryProducts(
        params,
        axiosAbortConfig(controller)
      );
      if (
        controller.signal.aborted ||
        requestId !== requestSeqRef.current ||
        typedQueryRef.current !== query
      ) {
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      setOptions(rows);
      setPopupOpen(true);
      if (exactOnSingle) {
        const picked = pickExactSaleProduct(rows, query);
        if (picked) {
          setSelectedProduct(picked);
          setInputValue(picked.name || "");
          setAddForm((prev) => ({ ...prev, productId: String(picked.id) }));
        }
      }
    } catch (err) {
      if (
        controller.signal.aborted ||
        isAbortError(err) ||
        requestId !== requestSeqRef.current ||
        typedQueryRef.current !== query
      ) {
        return;
      }
      setSearchError(true);
      setOptions([]);
      setPopupOpen(true);
    } finally {
      if (requestId === requestSeqRef.current && !controller.signal.aborted) {
        setSearchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    clearProductSearch();
    setAddForm(emptyAddForm);
    return () => {
      if (abortRef.current) abortRef.current.abort();
      clearTimeout(debounceTimerRef.current);
    };
  }, [saleId, clearProductSearch]);

  useEffect(() => {
    if (readOnly) return undefined;
    const query = inputValue.trim();
    const queryChanged = typedQueryRef.current !== query;
    typedQueryRef.current = query;
    if (!query && !popupOpen) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setOptions([]);
      setSearchLoading(false);
      setSearchError(false);
      return undefined;
    }
    if (!query) {
      runSearch("", { exactOnSingle: false, browse: true });
      return undefined;
    }
    if (
      selectedProduct &&
      query === String(selectedProduct.name || "").trim()
    ) {
      setSearchLoading(false);
      return undefined;
    }
    if (!queryChanged) return undefined;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    debounceTimerRef.current = setTimeout(() => {
      runSearch(query, { exactOnSingle: false });
    }, 300);
    return () => clearTimeout(debounceTimerRef.current);
  }, [inputValue, popupOpen, readOnly, selectedProduct, runSearch]);

  const focusSearchIfWide = () => {
    if (!shouldAutofocusSaleProductSearch()) return;
    window.requestAnimationFrame(() => {
      if (searchInputRef.current) searchInputRef.current.focus();
    });
  };

  const displayOptions =
    selectedProduct && !options.some((row) => row.id === selectedProduct.id)
      ? [selectedProduct, ...options]
      : options;

  const getRowDraft = (item) => {
    const identifierDefaults = identifierDraftFromItem(item);
    if (!item?.id) {
      return {
        quantity: "",
        unitPrice: "",
        discountAmount: "0",
        ...identifierDefaults,
      };
    }
    return {
      quantity: String(item.quantity ?? ""),
      unitPrice: String(item.unitPrice ?? ""),
      discountAmount: String(item.discountAmount ?? "0"),
      ...identifierDefaults,
      ...rowDrafts[item.id],
    };
  };

  const patchRowDraft = (itemId, patch) => {
    const item = items.find((i) => i.id === itemId);
    const base = item
      ? {
          quantity: String(item.quantity ?? ""),
          unitPrice: String(item.unitPrice ?? ""),
          discountAmount: String(item.discountAmount ?? "0"),
          ...identifierDraftFromItem(item),
        }
      : {
          quantity: "",
          unitPrice: "",
          discountAmount: "0",
          ...emptyIdentifierDraft(),
        };
    setRowDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...base,
        ...prev[itemId],
        ...patch,
      },
    }));
  };

  const setRowField = (itemId, field, value) => {
    patchRowDraft(itemId, { [field]: value });
  };

  const handleQuantityBlur = (item) => {
    const draft = getRowDraft(item);
    const result = validateIdentifiersForSubmit({
      quantity: draft.quantity,
      values: draft.identifierValues,
    });
    if (
      result.code === "reduceQuantity" ||
      result.code === "integerOnly" ||
      result.code === "fractionalNeedsClear"
    ) {
      toastIdentifierValidation(result);
    }
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

    const identifierCheck = validateIdentifiersForSubmit({
      quantity,
      values: addForm.identifierValues,
    });
    if (!identifierCheck.ok) {
      toastIdentifierValidation(identifierCheck);
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

    const identifiersField = buildCreateIdentifiersField({
      quantity,
      values: addForm.identifierValues,
    });
    if (identifiersField.include) {
      payload.identifiers = identifiersField.identifiers;
    }

    setAdding(true);
    try {
      await addInventorySaleItem(sale.id, payload);
      toast.success(i18n.t("inventorySales.sales.items.toasts.added"));
      setAddForm(emptyAddForm);
      clearProductSearch();
      focusSearchIfWide();
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

    const identifierCheck = validateIdentifiersForSubmit({
      quantity,
      values: draft.identifierValues,
    });
    if (!identifierCheck.ok) {
      toastIdentifierValidation(identifierCheck);
      return;
    }

    const payload = {
      quantity,
      unitPrice,
      discountAmount,
    };
    const identifiersField = buildUpdateIdentifiersField({
      identifiersTouched: draft.identifiersTouched,
      quantity,
      values: draft.identifierValues,
      originalValues: identifierValuesFromItem(item),
    });
    if (identifiersField.include) {
      payload.identifiers = identifiersField.identifiers;
    }

    setRowSaving(item.id);
    try {
      await updateInventorySaleItem(sale.id, item.id, payload);
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

  const renderIdentifiers = (item, draft) => {
    if (readOnly) {
      return <SaleItemIdentifiersList item={item} />;
    }
    return (
      <SaleItemIdentifiersEditor
        itemId={item.id}
        quantity={draft.quantity}
        values={draft.identifierValues}
        extraPositions={draft.extraPositions}
        onChange={(next) =>
          patchRowDraft(item.id, {
            identifierValues: next.identifierValues,
            extraPositions: next.extraPositions,
            identifiersTouched: true,
          })
        }
      />
    );
  };

  const renderItemActions = (item) => {
    if (readOnly) return null;
    const draft = getRowDraft(item);
    const originalQty = String(item.quantity ?? "");
    const originalPrice = String(item.unitPrice ?? "");
    const originalDiscount = String(item.discountAmount ?? "0");
    const identifiersDirty =
      draft.identifiersTouched &&
      !identifierPayloadsEqual(
        draft.identifierValues,
        identifierValuesFromItem(item)
      );
    const dirty =
      draft.quantity !== originalQty ||
      draft.unitPrice !== originalPrice ||
      draft.discountAmount !== originalDiscount ||
      identifiersDirty;

    return (
      <Box display="flex" justifyContent="flex-end">
        {dirty ? (
          <IconButton
            size="small"
            onClick={() => handleUpdateItem(item)}
            disabled={rowSaving === item.id}
            data-testid={`sale-item-save-${item.id}`}
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
              const identifiersBlock = renderIdentifiers(item, draft);
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
                      {identifiersBlock ? (
                        <Box mt={1} style={{ minWidth: 0, maxWidth: "100%" }}>
                          {identifiersBlock}
                        </Box>
                      ) : null}
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
                        onBlur={() => handleQuantityBlur(item)}
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
                      {identifiersBlock ? (
                        <Box mt={1} style={{ minWidth: 0, maxWidth: "100%" }}>
                          {identifiersBlock}
                        </Box>
                      ) : null}
                    </>
                  )}
                </MobileEntityCard>
              );
            })}
          </MobileCardList>
        ) : (
          <AppTableContainer
            nested
            className={classes.tableContainer}
            style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "visible" }}
          >
            <Table
              size="small"
              className={classes.table}
              style={{ width: "100%", maxWidth: "100%", tableLayout: "fixed" }}
            >
              <TableHead>
                <TableRow>
                  <TableCell className={classes.productCell}>{i18n.t("inventorySales.sales.items.product")}</TableCell>
                  <TableCell align="right" className={classes.numericCell}>
                    {i18n.t("inventorySales.sales.items.quantity")}
                  </TableCell>
                  <TableCell align="right" className={classes.numericCell}>
                    {i18n.t("inventorySales.sales.items.unitPrice")}
                  </TableCell>
                  <TableCell align="right" className={classes.numericCell}>
                    {i18n.t("inventorySales.sales.items.discount")}
                  </TableCell>
                  <TableCell align="right" className={classes.numericCell}>
                    {i18n.t("inventorySales.sales.items.total")}
                  </TableCell>
                  {!readOnly ? (
                    <TableCell align="right" className={classes.actionsCell}>
                      {i18n.t("inventorySales.common.actions")}
                    </TableCell>
                  ) : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const draft = getRowDraft(item);
                  const colSpan = readOnly ? 5 : 6;
                  const identifiersBlock = renderIdentifiers(item, draft);
                  return (
                    <React.Fragment key={item.id}>
                      <TableRow>
                        <TableCell className={classes.productCell}>
                          <Typography variant="body2">{item.productName}</Typography>
                          {item.productSku ? (
                            <Typography variant="caption" color="textSecondary">
                              {item.productSku}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell align="right" className={classes.numericCell}>
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
                              onBlur={() => handleQuantityBlur(item)}
                              type="number"
                              inputProps={{ min: 0, step: "any" }}
                              className={classes.numericField}
                              fullWidth
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" className={classes.numericCell}>
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
                              className={classes.numericField}
                              fullWidth
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" className={classes.numericCell}>
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
                              className={classes.numericField}
                              fullWidth
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" className={classes.numericCell}>
                          {formatCurrencyBRL(item.totalAmount)}
                        </TableCell>
                        {!readOnly ? (
                          <TableCell align="right" className={classes.actionsCell}>{renderItemActions(item)}</TableCell>
                        ) : null}
                      </TableRow>
                      {identifiersBlock ? (
                        <TableRow>
                          <TableCell
                            colSpan={colSpan}
                            className={classes.identifiersCell}
                            data-testid={`sale-item-identifiers-cell-${item.id}`}
                            style={{
                              paddingTop: 0,
                              minWidth: 0,
                              width: "100%",
                              maxWidth: "100%",
                            }}
                          >
                            <Box
                              className={classes.identifiersInner}
                              data-testid={`sale-item-identifiers-wrap-${item.id}`}
                              style={{
                                width: "100%",
                                maxWidth: "100%",
                                minWidth: 0,
                              }}
                            >
                              {identifiersBlock}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
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
            <Autocomplete
              options={displayOptions}
              value={selectedProduct}
              inputValue={inputValue}
              open={popupOpen}
              onOpen={() => {
                setPopupOpen(true);
              }}
              onClose={() => {
                highlightedRef.current = null;
                highlightChosenRef.current = false;
                if (abortRef.current) abortRef.current.abort();
                setSearchLoading(false);
                setPopupOpen(false);
              }}
              onHighlightChange={(_, option, reason) => {
                highlightedRef.current = option || null;
                if (reason === "keyboard" || reason === "mouse") {
                  highlightChosenRef.current = true;
                }
              }}
              onChange={(_, value) => {
                setSelectedProduct(value);
                setAddForm((prev) => ({
                  ...prev,
                  productId: value?.id != null ? String(value.id) : "",
                }));
              }}
              onInputChange={(_, value, reason) => {
                setInputValue(value);
                if (reason === "input" || reason === "clear") {
                  highlightChosenRef.current = false;
                  setSelectedProduct(null);
                  setAddForm((prev) => ({ ...prev, productId: "" }));
                  if (reason === "clear") {
                    setSearchError(false);
                    setPopupOpen(true);
                  }
                }
              }}
              loading={searchLoading}
              filterOptions={(opts) => opts}
              getOptionSelected={(option, value) => option.id === value.id}
              getOptionLabel={(option) => option?.name || ""}
              noOptionsText={
                searchError
                  ? i18n.t("inventorySales.sales.items.search.error")
                  : i18n.t("inventorySales.sales.items.search.empty")
              }
              loadingText={i18n.t("inventorySales.sales.items.search.loading")}
              renderOption={(option) => (
                <Box>
                  <Typography variant="body2">{option.name}</Typography>
                  {option.sku && String(option.sku).trim() ? (
                    <Typography variant="caption" color="textSecondary" display="block">
                      {i18n.t("inventorySales.sales.items.search.sku", {
                        sku: String(option.sku).trim(),
                      })}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" color="textSecondary" display="block">
                    {formatCurrencyBRL(option.salePrice)}
                    {" · "}
                    {saleProductStockLabel(option)}
                    {saleProductShowsBarcode(option, inputValue)
                      ? ` · ${option.barcode}`
                      : ""}
                  </Typography>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={i18n.t("inventorySales.sales.items.product")}
                  placeholder={i18n.t("inventorySales.sales.items.search.placeholder")}
                  variant="outlined"
                  size="small"
                  autoFocus={shouldAutofocusSaleProductSearch()}
                  inputProps={{
                    ...params.inputProps,
                    "data-testid": "sale-product-search",
                    onKeyDownCapture: (event) => {
                      if (event.key !== "Enter") return;
                      if (popupOpen && highlightedRef.current && highlightChosenRef.current) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      clearTimeout(debounceTimerRef.current);
                      runSearch(event.currentTarget.value, { exactOnSingle: true });
                    },
                    ref: (node) => {
                      const inputRef = params.inputProps.ref;
                      if (typeof inputRef === "function") inputRef(node);
                      else if (inputRef) inputRef.current = node;
                      searchInputRef.current = node;
                    },
                  }}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {searchLoading ? (
                          <CircularProgress color="inherit" size={18} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
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
            <SaleItemIdentifiersEditor
              quantity={addForm.quantity}
              values={addForm.identifierValues}
              extraPositions={addForm.extraPositions}
              onChange={(next) =>
                setAddForm((prev) => ({
                  ...prev,
                  identifierValues: next.identifierValues,
                  extraPositions: next.extraPositions,
                  identifiersTouched: true,
                }))
              }
            />
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
    </Box>
  );
}
