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
import { format } from "date-fns";

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
import { isThermalSaleReceiptFormat } from "./saleReceiptPrintFormats";
import { formatCardPaymentLabel } from "./cardInstallments";
import {
  hasReceiptBrandingFooter,
  hasReceiptBrandingHeader,
} from "./receiptBranding";

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
  branding: {
    textAlign: "center",
    marginBottom: theme.spacing(2),
  },
  brandingTrade: {
    fontWeight: 700,
    fontSize: "1.125rem",
    wordBreak: "break-word",
  },
  brandingLogo: {
    display: "block",
    margin: "0 auto 8px",
    maxWidth: 160,
    maxHeight: 80,
    width: "auto",
    height: "auto",
    objectFit: "contain",
  },
  brandingLine: {
    fontSize: "0.8125rem",
    wordBreak: "break-word",
    whiteSpace: "pre-line",
  },
  brandingFooter: {
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(1.5),
    borderTop: "1px solid #ddd",
    textAlign: "center",
    fontSize: "0.8125rem",
    whiteSpace: "pre-line",
    wordBreak: "break-word",
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
        <span key={row.position} className={classes.identifierLine}>
          - {row.identifier}
        </span>
      ))}
    </div>
  );
}

function ReceiptLogo({ branding, className }) {
  const [hidden, setHidden] = React.useState(false);
  if (!branding || !branding.logoUrl || hidden) return null;
  return (
    <img
      alt=""
      src={branding.logoUrl}
      className={className}
      onError={(event) => {
        event.currentTarget.style.display = "none";
        window.setTimeout(() => setHidden(true), 0);
      }}
    />
  );
}

