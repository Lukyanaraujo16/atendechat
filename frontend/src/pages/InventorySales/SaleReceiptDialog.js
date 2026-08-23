import React from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import PrintIcon from "@material-ui/icons/Print";
import { format } from "date-fns";

import {
  AppDialog,
  AppDialogActions,
  AppDialogContent,
  AppDialogTitle,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import { i18n } from "../../translate/i18n";
import useIsMobile from "../../hooks/useIsMobile";
import { formatCurrencyBRL } from "../../utils/brazilianCurrency";
import {
  formatQuantity,
  formatSaleNumber,
  getSaleDisplayDate,
  toNumber,
} from "./utils";
import { identifiersFromSaleItem } from "./saleItemIdentifiers";

const useStyles = makeStyles((theme) => ({
  receiptRoot: {
    backgroundColor: "#fff",
    color: "#111",
    maxWidth: 720,
    margin: "0 auto",
    padding: theme.spacing(3),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(2),
    },
  },
  receiptHeader: {
    textAlign: "center",
    marginBottom: theme.spacing(3),
    paddingBottom: theme.spacing(2),
    borderBottom: "1px solid #ddd",
  },
  receiptTitle: {
    fontWeight: 700,
    fontSize: "1.25rem",
    letterSpacing: "0.02em",
  },
  cancelledBanner: {
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(0.75, 1.5),
    border: "2px solid #c62828",
    color: "#c62828",
    fontWeight: 700,
    fontSize: "0.875rem",
    letterSpacing: "0.08em",
    textAlign: "center",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "1fr",
    },
  },
  metaLabel: {
    fontSize: "0.6875rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "#666",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: "0.9375rem",
    fontWeight: 500,
    wordBreak: "break-word",
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: "0.875rem",
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  itemsTable: {
    "& th": {
      fontSize: "0.75rem",
      fontWeight: 600,
      color: "#444",
      borderBottom: "1px solid #ddd",
      padding: theme.spacing(1, 0.5),
    },
    "& td": {
      fontSize: "0.8125rem",
      borderBottom: "1px solid #eee",
      padding: theme.spacing(1, 0.5),
      verticalAlign: "top",
    },
  },
  productSku: {
    display: "block",
    fontSize: "0.6875rem",
    color: "#777",
    marginTop: 2,
  },
  identifiersBlock: {
    marginTop: 6,
    minWidth: 0,
    maxWidth: "100%",
  },
  identifierLine: {
    display: "block",
    fontSize: "0.75rem",
    color: "#444",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  },
  identifierTitle: {
    display: "block",
    fontSize: "0.6875rem",
    fontWeight: 600,
    color: "#555",
    marginBottom: 2,
  },
  totalsBox: {
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: "1px solid #ddd",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(2),
    padding: theme.spacing(0.5, 0),
    fontSize: "0.875rem",
  },
  totalRowFinal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(2),
    padding: theme.spacing(1, 0),
    marginTop: theme.spacing(0.5),
    borderTop: "2px solid #111",
    fontWeight: 700,
    fontSize: "1rem",
  },
  notesBlock: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    backgroundColor: "#fafafa",
    borderRadius: 4,
    fontSize: "0.8125rem",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  mobileItem: {
    padding: theme.spacing(1.5, 0),
    borderBottom: "1px solid #eee",
  },
}));

function formatReceiptDate(value) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  } catch {
    return "—";
  }
}

function displayValue(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  return String(value);
}

function getItemName(item) {
  return item?.productName || item?.product?.name || "—";
}

function ReceiptItemIdentifiers({ item, classes }) {
  const filled = identifiersFromSaleItem(item);
  if (!filled.length) return null;
  return (
    <div
      className={classes.identifiersBlock}
      data-testid={`sale-receipt-item-identifiers-${item.id}`}
    >
      <span className={classes.identifierTitle}>
        {i18n.t("inventorySales.sales.items.identifiers.listTitle")}
      </span>
      {filled.map((row) => (
        <span
          key={row.position}
          className={classes.identifierLine}
        >
          - {row.identifier}
        </span>
      ))}
    </div>
  );
}

