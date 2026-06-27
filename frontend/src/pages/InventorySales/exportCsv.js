import { format } from "date-fns";

const CSV_SEPARATOR = ";";
const UTF8_BOM = "\uFEFF";

function escapeCsvCell(value) {
  if (value == null) return "";
  const text = String(value);
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvContent(rows) {
  return rows
    .map((row) => row.map(escapeCsvCell).join(CSV_SEPARATOR))
    .join("\r\n");
}

function downloadCsvFile(filename, csvContent) {
  const blob = new Blob([UTF8_BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function fileDateSuffix(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

export function formatCsvMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatCsvQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(n);
}

export function formatCsvDate(value) {
  if (!value) return "";
  try {
    return format(new Date(value), "dd/MM/yyyy");
  } catch {
    return "";
  }
}

function formatFilterDate(value) {
  if (!value) return "";
  try {
    return format(new Date(value), "dd/MM/yyyy");
  } catch {
    return String(value);
  }
}

function buildFilterRows(filters, t) {
  const sellerLabel =
    filters.sellerName ||
    t("inventorySales.reports.export.filters.allSellers");

  return [
    [
      t("inventorySales.reports.export.filters.startDate"),
      formatFilterDate(filters.startDate) || "—",
    ],
    [
      t("inventorySales.reports.export.filters.endDate"),
      formatFilterDate(filters.endDate) || "—",
    ],
    [t("inventorySales.reports.export.filters.seller"), sellerLabel],
    [],
  ];
}

function downloadReportCsv(type, csvContent) {
  downloadCsvFile(
    `inventory-report-${type}-${fileDateSuffix()}.csv`,
    csvContent
  );
}

export function exportInventorySummaryCsv(summary, filters, t) {
  if (!summary) return false;

  const rows = [
    ...buildFilterRows(filters, t),
    [
      t("inventorySales.reports.export.summaryColumns.metric"),
      t("inventorySales.reports.export.summaryColumns.value"),
    ],
    [
      t("inventorySales.reports.summary.totalSold"),
      formatCsvMoney(summary.totalSold),
    ],
    [
      t("inventorySales.reports.summary.totalPaid"),
      formatCsvMoney(summary.totalPaid),
    ],
    [
      t("inventorySales.reports.summary.totalPending"),
      formatCsvMoney(summary.totalPending),
    ],
    [
      t("inventorySales.reports.summary.completedCount"),
      String(summary.completedSalesCount ?? 0),
    ],
    [
      t("inventorySales.reports.summary.averageTicket"),
      formatCsvMoney(summary.averageTicket),
    ],
    [
      t("inventorySales.reports.summary.totalCommission"),
      formatCsvMoney(summary.totalCommission),
    ],
    [
      t("inventorySales.reports.summary.cancelledCount"),
      String(summary.cancelledSalesCount ?? 0),
    ],
    [
      t("inventorySales.reports.summary.cancelledTotal"),
      formatCsvMoney(summary.cancelledTotal),
    ],
  ];

  downloadReportCsv("summary", buildCsvContent(rows));
  return true;
}

export function exportInventorySellersCsv(sellers, filters, t) {
  if (!Array.isArray(sellers) || sellers.length === 0) return false;

  const rows = [
    ...buildFilterRows(filters, t),
    [
      t("inventorySales.reports.columns.seller"),
      t("inventorySales.reports.columns.salesCount"),
      t("inventorySales.reports.columns.totalSold"),
      t("inventorySales.reports.columns.commission"),
      t("inventorySales.reports.columns.averageTicket"),
    ],
    ...sellers.map((row) => [
      row.sellerName || t("inventorySales.reports.noSeller"),
      String(row.salesCount ?? 0),
      formatCsvMoney(row.totalSold),
      formatCsvMoney(row.totalCommission),
      formatCsvMoney(row.averageTicket),
    ]),
  ];

  downloadReportCsv("sellers", buildCsvContent(rows));
  return true;
}

export function exportInventoryProductsCsv(products, filters, t) {
  if (!Array.isArray(products) || products.length === 0) return false;

  const rows = [
    ...buildFilterRows(filters, t),
    [
      t("inventorySales.reports.columns.product"),
      t("inventorySales.reports.export.columns.sku"),
      t("inventorySales.reports.columns.quantitySold"),
      t("inventorySales.reports.columns.totalSold"),
      t("inventorySales.reports.columns.salesCount"),
    ],
    ...products.map((row) => [
      row.productName || "—",
      row.productSku || "",
      formatCsvQuantity(row.quantitySold),
      formatCsvMoney(row.totalSold),
      String(row.salesCount ?? 0),
    ]),
  ];

  downloadReportCsv("products", buildCsvContent(rows));
  return true;
}

export function exportInventoryCustomersCsv(customers, filters, t) {
  if (!Array.isArray(customers) || customers.length === 0) return false;

  const rows = [
    ...buildFilterRows(filters, t),
    [
      t("inventorySales.reports.columns.customer"),
      t("inventorySales.reports.columns.salesCount"),
      t("inventorySales.reports.columns.totalSold"),
      t("inventorySales.reports.columns.lastPurchase"),
    ],
    ...customers.map((row) => [
      row.contactName || "—",
      String(row.salesCount ?? 0),
      formatCsvMoney(row.totalSold),
      formatCsvDate(row.lastPurchaseAt),
    ]),
  ];

  downloadReportCsv("customers", buildCsvContent(rows));
  return true;
}

export function exportAllInventoryReportsCsv(data, t) {
  const { summary, sellers, products, customers, filters } = data;
  const tasks = [];

  if (canExportSummary(summary)) {
    tasks.push(() => exportInventorySummaryCsv(summary, filters, t));
  }
  if (canExportReportRows(sellers)) {
    tasks.push(() => exportInventorySellersCsv(sellers, filters, t));
  }
  if (canExportReportRows(products)) {
    tasks.push(() => exportInventoryProductsCsv(products, filters, t));
  }
  if (canExportReportRows(customers)) {
    tasks.push(() => exportInventoryCustomersCsv(customers, filters, t));
  }

  if (tasks.length === 0) return false;

  tasks.forEach((run, index) => {
    window.setTimeout(run, index * 250);
  });

  return true;
}

export function canExportSummary(summary) {
  if (!summary) return false;
  return (
    (summary.completedSalesCount ?? 0) > 0 ||
    (summary.cancelledSalesCount ?? 0) > 0
  );
}

export function canExportReportRows(rows) {
  return Array.isArray(rows) && rows.length > 0;
}