function ReceiptBrandingHeader({ branding, classes, thermal }) {
  const hasText = hasReceiptBrandingHeader(branding);
  const hasLogo = Boolean(branding && branding.logoUrl);
  if (!hasText && !hasLogo) return null;
  const prominent = hasText ? branding.tradeName || branding.legalName : "";
  const legalBelow = Boolean(hasText && branding.tradeName && branding.legalName);
  const documentLabel = i18n.t("inventorySales.sales.receipt.branding.document");
  const phoneLabel = i18n.t("inventorySales.sales.receipt.branding.phone");
  const logoClass = thermal ? "sale-receipt-branding-logo" : classes.brandingLogo;

  if (thermal) {
    return (
      <div className="sale-receipt-branding">
        <ReceiptLogo branding={branding} className={logoClass} />
        {prominent ? (
          <div className="sale-receipt-branding-trade">{prominent}</div>
        ) : null}
        {legalBelow ? (
          <div className="sale-receipt-branding-line">{branding.legalName}</div>
        ) : null}
        {branding.document ? (
          <div className="sale-receipt-branding-line">
            {documentLabel}: {branding.document}
          </div>
        ) : null}
        {branding.address ? (
          <div className="sale-receipt-branding-line">{branding.address}</div>
        ) : null}
        {branding.phone ? (
          <div className="sale-receipt-branding-line">
            {phoneLabel}: {branding.phone}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={classes.branding}>
      <ReceiptLogo branding={branding} className={logoClass} />
      {prominent ? (
        <div className={classes.brandingTrade}>{prominent}</div>
      ) : null}
      {legalBelow ? (
        <div className={classes.brandingLine}>{branding.legalName}</div>
      ) : null}
      {branding.document ? (
        <div className={classes.brandingLine}>
          {documentLabel}: {branding.document}
        </div>
      ) : null}
      {branding.address ? (
        <div className={classes.brandingLine}>{branding.address}</div>
      ) : null}
      {branding.phone ? (
        <div className={classes.brandingLine}>
          {phoneLabel}: {branding.phone}
        </div>
      ) : null}
    </div>
  );
}

function ReceiptBrandingFooter({ branding, classes, thermal }) {
  if (!hasReceiptBrandingFooter(branding)) return null;
  if (thermal) {
    return (
      <div className="sale-receipt-branding-footer">{branding.footerMessage}</div>
    );
  }
  return <div className={classes.brandingFooter}>{branding.footerMessage}</div>;
}

function getPendingAmount(sale) {
  const total = toNumber(sale?.totalAmount);
  const paid = toNumber(sale?.paidAmount);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

function ThermalReceipt({ sale, classes, branding }) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const isCancelled = sale.status === "cancelled";
  const customerName = sale.contact?.name || "";
  const sellerName = sale.seller?.name || "";
  const statusLabel = i18n.t(`inventorySales.sales.status.${sale.status}`, sale.status);
  const paymentStatusLabel = i18n.t(
    `inventorySales.sales.paymentStatus.${sale.paymentStatus || "unpaid"}`,
    sale.paymentStatus || "unpaid"
  );
  const paymentMethodLabel = sale.paymentMethod
    ? formatCardPaymentLabel(
        i18n.t(
          `inventorySales.sales.paymentMethods.${sale.paymentMethod}`,
          sale.paymentMethod
        ),
        sale.paymentMethod,
        sale.cardInstallmentCount,
        sale.totalAmount
      )
    : "";

  return (
    <div className="sale-receipt-print-page sale-receipt-thermal">
      <div className="sale-receipt-thermal-top">
        <ReceiptBrandingHeader branding={branding} classes={classes} thermal />
        <div className="sale-receipt-thermal-title">
          {i18n.t("inventorySales.sales.receipt.title")}
        </div>
        {isCancelled ? (
          <div className="sale-receipt-thermal-cancelled">
            {i18n.t("inventorySales.sales.receipt.cancelled")}
          </div>
        ) : null}
      </div>

      <div className="sale-receipt-thermal-line">
        <span className="sale-receipt-thermal-label">
          {i18n.t("inventorySales.sales.receipt.saleNumber")}:{" "}
        </span>
        {formatSaleNumber(sale)}
      </div>
      <div className="sale-receipt-thermal-line">
        <span className="sale-receipt-thermal-label">
          {i18n.t("inventorySales.sales.receipt.saleDate")}:{" "}
        </span>
        {formatReceiptDate(getSaleDisplayDate(sale))}
      </div>
      <div className="sale-receipt-thermal-line">
        <span className="sale-receipt-thermal-label">
          {i18n.t("inventorySales.sales.receipt.operationalStatus")}:{" "}
        </span>
        {statusLabel}
      </div>
      <div className="sale-receipt-thermal-line">
        <span className="sale-receipt-thermal-label">
          {i18n.t("inventorySales.sales.receipt.paymentStatus")}:{" "}
        </span>
        {paymentStatusLabel}
      </div>
      {customerName ? (
        <div className="sale-receipt-thermal-line">
          <span className="sale-receipt-thermal-label">
            {i18n.t("inventorySales.sales.receipt.customer")}:{" "}
          </span>
          {customerName}
        </div>
      ) : null}
      {sellerName ? (
        <div className="sale-receipt-thermal-line">
          <span className="sale-receipt-thermal-label">
            {i18n.t("inventorySales.sales.receipt.seller")}:{" "}
          </span>
          {sellerName}
        </div>
      ) : null}
      {paymentMethodLabel ? (
        <div className="sale-receipt-thermal-line">
          <span className="sale-receipt-thermal-label">
            {i18n.t("inventorySales.sales.receipt.paymentMethod")}:{" "}
          </span>
          {paymentMethodLabel}
        </div>
      ) : null}

      <hr className="sale-receipt-thermal-rule" />

      {items.length === 0 ? (
        <div className="sale-receipt-thermal-line">
          {i18n.t("inventorySales.sales.receipt.noItems")}
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="sale-receipt-thermal-item">
            <div className="sale-receipt-thermal-item-name">{getItemName(item)}</div>
            {item.productSku ? (
              <div className="sale-receipt-thermal-line">{item.productSku}</div>
            ) : null}
            <div className="sale-receipt-thermal-line">
              {formatQuantity(item.quantity)}
              {item.unit ? ` ${item.unit}` : ""} × {formatCurrencyBRL(item.unitPrice)}
            </div>
            <div className="sale-receipt-thermal-money">
              <span>
                {i18n.t("inventorySales.sales.receipt.columns.discount")}:{" "}
                {formatCurrencyBRL(item.discountAmount)}
              </span>
              <span>{formatCurrencyBRL(item.totalAmount)}</span>
            </div>
            <ReceiptItemIdentifiers item={item} classes={classes} />
          </div>
        ))
      )}

      <hr className="sale-receipt-thermal-rule" />

      <div className="sale-receipt-totals">
        <div className="sale-receipt-thermal-total-row">
          <span>{i18n.t("inventorySales.sales.receipt.subtotal")}</span>
          <span>{formatCurrencyBRL(sale.subtotalAmount)}</span>
        </div>
        <div className="sale-receipt-thermal-total-row">
          <span>{i18n.t("inventorySales.sales.receipt.totalDiscount")}</span>
          <span>{formatCurrencyBRL(sale.discountAmount)}</span>
        </div>
        <div className="sale-receipt-thermal-total-row sale-receipt-thermal-total">
          <span>{i18n.t("inventorySales.sales.receipt.total")}</span>
          <span>{formatCurrencyBRL(sale.totalAmount)}</span>
        </div>
        <div className="sale-receipt-thermal-total-row">
          <span>{i18n.t("inventorySales.sales.receipt.paidAmount")}</span>
          <span>{formatCurrencyBRL(sale.paidAmount)}</span>
        </div>
        <div className="sale-receipt-thermal-total-row">
          <span>{i18n.t("inventorySales.sales.receipt.pendingAmount")}</span>
          <span>{formatCurrencyBRL(getPendingAmount(sale))}</span>
        </div>
      </div>

      {sale.notes ? (
        <div className="sale-receipt-thermal-notes">
          <div className="sale-receipt-thermal-label">
            {i18n.t("inventorySales.sales.receipt.notes")}
          </div>
          <div>{displayValue(sale.notes)}</div>
        </div>
      ) : null}

      {sale.paymentNotes ? (
        <div className="sale-receipt-thermal-notes">
          <div className="sale-receipt-thermal-label">
            {i18n.t("inventorySales.sales.receipt.paymentNotes")}
          </div>
          <div>{displayValue(sale.paymentNotes)}</div>
        </div>
      ) : null}

      {isCancelled && sale.cancelReason ? (
        <div className="sale-receipt-thermal-notes">
          <div className="sale-receipt-thermal-label">
            {i18n.t("inventorySales.sales.cancelReasonLabel")}
          </div>
          <div>{displayValue(sale.cancelReason)}</div>
        </div>
      ) : null}

      <ReceiptBrandingFooter branding={branding} classes={classes} thermal />
    </div>
  );
}

/**
 * Conteúdo do recibo compartilhado pelo diálogo e pelo documento de impressão.
 * `layout="print"` no A4 força a tabela. Térmica usa blocos, sem a viewport da tela.
 */
export default function SaleReceiptContent({
  sale,
  layout = "screen",
  format,
  branding = null,
}) {
  const classes = useStyles();
  const isMobileViewport = useIsMobile();
  const isThermalPrint = layout === "print" && isThermalSaleReceiptFormat(format);
  const isMobile = layout === "print" ? false : isMobileViewport;

  if (!sale) return null;

  if (isThermalPrint) {
    return <ThermalReceipt sale={sale} classes={classes} branding={branding} />;
  }

  const items = Array.isArray(sale.items) ? sale.items : [];
  const isCancelled = sale.status === "cancelled";
  const rootClass =
    layout === "print"
      ? `${classes.receiptRoot} sale-receipt-print-page`
      : `${classes.receiptRoot} sale-receipt-print-area`;

  const statusLabel = (status) =>
    i18n.t(`inventorySales.sales.status.${status}`, status);

  const paymentStatusLabel = (status) =>
    i18n.t(`inventorySales.sales.paymentStatus.${status}`, status);

  const paymentMethodLabel = (method) =>
    formatCardPaymentLabel(
      method
        ? i18n.t(`inventorySales.sales.paymentMethods.${method}`, method)
        : i18n.t("inventorySales.sales.payment.noMethod"),
      method,
      sale.cardInstallmentCount,
      sale.totalAmount
    );

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

  return (
    <div className={rootClass}>
      <ReceiptBrandingHeader branding={branding} classes={classes} />
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

      <div className={`${classes.totalsBox} sale-receipt-totals`}>
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
          <div className={`${classes.notesBlock} sale-receipt-notes`}>
            {displayValue(sale.notes)}
          </div>
        </Box>
      ) : null}

      {sale.paymentNotes ? (
        <Box mt={2}>
          <Typography className={classes.metaLabel}>
            {i18n.t("inventorySales.sales.receipt.paymentNotes")}
          </Typography>
          <div className={`${classes.notesBlock} sale-receipt-notes`}>
            {displayValue(sale.paymentNotes)}
          </div>
        </Box>
      ) : null}

      {isCancelled && sale.cancelReason ? (
        <Box mt={2}>
          <Typography className={classes.metaLabel}>
            {i18n.t("inventorySales.sales.cancelReasonLabel")}
          </Typography>
          <div className={`${classes.notesBlock} sale-receipt-notes`}>
            {displayValue(sale.cancelReason)}
          </div>
        </Box>
      ) : null}

      <ReceiptBrandingFooter branding={branding} classes={classes} />
    </div>
  );
}
