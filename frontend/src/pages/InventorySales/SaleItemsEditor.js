import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@material-ui/core";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
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
import {
  formatQuantity,
  normalizeQuantityInputValue,
  parseQuantityValue,
  quantityValuesEqual,
} from "./utils";
import CurrencyInput from "./CurrencyInput";
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
import {
  formatSaleItemProductLabel,
  isVariableProduct,
} from "./inventoryProductKind";
import SaleVariantPickerDialog from "./SaleVariantPickerDialog";
import { computeItemDiscountPreview } from "./saleDiscountPreview";
import InventoryDiscountAuthorizationDialog from "./InventoryDiscountAuthorizationDialog";
import {
  buildDiscountAuthorizationBody,
  discountAuthorizationRequiredMessage,
  isDiscountAuthorizationRequiredError,
} from "./inventoryDiscountAuth";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import {
  formatPercentDraftValue,
  parsePercentInput,
  percentEqual,
  sanitizePercentTyping,
} from "./inventoryPercentInput";

export {
  formatPercentDraftValue,
  parsePercentInput,
  sanitizePercentTyping,
} from "./inventoryPercentInput";

const useStyles = makeStyles((theme) => ({
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
  headerCell: {
    whiteSpace: "nowrap",
  },
  productCell: {
    minWidth: 0,
    width: "32%",
  },
  qtyCell: {
    minWidth: 72,
    width: "11%",
  },
  priceCell: {
    minWidth: 0,
    width: "16%",
  },
  discountCell: {
    minWidth: 0,
    width: "22%",
  },
  totalCell: {
    minWidth: 0,
    width: "10%",
  },
  actionsCell: {
    minWidth: 0,
    width: "8%",
  },
  numericField: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
  },
  qtyField: {
    width: "100%",
    maxWidth: 96,
    minWidth: 64,
    marginLeft: "auto",
    "& input": {
      textAlign: "center",
    },
    [theme.breakpoints.down("sm")]: {
      maxWidth: "100%",
      marginLeft: 0,
    },
  },
  discountControl: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
    maxWidth: 280,
    minWidth: 0,
    marginLeft: "auto",
    [theme.breakpoints.down("sm")]: {
      maxWidth: "100%",
      marginLeft: 0,
    },
  },
  discountTypeGroup: {
    flexShrink: 0,
    "& .MuiToggleButton-root": {
      padding: "4px 8px",
      lineHeight: 1.2,
      minWidth: 36,
    },
  },
  discountInputWrap: {
    flex: "1 1 120px",
    minWidth: 108,
    maxWidth: 168,
    "& input[type=number]": {
      MozAppearance: "textfield",
    },
    "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
      WebkitAppearance: "none",
      margin: 0,
    },
    [theme.breakpoints.down("sm")]: {
      maxWidth: "none",
    },
  },
  addFormRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-end",
  },
  addQtySlot: {
    flex: "0 1 96px",
    maxWidth: 110,
    minWidth: 80,
  },
  addPriceSlot: {
    flex: "1 1 140px",
    maxWidth: 200,
    minWidth: 120,
  },
  addDiscountSlot: {
    flex: "1 1 220px",
    maxWidth: 280,
    minWidth: 200,
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
  variantId: "",
  quantity: "1",
  unitPrice: "",
  discountType: "percentage",
  discountPercent: "",
  discountAmount: "0",
  ...emptyIdentifierDraft(),
};

/** Debounce curto para preço/desconto digitados (CurrencyInput). */
const AUTO_SAVE_MONEY_DEBOUNCE_MS = 450;
/** Quantidade (setas/input) — delay curto para agrupar +/- rápidos. */
const AUTO_SAVE_QTY_DEBOUNCE_MS = 250;

function moneyEqual(left, right) {
  const a = parseBrazilianCurrencyToNumber(left) ?? 0;
  const b = parseBrazilianCurrencyToNumber(right) ?? 0;
  return Math.round(a * 100) === Math.round(b * 100);
}

function moneyAmount(value) {
  if (value === "" || value == null) return 0;
  return parseBrazilianCurrencyToNumber(value) ?? Number(value) ?? 0;
}

/**
 * Preferência visual % para novos/zero.
 * Preserva fixed legado (null + amount > 0) e percentage persistido.
 */
export function resolveItemDiscountType(item) {
  if (item?.discountType === "percentage") return "percentage";
  if (item?.discountType === "fixed") return "fixed";
  if (moneyAmount(item?.discountAmount) > 0) return "fixed";
  return "percentage";
}

function discountDraftFromItem(item) {
  const type = resolveItemDiscountType(item);
  return {
    discountType: type,
    discountPercent:
      type === "percentage"
        ? formatPercentDraftValue(item?.discountPercent)
        : "",
    discountAmount: String(item?.discountAmount ?? "0"),
  };
}

/**
 * Payload autoritativo de desconto do item.
 * Percentual: digitação direta (não CurrencyInput). Vírgula → número.
 */
