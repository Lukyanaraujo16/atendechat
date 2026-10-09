import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  InputAdornment,
  TextField,
  Typography,
  makeStyles,
} from "@material-ui/core";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";

import { AppSectionCard } from "../../ui";
import { updateInventorySaleGlobalDiscount } from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import {
  formatCurrencyBRL,
  parseBrazilianCurrencyToNumber,
} from "../../utils/brazilianCurrency";
import CurrencyInput from "./CurrencyInput";
import InventoryDiscountAuthorizationDialog from "./InventoryDiscountAuthorizationDialog";
import {
  buildDiscountAuthorizationBody,
  discountAuthorizationRequiredMessage,
  isDiscountAuthorizationRequiredError,
} from "./inventoryDiscountAuth";
import { computeSaleTotalsPreview } from "./saleDiscountPreview";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import {
  formatPercentDraftValue,
  parsePercentInput,
  percentEqual,
  sanitizePercentTyping,
} from "./inventoryPercentInput";

const AUTO_SAVE_MS = 450;

const useStyles = makeStyles(() => ({
  percentField: {
    width: 140,
    minWidth: 140,
    "& input": {
      textAlign: "right",
    },
    "& input[type=number]": {
      MozAppearance: "textfield",
    },
    "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
      WebkitAppearance: "none",
      margin: 0,
    },
  },
}));

function moneyAmount(value) {
  if (value === "" || value == null) return 0;
  return parseBrazilianCurrencyToNumber(value) ?? Number(value) ?? 0;
}

/**
 * Preferência visual % para venda sem desconto global.
 * Preserva fixed / percentage persistidos e legado monetário (amount > 0 sem type).
 */
export function resolveGlobalDiscountType(sale) {
  if (sale?.globalDiscountType === "percentage") return "percentage";
  if (sale?.globalDiscountType === "fixed") return "fixed";
  if (moneyAmount(sale?.globalDiscountAmount) > 0) return "fixed";
  return "percentage";
}

export function globalDraftFromSale(sale) {
  const type = resolveGlobalDiscountType(sale);
  return {
    globalDiscountType: type,
    globalDiscountAmount: String(sale?.globalDiscountAmount ?? "0"),
    globalDiscountPercent:
      type === "percentage"
        ? formatPercentDraftValue(sale?.globalDiscountPercent)
        : "",
  };
}

export function buildGlobalDiscountBody(draft) {
  const type =
    draft.globalDiscountType === "percentage" ? "percentage" : "fixed";
  if (type === "percentage") {
    const pct = parsePercentInput(draft.globalDiscountPercent);
    if (pct == null || pct <= 0) {
      return { clear: true };
    }
    return {
      globalDiscountType: "percentage",
      globalDiscountPercent: Math.min(100, pct),
    };
  }
  const amount =
    parseBrazilianCurrencyToNumber(draft.globalDiscountAmount) ?? 0;
  if (amount <= 0) {
    return { clear: true };
  }
  return {
    globalDiscountType: "fixed",
    globalDiscountAmount: amount,
  };
}

function draftMatchesSale(draft, sale) {
  const saved = globalDraftFromSale(sale);
  if (draft.globalDiscountType !== saved.globalDiscountType) return false;
  if (draft.globalDiscountType === "percentage") {
    return percentEqual(draft.globalDiscountPercent, saved.globalDiscountPercent);
  }
  const a = moneyAmount(draft.globalDiscountAmount);
  const b = moneyAmount(saved.globalDiscountAmount);
  return Math.round(a * 100) === Math.round(b * 100);
}

