import React, { useEffect, useRef, useState } from "react";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import PrintIcon from "@material-ui/icons/Print";
import { Box, CircularProgress, Typography } from "@material-ui/core";
import { toast } from "react-toastify";

import {
  AppDialog,
  AppDialogActions,
  AppDialogContent,
  AppDialogTitle,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import { i18n } from "../../translate/i18n";
import SaleReceiptContent from "./SaleReceiptContent";
import { printSaleReceipt } from "./printSaleReceipt";
import {
  getInventoryReceiptBranding,
  getInventorySalePayments,
} from "../../services/inventoryApi";
import {
  DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
  SALE_RECEIPT_PRINT_FORMAT_LIST,
  isThermalSaleReceiptFormat,
} from "./saleReceiptPrintFormats";
import {
  EMPTY_RECEIPT_BRANDING,
  receiptBrandingFromSettings,
  receiptPrintFormatFromPayload,
  sameReceiptBranding,
} from "./receiptBranding";
import { normalizeInventorySale } from "./normalizeInventorySale";
import { saleLikelyHasMultiplePayments } from "./paymentDisplay";

const PREFERENCE_TIMEOUT_MS = 4000;

export default function SaleReceiptDialog({ open, onClose, sale }) {
  const [printing, setPrinting] = useState(false);
  const [format, setFormat] = useState(DEFAULT_SALE_RECEIPT_PRINT_FORMAT);
  const [formatReady, setFormatReady] = useState(false);
  const [branding, setBranding] = useState(EMPTY_RECEIPT_BRANDING);
  const [trackedOpen, setTrackedOpen] = useState(false);
  const [trackedSaleId, setTrackedSaleId] = useState(null);
  const [payments, setPayments] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState(false);
  const printingRef = useRef(false);
  const mountedRef = useRef(true);
  const brandingRequestRef = useRef(null);
  const formatTouchedRef = useRef(false);
  const preferenceTimedOutRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const saleId = sale ? sale.id : null;

  if (open) {
    if (!trackedOpen || trackedSaleId !== saleId) {
      setTrackedOpen(true);
      setTrackedSaleId(saleId);
      setFormat(DEFAULT_SALE_RECEIPT_PRINT_FORMAT);
      setFormatReady(false);
      formatTouchedRef.current = false;
      preferenceTimedOutRef.current = false;
      setPayments(null);
      setPaymentSummary(null);
      setPaymentsError(false);
    }
  } else if (trackedOpen) {
    setTrackedOpen(false);
  }

  useEffect(() => {
    if (!open) {
      brandingRequestRef.current = null;
      return undefined;
    }
    let cancelled = false;
    let formatSettled = false;
    const request = getInventoryReceiptBranding()
      .then(({ data }) => ({
        branding: receiptBrandingFromSettings(data),
        format: receiptPrintFormatFromPayload(data),
      }))
      .catch(() => ({
        branding: { ...EMPTY_RECEIPT_BRANDING },
        format: DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
      }));
    brandingRequestRef.current = request.then((loaded) => loaded.branding);
    const applyFormat = (nextFormat) => {
      if (cancelled || formatSettled || !mountedRef.current) return;
      formatSettled = true;
      if (!formatTouchedRef.current) setFormat(nextFormat);
      setFormatReady(true);
    };
    const timer = setTimeout(() => {
      preferenceTimedOutRef.current = true;
      applyFormat(DEFAULT_SALE_RECEIPT_PRINT_FORMAT);
    }, PREFERENCE_TIMEOUT_MS);
    request.then((next) => {
      if (cancelled || !mountedRef.current) return;
      clearTimeout(timer);
      setBranding((current) =>
        sameReceiptBranding(current, next.branding) ? current : next.branding
      );
      applyFormat(next.format);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, saleId]);

  useEffect(() => {
    if (!open || !saleId) return undefined;
    let cancelled = false;
    setPaymentsLoading(true);
    setPaymentsError(false);
    getInventorySalePayments(saleId)
      .then(({ data }) => {
        if (cancelled || !mountedRef.current) return;
        setPayments(Array.isArray(data?.payments) ? data.payments : []);
        setPaymentSummary(data?.summary || null);
        setPaymentsError(false);
      })
      .catch(() => {
        if (cancelled || !mountedRef.current) return;
        setPayments(null);
        setPaymentSummary(null);
        setPaymentsError(true);
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setPaymentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, saleId]);

  if (!sale) return null;

  const receiptSale = normalizeInventorySale(sale);
  const multiUnsafe = paymentsError && saleLikelyHasMultiplePayments(receiptSale);
  const canPrintWithPayments =
    !paymentsLoading && (!paymentsError || !multiUnsafe);

  const handleFormat = (_event, next) => {
    if (printingRef.current || !formatReady || !next) return;
    formatTouchedRef.current = true;
    setFormat(next);
  };

  const handlePrint = () => {
    if (printingRef.current || !formatReady || !canPrintWithPayments) return;
    if (paymentsError && multiUnsafe) {
      toast.error(i18n.t("inventorySales.sales.receipt.paymentsLoadError"));
      return;
    }
    printingRef.current = true;
    setPrinting(true);
    const pending = brandingRequestRef.current || Promise.resolve(branding);
    const limitMs = preferenceTimedOutRef.current ? 0 : PREFERENCE_TIMEOUT_MS;
    const paymentBundle =
      !paymentsError && Array.isArray(payments)
        ? { payments, summary: paymentSummary }
        : null;
    Promise.race([
      pending,
      new Promise((resolve) => {
        setTimeout(() => resolve(branding), limitMs);
      }),
    ])
      .then((loaded) =>
        printSaleReceipt(
          receiptSale,
          format,
          loaded || EMPTY_RECEIPT_BRANDING,
          paymentBundle
        )
      )
      .catch(() => {
        toast.error(i18n.t("inventorySales.sales.receipt.printError"));
      })
      .finally(() => {
        printingRef.current = false;
        if (mountedRef.current) setPrinting(false);
      });
  };

  const formatLocked = printing || !formatReady;
  const printLocked = formatLocked || paymentsLoading || multiUnsafe;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      className="sale-receipt-dialog"
      disableEnforceFocus
      PaperProps={{ style: { backgroundColor: "#fff" } }}
    >
      <AppDialogTitle className="sale-receipt-no-print">
        {i18n.t("inventorySales.sales.receipt.title")}
      </AppDialogTitle>
      <AppDialogContent dividers style={{ padding: 0, backgroundColor: "#fff" }}>
        {multiUnsafe ? (
          <Box p={3} data-testid="sale-receipt-payments-error">
            <Typography color="error">
              {i18n.t("inventorySales.sales.receipt.paymentsLoadError")}
            </Typography>
          </Box>
        ) : (
          <>
            {paymentsLoading ? (
              <Box
                display="flex"
                justifyContent="center"
                py={1}
                data-testid="sale-receipt-payments-loading"
              >
                <CircularProgress size={20} />
              </Box>
            ) : null}
            <SaleReceiptContent
              sale={receiptSale}
              layout="screen"
              branding={branding}
              payments={paymentsError || paymentsLoading ? null : payments}
              paymentSummary={
                paymentsError || paymentsLoading ? null : paymentSummary
              }
            />
          </>
        )}
      </AppDialogContent>
      <AppDialogActions
        className="sale-receipt-no-print"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span id="sale-receipt-format-label" style={{ fontSize: 12, color: "#444" }}>
            {i18n.t("inventorySales.sales.receipt.format")}
          </span>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={format}
            onChange={handleFormat}
            aria-labelledby="sale-receipt-format-label"
          >
            {SALE_RECEIPT_PRINT_FORMAT_LIST.map((id) => (
              <ToggleButton key={id} value={id} disabled={formatLocked}>
                {i18n.t(`inventorySales.sales.receipt.formats.${id}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {isThermalSaleReceiptFormat(format) ? (
            <span style={{ fontSize: 12, color: "#666", maxWidth: 420 }}>
              {i18n.t("inventorySales.sales.receipt.thermalPrintHint")}
            </span>
          ) : null}
        </div>
        <div>
          <AppSecondaryButton onClick={onClose}>
            {i18n.t("inventorySales.common.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            loading={printing}
            disabled={printLocked}
          >
            {i18n.t("inventorySales.sales.receipt.print")}
          </AppPrimaryButton>
        </div>
      </AppDialogActions>
    </AppDialog>
  );
}