function getPendingAmount(sale) {
  const total = toNumber(sale?.totalAmount);
  const paid = toNumber(sale?.paidAmount);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

export default function SaleReceiptDialog({ open, onClose, sale }) {
  const classes = useStyles();
  const isMobile = useIsMobile();

  if (!sale) return null;

  const items = Array.isArray(sale.items) ? sale.items : [];
  const isCancelled = sale.status === "cancelled";

  const statusLabel = (status) =>
    i18n.t(`inventorySales.sales.status.${status}`, status);

  const paymentStatusLabel = (status) =>
    i18n.t(`inventorySales.sales.paymentStatus.${status}`, status);

  const paymentMethodLabel = (method) =>
    method
      ? i18n.t(`inventorySales.sales.paymentMethods.${method}`, method)
      : i18n.t("inventorySales.sales.payment.noMethod");

  const handlePrint = () => {
    window.print();
  };

  const metaRows = [
    {
      label: i18n.t("inventorySales.sales.receipt.saleNumber"),
      value: formatSaleNumber(sale),
    },
    {
      label: i18n.t("inventorySales.sales.receipt.saleDate"),
      value: formatReceiptDate(getSaleDisplayDate(sale)),
    },
    {
      label: i18n.t("inventorySales.sales.receipt.operationalStatus"),
      value: statusLabel(sale.status),
    },
    {
      label: i18n.t("inventorySales.sales.receipt.paymentStatus"),
      value: paymentStatusLabel(sale.paymentStatus || "unpaid"),
    },
    {
      label: i18n.t("inventorySales.sales.receipt.customer"),
      value: sale.contact?.name || i18n.t("inventorySales.sales.receipt.noCustomer"),
    },
    {
      label: i18n.t("inventorySales.sales.receipt.seller"),
      value: sale.seller?.name || i18n.t("inventorySales.sales.receipt.noSeller"),
    },
    {
      label: i18n.t("inventorySales.sales.receipt.paymentMethod"),
      value: paymentMethodLabel(sale.paymentMethod),
    },
  ];

  const receiptContent = (
    <div className={`${classes.receiptRoot} sale-receipt-print-area`}>
      <div className={classes.receiptHeader}>
        <Typography className={classes.receiptTitle}>
          {i18n.t("inventorySales.sales.receipt.title")}
        </Typography>
        {isCancelled ? (
          <div className={classes.cancelledBanner}>
            {i18n.t("inventorySales.sales.receipt.cancelled")}
          </div>
        ) : null}
      </div>

      <div className={classes.metaGrid}>
        {metaRows.map((row) => (
          <Box key={row.label}>
            <Typography className={classes.metaLabel}>{row.label}</Typography>
            <Typography className={classes.metaValue}>{row.value}</Typography>
          </Box>
        ))}
      </div>

      <Typography className={classes.sectionTitle}>
        {i18n.t("inventorySales.sales.receipt.itemsTitle")}
      </Typography>

      {items.length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          {i18n.t("inventorySales.sales.receipt.noItems")}
        </Typography>
      ) : isMobile ? (
        <Box className="sale-receipt-items-mobile">
          {items.map((item) => (
            <div key={item.id} className={classes.mobileItem}>
              <Typography variant="body2" style={{ fontWeight: 600 }}>
                {getItemName(item)}
              </Typography>
              {item.productSku ? (
                <Typography variant="caption" color="textSecondary">
                  {item.productSku}
                </Typography>
              ) : null}
              <Typography variant="body2">
                {formatQuantity(item.quantity)} {item.unit || ""} ×{" "}
                {formatCurrencyBRL(item.unitPrice)}
              </Typography>
              <Typography variant="body2">
                {i18n.t("inventorySales.sales.receipt.columns.discount")}:{" "}
                {formatCurrencyBRL(item.discountAmount)} ·{" "}
                {i18n.t("inventorySales.sales.receipt.columns.total")}:{" "}
                {formatCurrencyBRL(item.totalAmount)}
              </Typography>
              <ReceiptItemIdentifiers item={item} classes={classes} />
            </div>
          ))}
        </Box>
      ) : (
        <Box className="sale-receipt-items-desktop">
          <Table size="small" className={classes.itemsTable}>
            <TableHead>
              <TableRow>
                <TableCell>
                  {i18n.t("inventorySales.sales.receipt.columns.product")}
                </TableCell>
                <TableCell align="right">
                  {i18n.t("inventorySales.sales.receipt.columns.quantity")}
                </TableCell>
                <TableCell align="right">
                  {i18n.t("inventorySales.sales.receipt.columns.unitPrice")}
                </TableCell>
                <TableCell align="right">
                  {i18n.t("inventorySales.sales.receipt.columns.discount")}
                </TableCell>
                <TableCell align="right">
                  {i18n.t("inventorySales.sales.receipt.columns.total")}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {getItemName(item)}
                    {item.productSku ? (
                      <span className={classes.productSku}>{item.productSku}</span>
                    ) : null}
                    <ReceiptItemIdentifiers item={item} classes={classes} />
                  </TableCell>
                  <TableCell align="right">
                    {formatQuantity(item.quantity)} {item.unit || ""}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrencyBRL(item.unitPrice)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrencyBRL(item.discountAmount)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrencyBRL(item.totalAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <div className={classes.totalsBox}>
        <div className={classes.totalRow}>
          <span>{i18n.t("inventorySales.sales.receipt.subtotal")}</span>
          <span>{formatCurrencyBRL(sale.subtotalAmount)}</span>
        </div>
        <div className={classes.totalRow}>
          <span>{i18n.t("inventorySales.sales.receipt.totalDiscount")}</span>
          <span>{formatCurrencyBRL(sale.discountAmount)}</span>
        </div>
        <div className={classes.totalRowFinal}>
          <span>{i18n.t("inventorySales.sales.receipt.total")}</span>
          <span>{formatCurrencyBRL(sale.totalAmount)}</span>
        </div>
        <div className={classes.totalRow}>
          <span>{i18n.t("inventorySales.sales.receipt.paidAmount")}</span>
          <span>{formatCurrencyBRL(sale.paidAmount)}</span>
        </div>
        <div className={classes.totalRow}>
          <span>{i18n.t("inventorySales.sales.receipt.pendingAmount")}</span>
          <span>{formatCurrencyBRL(getPendingAmount(sale))}</span>
        </div>
      </div>

      {sale.notes ? (
        <Box mt={2}>
          <Typography className={classes.metaLabel}>
            {i18n.t("inventorySales.sales.receipt.notes")}
          </Typography>
          <div className={classes.notesBlock}>{displayValue(sale.notes)}</div>
        </Box>
      ) : null}

      {sale.paymentNotes ? (
        <Box mt={2}>
          <Typography className={classes.metaLabel}>
            {i18n.t("inventorySales.sales.receipt.paymentNotes")}
          </Typography>
          <div className={classes.notesBlock}>
            {displayValue(sale.paymentNotes)}
          </div>
        </Box>
      ) : null}

      {isCancelled && sale.cancelReason ? (
        <Box mt={2}>
          <Typography className={classes.metaLabel}>
            {i18n.t("inventorySales.sales.cancelReasonLabel")}
          </Typography>
          <div className={classes.notesBlock}>
            {displayValue(sale.cancelReason)}
          </div>
        </Box>
      ) : null}
    </div>
  );

  return (
    <>
      <AppDialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        className="sale-receipt-dialog"
        PaperProps={{ style: { backgroundColor: "#fff" } }}
      >
        <AppDialogTitle className="sale-receipt-no-print">
          {i18n.t("inventorySales.sales.receipt.title")}
        </AppDialogTitle>
        <AppDialogContent dividers style={{ padding: 0, backgroundColor: "#fff" }}>
          {receiptContent}
        </AppDialogContent>
        <AppDialogActions className="sale-receipt-no-print">
          <AppSecondaryButton onClick={onClose}>
            {i18n.t("inventorySales.common.cancel")}
          </AppSecondaryButton>
          <AppPrimaryButton startIcon={<PrintIcon />} onClick={handlePrint}>
            {i18n.t("inventorySales.sales.receipt.print")}
          </AppPrimaryButton>
        </AppDialogActions>
      </AppDialog>

      <style>{open ? `
        @media print {
          body * {
            visibility: hidden;
          }
          .sale-receipt-print-area,
          .sale-receipt-print-area * {
            visibility: visible;
          }
          .sale-receipt-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
            padding: 16mm 12mm;
            background: white !important;
            color: #111 !important;
            box-shadow: none !important;
          }
          .sale-receipt-no-print {
            display: none !important;
          }
          .MuiDialog-root,
          .MuiDialog-container,
          .MuiDialog-paper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .MuiBackdrop-root {
            display: none !important;
          }
          .MuiDialogContent-root {
            padding: 0 !important;
            overflow: visible !important;
          }
        }
      ` : ""}</style>
    </>
  );
}