export default function SaleGlobalDiscountEditor({
  sale,
  disabled,
  canApplyDiscount = true,
  onSaleUpdated,
}) {
  const classes = useStyles();
  const perms = useInventoryPermissions();
  const [draft, setDraft] = useState(() => globalDraftFromSale(sale));
  const [authOpen, setAuthOpen] = useState(false);
  const [authDetail, setAuthDetail] = useState("");
  const [authConfirming, setAuthConfirming] = useState(false);
  const pendingBodyRef = useRef(null);
  const debounceRef = useRef(null);
  const draftRef = useRef(draft);
  const saveSeqRef = useRef(0);
  const dirtyRef = useRef(false);
  const saleId = sale?.id;

  const setDraftSafe = useCallback((updater) => {
    setDraft((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      draftRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    // Sale alcançou o draft → limpa dirty (sem sobrescrever digitação).
    if (draftMatchesSale(draftRef.current, sale)) {
      dirtyRef.current = false;
      return;
    }
    // Operador ainda edita ou há debounce pendente → não reidratar (anti-flicker).
    if (dirtyRef.current || debounceRef.current) return;
    setDraftSafe(globalDraftFromSale(sale));
  }, [
    sale?.id,
    sale?.globalDiscountType,
    sale?.globalDiscountAmount,
    sale?.globalDiscountPercent,
    setDraftSafe,
  ]);

  const persist = useCallback(
    async (body, seq, { withAuth } = {}) => {
      if (!saleId || disabled || !canApplyDiscount) return;
      const payload = { ...body };
      if (withAuth) {
        payload.discountAuthorization = buildDiscountAuthorizationBody(
          withAuth.reason
        );
      }
      try {
        await updateInventorySaleGlobalDiscount(saleId, payload);
        // Ignora resposta obsoleta se o operador digitou de novo.
        if (seq !== saveSeqRef.current) return;
        if (onSaleUpdated) await onSaleUpdated();
        // dirty só limpa quando sale (via effect) bater com o draft.
      } catch (err) {
        if (seq !== saveSeqRef.current) return;
        if (isDiscountAuthorizationRequiredError(err)) {
          pendingBodyRef.current = body;
          setAuthDetail(discountAuthorizationRequiredMessage(err));
          setAuthOpen(true);
          return;
        }
        toastError(err);
      }
    },
    [saleId, disabled, canApplyDiscount, onSaleUpdated]
  );

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    dirtyRef.current = true;
    // Invalida saves em voo ao re-agendar (digitação contínua).
    const seq = ++saveSeqRef.current;
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const body = buildGlobalDiscountBody(draftRef.current);
      persist(body, seq);
    }, AUTO_SAVE_MS);
  }, [persist]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const handleTypeChange = (_e, next) => {
    if (!next || disabled || !canApplyDiscount) return;
    setDraftSafe((prev) => ({
      ...prev,
      globalDiscountType: next,
      ...(next === "percentage" && prev.globalDiscountType !== "percentage"
        ? { globalDiscountPercent: "" }
        : {}),
    }));
    scheduleSave();
  };

  const preview = computeSaleTotalsPreview({
    ...sale,
    globalDiscountType: draft.globalDiscountType,
    globalDiscountPercent: parsePercentInput(draft.globalDiscountPercent),
    globalDiscountAmount:
      draft.globalDiscountType === "fixed"
        ? moneyAmount(draft.globalDiscountAmount)
        : sale?.globalDiscountAmount,
  });
  const inputsDisabled = disabled || !canApplyDiscount;

  const handleAuthConfirm = async (reason) => {
    const body = pendingBodyRef.current;
    if (!body) {
      setAuthOpen(false);
      return;
    }
    setAuthConfirming(true);
    try {
      const seq = ++saveSeqRef.current;
      await persist(body, seq, { withAuth: { reason } });
      setAuthOpen(false);
      pendingBodyRef.current = null;
    } finally {
      setAuthConfirming(false);
    }
  };

  if (!saleId) return null;

  return (
    <>
      <AppSectionCard
        variant="outlined"
        dense
        data-testid="sale-global-discount-editor"
      >
        <Typography
          variant="subtitle2"
          style={{ fontWeight: 600, marginBottom: 8 }}
        >
          {i18n.t("inventorySales.sales.globalDiscount.title")}
        </Typography>
        {!canApplyDiscount ? (
          <Typography
            variant="caption"
            color="textSecondary"
            display="block"
            paragraph
          >
            {i18n.t("inventorySales.sales.globalDiscount.noPermission")}
          </Typography>
        ) : null}
        <Box
          display="flex"
          flexWrap="wrap"
          alignItems="flex-end"
          style={{ gap: 12 }}
        >
          <ToggleButtonGroup
            size="small"
            value={draft.globalDiscountType}
            exclusive
            onChange={handleTypeChange}
            data-testid="global-discount-type-group"
          >
            <ToggleButton
              value="fixed"
              disabled={inputsDisabled}
              data-testid="global-discount-type-fixed"
            >
              R$
            </ToggleButton>
            <ToggleButton
              value="percentage"
              disabled={inputsDisabled}
              data-testid="global-discount-type-percent"
            >
              %
            </ToggleButton>
          </ToggleButtonGroup>
          {draft.globalDiscountType === "percentage" ? (
            <TextField
              size="small"
              variant="outlined"
              label={i18n.t("inventorySales.sales.globalDiscount.percent")}
              value={draft.globalDiscountPercent}
              onChange={(e) => {
                const nextPercent = sanitizePercentTyping(e.target.value);
                dirtyRef.current = true;
                setDraftSafe((prev) => ({
                  ...prev,
                  globalDiscountPercent: nextPercent,
                }));
                scheduleSave();
              }}
              type="text"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">%</InputAdornment>
                ),
              }}
              inputProps={{
                inputMode: "decimal",
                "data-testid": "global-discount-percent",
                "aria-label": i18n.t(
                  "inventorySales.sales.globalDiscount.percent"
                ),
              }}
              disabled={inputsDisabled}
              className={classes.percentField}
            />
          ) : (
            <Box minWidth={140}>
              <CurrencyInput
                label={i18n.t("inventorySales.sales.globalDiscount.amount")}
                value={Number(draft.globalDiscountAmount) || 0}
                onChange={(reais) => {
                  setDraftSafe((prev) => ({
                    ...prev,
                    globalDiscountAmount: String(reais ?? 0),
                  }));
                  scheduleSave();
                }}
                disabled={inputsDisabled}
                data-testid="global-discount-amount"
              />
            </Box>
          )}
        </Box>
        {preview.globalDiscountAmount > 0 ? (
          <Typography
            variant="caption"
            color="textSecondary"
            display="block"
            style={{ marginTop: 8 }}
            data-testid="global-discount-preview"
          >
            {i18n.t("inventorySales.sales.globalDiscount.previewLine", {
              amount: formatCurrencyBRL(preview.globalDiscountAmount),
            })}
          </Typography>
        ) : null}
      </AppSectionCard>

      <InventoryDiscountAuthorizationDialog
        open={authOpen}
        detailMessage={authDetail}
        canAuthorize={perms.canAuthorizeDiscount}
        confirming={authConfirming}
        onClose={() => {
          if (!authConfirming) {
            setAuthOpen(false);
            pendingBodyRef.current = null;
          }
        }}
        onConfirm={handleAuthConfirm}
      />
    </>
  );
}
