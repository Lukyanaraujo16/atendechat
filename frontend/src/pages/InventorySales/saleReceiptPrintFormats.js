/**
 * Identificadores dos formatos de impressão do recibo.
 * A preferência da empresa fica em InventorySettings e é aplicada pelo modal.
 * Este módulo não persiste nada.
 */
export const SALE_RECEIPT_PRINT_FORMATS = {
  a4: "a4",
  thermal80: "thermal80",
  thermal58: "thermal58",
};

export const DEFAULT_SALE_RECEIPT_PRINT_FORMAT = SALE_RECEIPT_PRINT_FORMATS.a4;

export const SALE_RECEIPT_PRINT_FORMAT_LIST = [
  SALE_RECEIPT_PRINT_FORMATS.a4,
  SALE_RECEIPT_PRINT_FORMATS.thermal80,
  SALE_RECEIPT_PRINT_FORMATS.thermal58,
];

export function isSaleReceiptPrintFormat(value) {
  return SALE_RECEIPT_PRINT_FORMAT_LIST.indexOf(value) !== -1;
}

export function isThermalSaleReceiptFormat(value) {
  return (
    value === SALE_RECEIPT_PRINT_FORMATS.thermal80 ||
    value === SALE_RECEIPT_PRINT_FORMATS.thermal58
  );
}
