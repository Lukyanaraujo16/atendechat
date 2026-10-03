import React, { useEffect, useRef, useState } from "react";
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

export default function SaleReceiptDialog({ open, onClose, sale }) {
  const [printing, setPrinting] = useState(false);
  const printingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!sale) return null;

  const handlePrint = () => {
    if (printingRef.current) return;
    printingRef.current = true;
    setPrinting(true);
    printSaleReceipt(sale)
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
        <SaleReceiptContent sale={sale} layout="screen" />
      </AppDialogContent>
      <AppDialogActions className="sale-receipt-no-print">
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
      </AppDialogActions>
    </AppDialog>
  );
}
