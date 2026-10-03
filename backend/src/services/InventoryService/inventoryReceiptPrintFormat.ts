export const RECEIPT_PRINT_FORMATS = ["a4", "thermal80", "thermal58"] as const;

export type ReceiptPrintFormat = (typeof RECEIPT_PRINT_FORMATS)[number];

export const DEFAULT_RECEIPT_PRINT_FORMAT: ReceiptPrintFormat = "a4";

export function isReceiptPrintFormat(
  value: unknown
): value is ReceiptPrintFormat {
  return value === "a4" || value === "thermal80" || value === "thermal58";
}

export function receiptPrintFormatOrDefault(
  value: unknown
): ReceiptPrintFormat {
  return isReceiptPrintFormat(value) ? value : DEFAULT_RECEIPT_PRINT_FORMAT;
}
