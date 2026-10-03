export const INVENTORY_TABS = {
  SUMMARY: 0,
  PRODUCTS: 1,
  CATEGORIES: 2,
  STOCK: 3,
  SALES: 4,
  REPORTS: 5,
  SETTINGS: 6,
};

export const STOCK_MOVEMENT_TYPES = ["in", "out", "adjustment", "initial"];

/** Filtro da listagem. Inclui tipos gerados por venda, que o POST manual recusa. */
export const LISTABLE_STOCK_MOVEMENT_TYPES = [
  ...STOCK_MOVEMENT_TYPES,
  "sale",
  "sale_reversal",
];

export const SALE_STATUSES = ["draft", "completed", "cancelled"];

export const PAYMENT_STATUSES = ["unpaid", "paid", "partial", "refunded"];

export const PAYMENT_METHODS = [
  "cash",
  "pix",
  "credit_card",
  "debit_card",
  "bank_transfer",
  "boleto",
  "other",
];
