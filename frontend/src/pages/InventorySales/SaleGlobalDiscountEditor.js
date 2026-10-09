import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, TextField, Typography } from "@material-ui/core";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import { toast } from "react-toastify";

import { AppSectionCard } from "../../ui";
import { updateInventorySaleGlobalDiscount } from "../../services/inventoryApi";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { parseBrazilianCurrencyToNumber } from "../../utils/brazilianCurrency";
import CurrencyInput from "./CurrencyInput";
import InventoryDiscountAuthorizationDialog from "./InventoryDiscountAuthorizationDialog";
import {
  buildDiscountAuthorizationBody,
  discountAuthorizationRequiredMessage,
  isDiscountAuthorizationRequiredError,
} from "./inventoryDiscountAuth";
import { computeSaleTotalsPreview } from "./saleDiscountPreview";
import { useInventoryPermissions } from "../../utils/inventoryAccess";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";

const AUTO_SAVE_MS = 450;

function globalDraftFromSale(sale) {
  const type =
    sale?.globalDiscountType === "percentage"
      ? "percentage"
      : sale?.globalDiscountType === "fixed"
        ? "fixed"
        : "fixed";
  return {
    globalDiscountType: type,
    globalDiscountAmount: String(sale?.globalDiscountAmount ?? "0"),
    globalDiscountPercent: String(sale?.globalDiscountPercent ?? ""),
  };
}

function buildGlobalDiscountBody(draft) {
  const type = draft.globalDiscountType === "percentage" ? "percentage" : "fixed";
  if (type === "percentage") {
    const pct = Number(draft.globalDiscountPercent);
    if (!Number.isFinite(pct) || pct <= 0) {
      return { clear: true };
    }
    return {
      globalDiscountType: "percentage",
      globalDiscountPercent: pct,
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

export default function SaleGlobalDiscountEditor({
  sale,
  disabled,
  canApplyDiscount = true,
  onSaleUpdated,
}) {
  const perms = useInventoryPermissions();
  const [draft, setDraft] = useState(() => globalDraftFromSale(sale));
  const [saving, setSaving] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authDetail, setAuthDetail] = useState("");
  const [authConfirming, setAuthConfirming] = useState(false);
  const pendingBodyRef = useRef(null);
  const debounceRef = useRef(null);
  const saleId = sale?.id;

  useEffect(() => {
    setDraft(globalDraftFromSale(sale));
  }, [
    sale?.id,
    sale?.globalDiscountType,
    sale?.globalDiscountAmount,
    sale?.globalDiscountPercent,
  ]);

  const persist = useCallback(
    async (body, { withAuth } = {}) => {
      if (!saleId || disabled || !canApplyDiscount) return;
      const payload = { ...body };
      if (withAuth) {
        payload.discountAuthorization = buildDiscountAuthorizationBody(
          withAuth.reason
        );
      }
      setSaving(true);
      try {
        await updateInventorySaleGlobalDiscount(saleId, payload);
        if (onSaleUpdated) await onSaleUpdated();
        toast.success(i18n.t("inventorySales.sales.globalDiscount.toasts.saved"));
      } catch (err) {
        if (isDiscountAuthorizationRequiredError(err)) {
          pendingBodyRef.current = body;
          setAuthDetail(discountAuthorizationRequiredMessage(err));
          setAuthOpen(true);
          return;
        }
        toastError(err);
      } finally {
        setSaving(false);
      }
    },
    [saleId, disabled, canApplyDiscount, onSaleUpdated]
  );

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const body = buildGlobalDiscountBody(draft);
      persist(body);
    }, AUTO_SAVE_MS);
  }, [draft, persist]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const handleTypeChange = (_e, next) => {
    if (!next || disabled || !canApplyDiscount) return;
    setDraft((prev) => ({ ...prev, globalDiscountType: next }));
    setTimeout(scheduleSave, 0);
  };

  const preview = computeSaleTotalsPreview(sale);
  const inputsDisabled = disabled || !canApplyDiscount || saving;

  const handleAuthConfirm = async (reason) => {
    const body = pendingBodyRef.current;
    if (!body) {
      setAuthOpen(false);
      return;
    }
    setAuthConfirming(true);
    try {
      await persist(body, { withAuth: { reason } });
      setAuthOpen(false);
      pendingBodyRef.current = null;
    } finally {
      setAuthConfirming(false);
    }
  };

  if (!saleId) return null;

  return (
    <>
      <AppSectionCard variant="outlined" dense data-testid="sale-global-discount-editor">
        <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 8 }}>
          {i18n.t("inventorySales.sales.globalDiscount.title")}
        </Typography>
        {!canApplyDiscount ? (
          <Typography variant="caption" color="textSecondary" display="block" paragraph>
            {i18n.t("inventorySales.sales.globalDiscount.noPermission")}
          </Typography>
        ) : null}
        <Box display="flex" flexWrap="wrap" alignItems="flex-end" style={{ gap: 12 }}>
          <ToggleButtonGroup
            size="small"
            value={draft.globalDiscountType}
            exclusive
            onChange={handleTypeChange}
          >
            <ToggleButton value="fixed" disabled={inputsDisabled} data-testid="global-discount-type-fixed">
              R$
            </ToggleButton>
            <ToggleButton value="percentage" disabled={inputsDisabled} data-testid="global-discount-type-percent">
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
                setDraft((prev) => ({
                  ...prev,
                  globalDiscountPercent: e.target.value,
                }));
                scheduleSave();
              }}
              type="number"
              inputProps={{
                min: 0,
                max: 100,
                step: "0.01",
                "data-testid": "global-discount-percent",
              }}
              disabled={inputsDisabled}
              style={{ width: 120 }}
            />
          ) : (
            <Box minWidth={140}>
              <CurrencyInput
                label={i18n.t("inventorySales.sales.globalDiscount.amount")}
                value={Number(draft.globalDiscountAmount) || 0}
                onChange={(reais) => {
                  setDraft((prev) => ({
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
          {saving ? (
            <Typography variant="caption" color="textSecondary">
              {i18n.t("inventorySales.sales.items.autoSaving")}
            </Typography>
          ) : null}
        </Box>
        {preview.globalDiscountAmount > 0 ? (
          <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 8 }}>
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
        confirming={authConfirming || saving}
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
