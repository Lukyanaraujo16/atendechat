import React, { useEffect, useRef, useState } from "react";
import ToggleButton from "@material-ui/lab/ToggleButton";
import ToggleButtonGroup from "@material-ui/lab/ToggleButtonGroup";
import PrintIcon from "@material-ui/icons/Print";
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
import { getInventoryReceiptBranding } from "../../services/inventoryApi";
import {
  DEFAULT_SALE_RECEIPT_PRINT_FORMAT,
  SALE_RECEIPT_PRINT_FORMAT_LIST,
} from "./saleReceiptPrintFormats";
import {
  EMPTY_RECEIPT_BRANDING,
  receiptBrandingFromSettings,
  receiptPrintFormatFromPayload,
  sameReceiptBranding,
} from "./receiptBranding";

const PREFERENCE_TIMEOUT_MS = 4000;

export default function SaleReceiptDialog({ open, onClose, sale }) {
  const [printing, setPrinting] = useState(false);
  const [format, setFormat] = useState(DEFAULT_SALE_RECEIPT_PRINT_FORMAT);
  const [formatReady, setFormatReady] = useState(false);
  const [branding, setBranding] = useState(EMPTY_RECEIPT_BRANDING);
  const [trackedOpen, setTrackedOpen] = useState(false);
  const [trackedSaleId, setTrackedSaleId] = useState(null);
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

  if (!sale) return null;

  const handleFormat = (_event, next) => {
    if (printingRef.current || !formatReady || !next) return;
    formatTouchedRef.current = true;
    setFormat(next);
  };

  const handlePrint = () => {
    if (printingRef.current || !formatReady) return;
    printingRef.current = true;
    setPrinting(true);
    const pending = brandingRequestRef.current || Promise.resolve(branding);
    const limitMs = preferenceTimedOutRef.current ? 0 : PREFERENCE_TIMEOUT_MS;
    Promise.race([
      pending,
      new Promise((resolve) => {
        setTimeout(() => resolve(branding), limitMs);
      }),
    ])
      .then((loaded) =>
        printSaleReceipt(sale, format, loaded || EMPTY_RECEIPT_BRANDING)
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
        <SaleReceiptContent sale={sale} layout="screen" branding={branding} />
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
        </div>
        <div>
          <AppSecondaryButton onClick={onClose}>
            {i18n.t("inventorySales.common.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            loading={printing}
            disabled={formatLocked}
          >
            {i18n.t("inventorySales.sales.receipt.print")}
          </AppPrimaryButton>
        </div>
      </AppDialogActions>
    </AppDialog>
  );
}