export function buildItemDiscountPayload(draft) {
  const type = draft.discountType === "percentage" ? "percentage" : "fixed";
  if (type === "percentage") {
    const raw = draft.discountPercent;
    if (raw === "" || raw == null) {
      return { discountType: "percentage", discountPercent: 0 };
    }
    const pct = parsePercentInput(raw);
    if (pct == null || pct < 0) {
      return { discountType: "percentage", discountPercent: 0 };
    }
    return {
      discountType: "percentage",
      discountPercent: Math.min(100, pct),
    };
  }
  const discountAmount =
    parseBrazilianCurrencyToNumber(draft.discountAmount) ?? 0;
  return { discountType: "fixed", discountAmount };
}

function previewLineTotal(draft, item) {
  const quantity = parseQuantityValue(draft.quantity);
  const unitPrice =
    parseBrazilianCurrencyToNumber(draft.unitPrice) ??
    Number(item?.unitPrice) ??
    0;
  if (quantity == null || quantity <= 0) {
    return Number(item?.totalAmount) || 0;
  }
  const built = buildItemDiscountPayload(draft);
  return computeItemDiscountPreview({
    discountType: built.discountType,
    discountPercent: built.discountPercent,
    discountAmount: built.discountAmount,
    unitPrice,
    quantity,
  }).lineTotal;
}

function formatItemDiscountDisplay(item, draft) {
  const type =
    (draft?.discountType ?? item?.discountType) === "percentage"
      ? "percentage"
      : item?.discountType === "percentage"
        ? "percentage"
        : "fixed";
  const amount = draft?.discountAmount ?? item?.discountAmount ?? 0;
  if (type === "percentage") {
    const pct = draft?.discountPercent ?? item?.discountPercent;
    if (pct != null && pct !== "") {
      return i18n.t("inventorySales.sales.items.discountPercentDisplay", {
        percent: pct,
        amount: formatCurrencyBRL(amount),
      });
    }
  }
  return formatCurrencyBRL(amount);
}

