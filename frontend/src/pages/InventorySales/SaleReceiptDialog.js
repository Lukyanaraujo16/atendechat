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
  sameReceiptBranding,
} from "./receiptBranding";

export default function SaleReceiptDialog({ open, onClose, sale }) {
  const [printing, setPrinting] = useState(false);
  const [format, setFormat] = useState(DEFAULT_SALE_RECEIPT_PRINT_FORMAT);
  const [branding, setBranding] = useState(EMPTY_RECEIPT_BRANDING);
  const printingRef = useRef(false);
  const mountedRef = useRef(true);
  const brandingRequestRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const saleId = sale ? sale.id : null;

  useEffect(() => {
    if (open) setFormat(DEFAULT_SALE_RECEIPT_PRINT_FORMAT);
  }, [open, saleId]);

  useEffect(() => {
    if (!open) {
      brandingRequestRef.current = null;
      return undefined;
    }
    let cancelled = false;
    const request = getInventoryReceiptBranding()
      .then(({ data }) => receiptBrandingFromSettings(data))
      .catch(() => ({ ...EMPTY_RECEIPT_BRANDING }));
    brandingRequestRef.current = request;
    request.then((next) => {
      if (cancelled || !mountedRef.current) return;
      setBranding((current) => (sameReceiptBranding(current, next) ? current : next));
    });
    return () => {
      cancelled = true;
    };
  }, [open, saleId]);

  if (!sale) return null;

  const handleFormat = (_event, next) => {
    if (printingRef.current || !next) return;
    setFormat(next);
  };

  const handlePrint = () => {
    if (printingRef.current) return;
    printingRef.current = true;
    setPrinting(true);
    const pending = brandingRequestRef.current || Promise.resolve(branding);
    pending
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
              <ToggleButton key={id} value={id} disabled={printing}>
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
            disabled={printing}
          >
            {i18n.t("inventorySales.sales.receipt.print")}
          </AppPrimaryButton>
        </div>
      </AppDialogActions>
    </AppDialog>
  );
}