function SaleItemDiscountFields({
  draft,
  disabled,
  onTypeChange,
  onFixedChange,
  onPercentChange,
  onBlur,
  testIdPrefix,
  className,
  controlClassName,
  typeGroupClassName,
  inputWrapClassName,
}) {
  const isPercent = draft.discountType === "percentage";
  return (
    <Box
      className={controlClassName || className}
      data-testid={testIdPrefix ? `${testIdPrefix}-control` : undefined}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={isPercent ? "percentage" : "fixed"}
        onChange={onTypeChange}
        className={typeGroupClassName}
        aria-label={i18n.t("inventorySales.sales.items.discount")}
      >
        <ToggleButton
          value="fixed"
          disabled={disabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-type-fixed` : undefined}
        >
          R$
        </ToggleButton>
        <ToggleButton
          value="percentage"
          disabled={disabled}
          data-testid={testIdPrefix ? `${testIdPrefix}-type-percent` : undefined}
        >
          %
        </ToggleButton>
      </ToggleButtonGroup>
      <Box className={inputWrapClassName}>
        {isPercent ? (
          <TextField
            size="small"
            variant="outlined"
            type="text"
            value={draft.discountPercent}
            onChange={onPercentChange}
            onBlur={onBlur}
            disabled={disabled}
            fullWidth
            inputProps={{
              inputMode: "decimal",
              "data-testid": testIdPrefix
                ? `${testIdPrefix}-percent`
                : undefined,
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">%</InputAdornment>
              ),
            }}
          />
        ) : (
          <CurrencyInput
            value={Number(draft.discountAmount) || 0}
            onChange={onFixedChange}
            onBlur={onBlur}
            disabled={disabled}
            fullWidth
            data-testid={testIdPrefix ? `${testIdPrefix}-amount` : undefined}
          />
        )}
      </Box>
    </Box>
  );
}

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

const SaleItemsEditor = forwardRef(function SaleItemsEditor(
  {
    sale,
    readOnly,
    onSaleUpdated,
    /** Wizard PDV: persiste qty/preço/desconto sem botão salvar. Drawer legado: false. */
    autoSave = false,
    canApplyDiscount = true,
  },
  ref
) {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const perms = useInventoryPermissions();
  const [authOpen, setAuthOpen] = useState(false);
  const [authDetail, setAuthDetail] = useState("");
  const [authConfirming, setAuthConfirming] = useState(false);
  const pendingItemSaveRef = useRef(null);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [adding, setAdding] = useState(false);
  const [rowSaving, setRowSaving] = useState(null);
  const [rowDrafts, setRowDrafts] = useState({});
  const [saveErrors, setSaveErrors] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState(null);
  const abortRef = useRef(null);
  const requestSeqRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const searchInputRef = useRef(null);
  const highlightedRef = useRef(null);
  const highlightChosenRef = useRef(false);
  const typedQueryRef = useRef("");
  const rowDraftsRef = useRef({});
  const itemsRef = useRef([]);
  const autoSaveTimersRef = useRef({});
  const saveSeqByItemRef = useRef({});
  const inflightByItemRef = useRef({});

  const items = Array.isArray(sale?.items) ? sale.items : [];
  const saleId = sale?.id;

  useEffect(() => {
    rowDraftsRef.current = rowDrafts;
  }, [rowDrafts]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const clearProductSearch = useCallback(() => {
    setSelectedProduct(null);
    setInputValue("");
    setOptions([]);
    setSearchError(false);
    setSearchLoading(false);
    setPopupOpen(false);
    setVariantPickerOpen(false);
    setVariantPickerProduct(null);
    highlightedRef.current = null;
    highlightChosenRef.current = false;
    typedQueryRef.current = "";
  }, []);

  const applySaleProductSelection = useCallback((product) => {
    if (!product) {
      setSelectedProduct(null);
      setAddForm((prev) => ({
        ...prev,
        productId: "",
        variantId: "",
        unitPrice: "",
      }));
      return;
    }
    if (isVariableProduct(product)) {
      if (product.selectedVariant) {
        const variant = product.selectedVariant;
        setSelectedProduct({ ...product, selectedVariant: variant });
        setAddForm((prev) => ({
          ...prev,
          productId: String(product.id),
          variantId: String(variant.id),
          unitPrice:
            variant.salePrice != null ? String(variant.salePrice) : "",
        }));
        return;
      }
      setSelectedProduct(product);
      setAddForm((prev) => ({
        ...prev,
        productId: String(product.id),
        variantId: "",
        unitPrice: "",
      }));
      setVariantPickerProduct(product);
      setVariantPickerOpen(true);
      return;
    }
    setSelectedProduct(product);
    setAddForm((prev) => ({
      ...prev,
      productId: String(product.id),
      variantId: "",
      unitPrice: "",
    }));
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
          applySaleProductSelection(picked);
          setInputValue(picked.name || "");
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
  }, [applySaleProductSelection]);

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

  const itemQuantityDraftValue = (item) =>
    normalizeQuantityInputValue(item?.quantity);

  const getRowDraft = (item) => {
    const identifierDefaults = identifierDraftFromItem(item);
    const discountDefaults = discountDraftFromItem(item);
    if (!item?.id) {
      return {
        quantity: "",
        unitPrice: "",
        ...discountDefaults,
        ...identifierDefaults,
      };
    }
    return {
      quantity: itemQuantityDraftValue(item),
      unitPrice: String(item.unitPrice ?? ""),
      ...discountDefaults,
      ...identifierDefaults,
      ...rowDrafts[item.id],
    };
  };

  const patchRowDraft = (itemId, patch) => {
    const item = items.find((i) => i.id === itemId) ||
      itemsRef.current.find((i) => i.id === itemId);
    const base = item
      ? {
          quantity: itemQuantityDraftValue(item),
          unitPrice: String(item.unitPrice ?? ""),
          ...discountDraftFromItem(item),
          ...identifierDraftFromItem(item),
        }
      : {
          quantity: "",
          unitPrice: "",
          discountType: "percentage",
          discountPercent: "",
          discountAmount: "0",
          ...emptyIdentifierDraft(),
        };
    setRowDrafts((prev) => {
      const next = {
        ...prev,
        [itemId]: {
          ...base,
          ...prev[itemId],
          ...patch,
        },
      };
      rowDraftsRef.current = next;
      return next;
    });
  };

  const getDraftForItem = (item) => {
    const identifierDefaults = identifierDraftFromItem(item);
    const fromRef = rowDraftsRef.current[item.id];
    return {
      quantity: itemQuantityDraftValue(item),
      unitPrice: String(item.unitPrice ?? ""),
      ...discountDraftFromItem(item),
      ...identifierDefaults,
      ...fromRef,
    };
  };

  const isRowDirty = (item) => {
    const draft = getDraftForItem(item);
    const savedDiscount = discountDraftFromItem(item);
    const identifiersDirty =
      draft.identifiersTouched &&
      !identifierPayloadsEqual(
        draft.identifierValues,
        identifierValuesFromItem(item)
      );
    const discountDirty =
      (draft.discountType === "percentage"
        ? "percentage"
        : "fixed") !== savedDiscount.discountType ||
      (draft.discountType === "percentage"
        ? !percentEqual(draft.discountPercent, item.discountPercent ?? "")
        : !moneyEqual(draft.discountAmount, item.discountAmount ?? "0"));
    return (
      !quantityValuesEqual(draft.quantity, item.quantity) ||
      !moneyEqual(draft.unitPrice, item.unitPrice) ||
      discountDirty ||
      identifiersDirty
    );
  };

  /** Remove drafts já sincronizados com o item (após refresh), sem apagar mid-edit. */
  useEffect(() => {
    setRowDrafts((prev) => {
      const ids = Object.keys(prev);
      if (!ids.length) return prev;
      let changed = false;
      const next = { ...prev };
      ids.forEach((id) => {
        const item = items.find((row) => String(row.id) === String(id));
        if (!item) return;
        const draft = {
          quantity: itemQuantityDraftValue(item),
          unitPrice: String(item.unitPrice ?? ""),
          ...discountDraftFromItem(item),
          ...identifierDraftFromItem(item),
          ...next[id],
        };
        const identifiersDirty =
          draft.identifiersTouched &&
          !identifierPayloadsEqual(
            draft.identifierValues,
            identifierValuesFromItem(item)
          );
        const discountDirty =
          (draft.discountType === "percentage"
            ? "percentage"
            : "fixed") !== discountDraftFromItem(item).discountType ||
          (draft.discountType === "percentage"
            ? !percentEqual(draft.discountPercent, item.discountPercent ?? "")
            : !moneyEqual(draft.discountAmount, item.discountAmount ?? "0"));
        const dirty =
          !quantityValuesEqual(draft.quantity, item.quantity) ||
          !moneyEqual(draft.unitPrice, item.unitPrice) ||
          discountDirty ||
          identifiersDirty;
        // Não podar digitação intermediária ("1.", "0.") — só drafts já canônicos.
        const quantityCommitted =
          String(draft.quantity ?? "") ===
          normalizeQuantityInputValue(draft.quantity);
        if (!dirty && quantityCommitted) {
          delete next[id];
          changed = true;
        }
      });
      if (!changed) return prev;
      rowDraftsRef.current = next;
      return next;
    });
  }, [items]);

  const clearAutoSaveTimer = (itemId) => {
    const timer = autoSaveTimersRef.current[itemId];
    if (timer) {
      clearTimeout(timer);
      delete autoSaveTimersRef.current[itemId];
    }
  };

  const persistItem = async (
    item,
    { fromAutoSave = false, discountAuthorization } = {}
  ) => {
    if (!sale?.id || !item?.id) return { ok: false };
    const draft = getDraftForItem(item);
    const quantity = parseQuantityValue(draft.quantity);
    if (quantity == null || quantity <= 0) {
      if (!fromAutoSave) {
        toast.error(i18n.t("inventorySales.sales.items.validation.quantity"));
      }
      return { ok: false };
    }
    const unitPrice = parseBrazilianCurrencyToNumber(draft.unitPrice);
    if (unitPrice == null || unitPrice < 0) {
      if (!fromAutoSave) {
        toast.error(i18n.t("inventorySales.sales.items.validation.unitPrice"));
      }
      return { ok: false };
    }

    const identifierCheck = validateIdentifiersForSubmit({
      quantity,
      values: draft.identifierValues,
    });
    if (!identifierCheck.ok) {
      toastIdentifierValidation(identifierCheck);
      return { ok: false };
    }

    if (!isRowDirty(item) && !fromAutoSave) {
      return { ok: true };
    }
    // Autosave: se não está dirty, nada a fazer.
    if (fromAutoSave && !isRowDirty(item)) {
      return { ok: true };
    }

    const payload = {
      quantity,
      unitPrice,
      ...buildItemDiscountPayload(draft),
    };
    if (discountAuthorization) {
      payload.discountAuthorization = discountAuthorization;
    }
    const identifiersField = buildUpdateIdentifiersField({
      identifiersTouched: draft.identifiersTouched,
      quantity,
      values: draft.identifierValues,
      originalValues: identifierValuesFromItem(item),
    });
    if (identifiersField.include) {
      payload.identifiers = identifiersField.identifiers;
    }

    const seq = (saveSeqByItemRef.current[item.id] || 0) + 1;
    saveSeqByItemRef.current[item.id] = seq;
    setRowSaving(item.id);
    setSaveErrors((prev) => {
      if (!prev[item.id]) return prev;
      const next = { ...prev };
      delete next[item.id];
      return next;
    });

    const run = (async () => {
      try {
        await updateInventorySaleItem(sale.id, item.id, payload);
        if (saveSeqByItemRef.current[item.id] !== seq) {
          return { ok: true, stale: true };
        }
        // Mantém draft alinhado ao payload salvo até o refresh do parent —
        // evita flicker R$↔% (apagar draft antes do item atualizar voltava ao tipo antigo).
        const discountPayload = buildItemDiscountPayload(draft);
        const syncedDraft = {
          ...draft,
          quantity: normalizeQuantityInputValue(payload.quantity),
          unitPrice: String(payload.unitPrice),
          discountType:
            discountPayload.discountType === "percentage"
              ? "percentage"
              : "fixed",
          discountPercent:
            discountPayload.discountType === "percentage"
              ? formatPercentDraftValue(discountPayload.discountPercent)
              : draft.discountPercent ?? "",
          discountAmount:
            discountPayload.discountType === "percentage"
              ? draft.discountAmount
              : String(discountPayload.discountAmount ?? 0),
        };
        setRowDrafts((prev) => {
          if (saveSeqByItemRef.current[item.id] !== seq) return prev;
          const next = { ...prev, [item.id]: syncedDraft };
          rowDraftsRef.current = next;
          return next;
        });
        if (onSaleUpdated) await onSaleUpdated();
        if (saveSeqByItemRef.current[item.id] !== seq) {
          return { ok: true, stale: true };
        }
        if (!fromAutoSave) {
          toast.success(i18n.t("inventorySales.sales.items.toasts.updated"));
        }
        return { ok: true };
      } catch (err) {
        if (saveSeqByItemRef.current[item.id] !== seq) {
          return { ok: false, stale: true };
        }
        if (
          isDiscountAuthorizationRequiredError(err) &&
          !discountAuthorization
        ) {
          pendingItemSaveRef.current = {
            item,
            fromAutoSave,
            draftSnapshot: { ...draft },
          };
          setAuthDetail(discountAuthorizationRequiredMessage(err));
          setAuthOpen(true);
          return { ok: false, needsAuth: true, error: err };
        }
        setSaveErrors((prev) => ({ ...prev, [item.id]: true }));
        toastError(err);
        return { ok: false, error: err };
      } finally {
        if (saveSeqByItemRef.current[item.id] === seq) {
          setRowSaving((current) => (current === item.id ? null : current));
        }
        delete inflightByItemRef.current[item.id];
      }
    })();

    inflightByItemRef.current[item.id] = run;
    return run;
  };

  const scheduleAutoSave = (itemId, delayMs) => {
    if (!autoSave || readOnly) return;
    clearAutoSaveTimer(itemId);
    autoSaveTimersRef.current[itemId] = setTimeout(() => {
      delete autoSaveTimersRef.current[itemId];
      const item = itemsRef.current.find((row) => row.id === itemId);
      if (!item) return;
      persistItem(item, { fromAutoSave: true });
    }, delayMs);
  };

  const setRowField = (itemId, field, value) => {
    patchRowDraft(itemId, { [field]: value });
    if (!autoSave || readOnly) return;
    if (field === "quantity") {
      scheduleAutoSave(itemId, AUTO_SAVE_QTY_DEBOUNCE_MS);
    } else if (
      field === "unitPrice" ||
      field === "discountAmount" ||
      field === "discountType" ||
      field === "discountPercent"
    ) {
      scheduleAutoSave(itemId, AUTO_SAVE_MONEY_DEBOUNCE_MS);
    }
  };

  const flushItemNow = async (item) => {
    if (!autoSave || readOnly || !item?.id) return { ok: true };
    clearAutoSaveTimer(item.id);
    if (inflightByItemRef.current[item.id]) {
      await inflightByItemRef.current[item.id];
    }
    const latest = itemsRef.current.find((row) => row.id === item.id) || item;
    if (!isRowDirty(latest)) return { ok: true };
    return persistItem(latest, { fromAutoSave: true });
  };

  const flushPendingSaves = async () => {
    Object.keys(autoSaveTimersRef.current).forEach((id) => {
      clearAutoSaveTimer(Number(id) || id);
    });
    const pendingIds = new Set([
      ...Object.keys(rowDraftsRef.current).map((id) => Number(id) || id),
      ...Object.keys(inflightByItemRef.current).map((id) => Number(id) || id),
    ]);
    const results = [];
    for (const id of pendingIds) {
      if (inflightByItemRef.current[id]) {
        results.push(await inflightByItemRef.current[id]);
      }
      const item = itemsRef.current.find((row) => row.id === id);
      if (item && isRowDirty(item)) {
        results.push(await persistItem(item, { fromAutoSave: true }));
      }
    }
    if (results.some((result) => result && result.ok === false && !result.stale)) {
      const err = new Error("autosave-failed");
      err.code = "autosave-failed";
      throw err;
    }
  };

  useImperativeHandle(ref, () => ({
    flushPendingSaves,
    hasPendingWork: () =>
      Object.keys(autoSaveTimersRef.current).length > 0 ||
      Object.keys(inflightByItemRef.current).length > 0 ||
      itemsRef.current.some((item) => isRowDirty(item)),
  }));

  useEffect(() => {
    return () => {
      Object.keys(autoSaveTimersRef.current).forEach((id) => {
        clearAutoSaveTimer(Number(id) || id);
      });
    };
  }, []);

  const handleQuantityBlur = (item) => {
    const draft = getRowDraft(item);
    const normalized = normalizeQuantityInputValue(draft.quantity);
    if (normalized !== String(draft.quantity ?? "")) {
      patchRowDraft(item.id, { quantity: normalized });
    }
    const latest = {
      ...draft,
      quantity: normalized !== String(draft.quantity ?? "") ? normalized : draft.quantity,
    };
    const result = validateIdentifiersForSubmit({
      quantity: latest.quantity,
      values: latest.identifierValues,
    });
    if (
      result.code === "reduceQuantity" ||
      result.code === "integerOnly" ||
      result.code === "fractionalNeedsClear"
    ) {
      toastIdentifierValidation(result);
      return;
    }
    if (autoSave) {
      flushItemNow(item);
    }
  };

  const handleMoneyBlur = (item) => {
    if (autoSave) {
      flushItemNow(item);
    }
  };

  const handleIdentifiersBlur = (item) => {
    if (autoSave) {
      flushItemNow(item);
    }
  };

  const handleAddItem = async () => {
    if (!sale?.id) return;
    const productId = Number(addForm.productId);
    if (!Number.isFinite(productId)) {
      toast.error(i18n.t("inventorySales.sales.items.validation.product"));
      return;
    }
    const quantity = parseQuantityValue(addForm.quantity);
    if (quantity == null || quantity <= 0) {
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

    if (isVariableProduct(selectedProduct) && !addForm.variantId) {
      toast.error(
        i18n.t("inventorySales.sales.items.variants.validation.required")
      );
      return;
    }

    const payload = { productId, quantity };
    if (addForm.variantId) {
      payload.variantId = Number(addForm.variantId);
    }
    if (
      addForm.unitPrice !== "" &&
      addForm.unitPrice != null
    ) {
      const unitPrice = parseBrazilianCurrencyToNumber(addForm.unitPrice);
      if (unitPrice == null || unitPrice < 0) {
        toast.error(i18n.t("inventorySales.sales.items.validation.unitPrice"));
        return;
      }
      payload.unitPrice = unitPrice;
    }
    const discountPayload = buildItemDiscountPayload(addForm);
    if (
      discountPayload.discountType === "percentage" ||
      (discountPayload.discountAmount ?? 0) > 0
    ) {
      Object.assign(payload, discountPayload);
    }

    const identifiersField = buildCreateIdentifiersField({
      quantity,
      values: addForm.identifierValues,
    });
    if (identifiersField.include) {
      payload.identifiers = identifiersField.identifiers;
    }

    const runAdd = async (discountAuthorization) => {
      const body = { ...payload };
      if (discountAuthorization) {
        body.discountAuthorization = discountAuthorization;
      }
      await addInventorySaleItem(sale.id, body);
      toast.success(i18n.t("inventorySales.sales.items.toasts.added"));
      setAddForm(emptyAddForm);
      clearProductSearch();
      focusSearchIfWide();
      if (onSaleUpdated) await onSaleUpdated();
    };

    setAdding(true);
    try {
      await runAdd();
    } catch (err) {
      if (isDiscountAuthorizationRequiredError(err)) {
        pendingItemSaveRef.current = {
          add: true,
          runAdd,
        };
        setAuthDetail(discountAuthorizationRequiredMessage(err));
        setAuthOpen(true);
      } else {
        toastError(err);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDiscountAuthConfirm = async (reason) => {
    const pending = pendingItemSaveRef.current;
    if (!pending) {
      setAuthOpen(false);
      return;
    }
    setAuthConfirming(true);
    const authBody = buildDiscountAuthorizationBody(reason);
    try {
      if (pending.add && pending.runAdd) {
        setAdding(true);
        await pending.runAdd(authBody);
      } else if (pending.item) {
        await persistItem(pending.item, {
          fromAutoSave: pending.fromAutoSave,
          discountAuthorization: authBody,
        });
      }
      setAuthOpen(false);
      pendingItemSaveRef.current = null;
    } catch (err) {
      toastError(err);
    } finally {
      setAuthConfirming(false);
      setAdding(false);
    }
  };

  const discountInputsDisabled = readOnly || !canApplyDiscount;

  const handleUpdateItem = async (item) => {
    await persistItem(item, { fromAutoSave: false });
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
        onBlur={autoSave ? () => handleIdentifiersBlur(item) : undefined}
      />
    );
  };

  const renderItemActions = (item) => {
    if (readOnly) return null;
    const dirty = isRowDirty(item);
    const saving = rowSaving === item.id;
    const errored = Boolean(saveErrors[item.id]);

    return (
      <Box display="flex" justifyContent="flex-end" alignItems="center">
        {/* Autosave é silencioso no fluxo normal — só feedback de erro. */}
        {autoSave && errored && !saving ? (
          <Typography
            variant="caption"
            color="error"
            style={{ marginRight: 4 }}
            data-testid={`sale-item-autosave-error-${item.id}`}
          >
            {i18n.t("inventorySales.sales.items.autoSaveError")}
          </Typography>
        ) : null}
        {!autoSave && dirty ? (
          <IconButton
            size="small"
            onClick={() => handleUpdateItem(item)}
            disabled={saving}
            data-testid={`sale-item-save-${item.id}`}
          >
            <SaveIcon fontSize="small" />
          </IconButton>
        ) : null}
        <IconButton
          size="small"
          onClick={() => handleDeleteItem(item)}
          data-testid={`sale-item-delete-${item.id}`}
        >
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
                  title={formatSaleItemProductLabel(item)}
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
                        {formatItemDiscountDisplay(item, draft)}
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
                        type="text"
                        inputProps={{
                          inputMode: "decimal",
                          "data-testid": `sale-item-qty-${item.id}`,
                        }}
                        className={classes.qtyField}
                        fullWidth
                        style={{ marginBottom: 8 }}
                      />
                      <Box style={{ marginBottom: 8 }}>
                        <CurrencyInput
                          label={i18n.t("inventorySales.sales.items.unitPrice")}
                          value={Number(draft.unitPrice) || 0}
                          onChange={(reais) =>
                            setRowField(item.id, "unitPrice", String(reais ?? 0))
                          }
                          onBlur={() => handleMoneyBlur(item)}
                        />
                      </Box>
                      <Box style={{ marginBottom: 8 }}>
                        <Typography variant="caption" color="textSecondary">
                          {i18n.t("inventorySales.sales.items.discount")}
                        </Typography>
                        <SaleItemDiscountFields
                          draft={draft}
                          disabled={discountInputsDisabled}
                          testIdPrefix={`sale-item-discount-${item.id}`}
                          controlClassName={classes.discountControl}
                          typeGroupClassName={classes.discountTypeGroup}
                          inputWrapClassName={classes.discountInputWrap}
                          onTypeChange={(_e, next) => {
                            if (!next) return;
                            const prevType = getRowDraft(item).discountType;
                            patchRowDraft(item.id, {
                              discountType: next,
                              ...(next === "percentage" &&
                              prevType !== "percentage"
                                ? { discountPercent: "" }
                                : {}),
                            });
                            scheduleAutoSave(item.id, AUTO_SAVE_MONEY_DEBOUNCE_MS);
                          }}
                          onFixedChange={(reais) =>
                            setRowField(
                              item.id,
                              "discountAmount",
                              String(reais ?? 0)
                            )
                          }
                          onPercentChange={(e) =>
                            setRowField(
                              item.id,
                              "discountPercent",
                              sanitizePercentTyping(e.target.value)
                            )
                          }
                          onBlur={() => handleMoneyBlur(item)}
                        />
                      </Box>
                      <Typography variant="body2" style={{ fontWeight: 600 }}>
                        {formatCurrencyBRL(previewLineTotal(draft, item))}
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
                  <TableCell className={`${classes.productCell} ${classes.headerCell}`}>
                    {i18n.t("inventorySales.sales.items.product")}
                  </TableCell>
                  <TableCell align="center" className={`${classes.qtyCell} ${classes.headerCell}`}>
                    {i18n.t("inventorySales.sales.items.quantityShort")}
                  </TableCell>
                  <TableCell align="right" className={`${classes.priceCell} ${classes.headerCell}`}>
                    {i18n.t("inventorySales.sales.items.unitPrice")}
                  </TableCell>
                  <TableCell align="right" className={`${classes.discountCell} ${classes.headerCell}`}>
                    {i18n.t("inventorySales.sales.items.discount")}
                  </TableCell>
                  <TableCell align="right" className={`${classes.totalCell} ${classes.headerCell}`}>
                    {i18n.t("inventorySales.sales.items.total")}
                  </TableCell>
                  {!readOnly ? (
                    <TableCell align="right" className={`${classes.actionsCell} ${classes.headerCell}`}>
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
                          <Typography variant="body2">
                            {formatSaleItemProductLabel(item)}
                          </Typography>
                          {item.productSku ? (
                            <Typography variant="caption" color="textSecondary">
                              {item.productSku}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell align="center" className={classes.qtyCell}>
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
                              type="text"
                              inputProps={{
                                inputMode: "decimal",
                                "data-testid": `sale-item-qty-${item.id}`,
                              }}
                              className={classes.qtyField}
                              fullWidth
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" className={classes.priceCell}>
                          {readOnly ? (
                            formatCurrencyBRL(draft.unitPrice)
                          ) : (
                            <CurrencyInput
                              value={Number(draft.unitPrice) || 0}
                              onChange={(reais) =>
                                setRowField(
                                  item.id,
                                  "unitPrice",
                                  String(reais ?? 0)
                                )
                              }
                              onBlur={() => handleMoneyBlur(item)}
                              className={classes.numericField}
                              data-testid={`sale-item-price-${item.id}`}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" className={classes.discountCell}>
                          {readOnly ? (
                            formatItemDiscountDisplay(item, draft)
                          ) : (
                            <SaleItemDiscountFields
                              draft={draft}
                              disabled={discountInputsDisabled}
                              controlClassName={classes.discountControl}
                              typeGroupClassName={classes.discountTypeGroup}
                              inputWrapClassName={classes.discountInputWrap}
                              testIdPrefix={`sale-item-discount-${item.id}`}
                              onTypeChange={(_e, next) => {
                                if (!next) return;
                                const prevType = getRowDraft(item).discountType;
                                patchRowDraft(item.id, {
                                  discountType: next,
                                  ...(next === "percentage" &&
                                  prevType !== "percentage"
                                    ? { discountPercent: "" }
                                    : {}),
                                });
                                scheduleAutoSave(
                                  item.id,
                                  AUTO_SAVE_MONEY_DEBOUNCE_MS
                                );
                              }}
                              onFixedChange={(reais) =>
                                setRowField(
                                  item.id,
                                  "discountAmount",
                                  String(reais ?? 0)
                                )
                              }
                              onPercentChange={(e) =>
                                setRowField(
                                  item.id,
                                  "discountPercent",
                                  sanitizePercentTyping(e.target.value)
                                )
                              }
                              onBlur={() => handleMoneyBlur(item)}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" className={classes.totalCell}>
                          {formatCurrencyBRL(
                            readOnly
                              ? item.totalAmount
                              : previewLineTotal(draft, item)
                          )}
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
                applySaleProductSelection(value);
              }}
              onInputChange={(_, value, reason) => {
                setInputValue(value);
                if (reason === "input" || reason === "clear") {
                  highlightChosenRef.current = false;
                  setSelectedProduct(null);
                  setAddForm((prev) => ({
                    ...prev,
                    productId: "",
                    variantId: "",
                    unitPrice: "",
                  }));
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
            <Box className={classes.addFormRow}>
              <Box className={classes.addQtySlot}>
                <TextField
                  size="small"
                  variant="outlined"
                  label={i18n.t("inventorySales.sales.items.quantity")}
                  value={addForm.quantity}
                  onChange={(e) =>
                    setAddForm((prev) => ({ ...prev, quantity: e.target.value }))
                  }
                  onBlur={() => {
                    const normalized = normalizeQuantityInputValue(
                      addForm.quantity
                    );
                    if (normalized !== String(addForm.quantity ?? "")) {
                      setAddForm((prev) => ({
                        ...prev,
                        quantity: normalized,
                      }));
                    }
                  }}
                  type="text"
                  inputProps={{
                    inputMode: "decimal",
                    "data-testid": "sale-add-qty",
                  }}
                  className={classes.qtyField}
                  fullWidth
                />
              </Box>
              <Box className={classes.addPriceSlot}>
                <CurrencyInput
                  label={i18n.t("inventorySales.sales.items.unitPriceOptional")}
                  value={
                    addForm.unitPrice === "" || addForm.unitPrice == null
                      ? null
                      : Number(addForm.unitPrice)
                  }
                  allowEmpty
                  onChange={(reais) =>
                    setAddForm((prev) => ({
                      ...prev,
                      unitPrice: reais == null ? "" : String(reais),
                    }))
                  }
                />
              </Box>
              <Box className={classes.addDiscountSlot}>
                <Typography variant="caption" color="textSecondary">
                  {i18n.t("inventorySales.sales.items.discount")}
                </Typography>
                <SaleItemDiscountFields
                  draft={addForm}
                  disabled={discountInputsDisabled}
                  testIdPrefix="sale-add-discount"
                  controlClassName={classes.discountControl}
                  typeGroupClassName={classes.discountTypeGroup}
                  inputWrapClassName={classes.discountInputWrap}
                  onTypeChange={(_e, next) => {
                    if (!next) return;
                    setAddForm((prev) => ({
                      ...prev,
                      discountType: next,
                      ...(next === "percentage" &&
                      prev.discountType !== "percentage"
                        ? { discountPercent: "" }
                        : {}),
                    }));
                  }}
                  onFixedChange={(reais) =>
                    setAddForm((prev) => ({
                      ...prev,
                      discountAmount: String(reais ?? 0),
                    }))
                  }
                  onPercentChange={(e) =>
                    setAddForm((prev) => ({
                      ...prev,
                      discountPercent: sanitizePercentTyping(e.target.value),
                    }))
                  }
                />
              </Box>
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

      <InventoryDiscountAuthorizationDialog
        open={authOpen}
        detailMessage={authDetail}
        canAuthorize={perms.canAuthorizeDiscount}
        confirming={authConfirming || adding}
        onClose={() => {
          if (!authConfirming && !adding) {
            setAuthOpen(false);
            pendingItemSaveRef.current = null;
          }
        }}
        onConfirm={handleDiscountAuthConfirm}
      />

      <SaleVariantPickerDialog
        open={variantPickerOpen}
        product={variantPickerProduct}
        onClose={() => {
          setVariantPickerOpen(false);
          setVariantPickerProduct(null);
          clearProductSearch();
          setAddForm(emptyAddForm);
        }}
        onSelect={(variant) => {
          setVariantPickerOpen(false);
          const base = variantPickerProduct;
          setVariantPickerProduct(null);
          if (!base || !variant) return;
          setSelectedProduct({
            ...base,
            selectedVariant: variant,
            salePrice: variant.salePrice,
            sku: variant.sku,
            barcode: variant.barcode,
            currentQuantity: variant.currentQuantity,
            trackStock: variant.trackStock,
          });
          setAddForm((prev) => ({
            ...prev,
            productId: String(base.id),
            variantId: String(variant.id),
            unitPrice:
              variant.salePrice != null ? String(variant.salePrice) : "",
          }));
        }}
      />
    </Box>
  );
});

export default SaleItemsEditor;
