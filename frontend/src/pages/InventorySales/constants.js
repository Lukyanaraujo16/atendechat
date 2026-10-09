export const INVENTORY_TABS = {
  SUMMARY: 0,
  PRODUCTS: 1,
  CATEGORIES: 2,
  STOCK: 3,
  SALES: 4,
  CUSTOMERS: 5,
  RECEIVABLES: 6,
  REPORTS: 7,
  SETTINGS: 8,
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
  "store_credit",
  "other",
];

/** Métodos de baixa de contas a receber — sem Crédito da Loja. */
export const RECEIVABLE_COLLECTION_METHODS = PAYMENT_METHODS.filter(
  (method) => method !== "store_credit"
);

export const STORE_CREDIT_FREQUENCIES = [
  "once",
  "weekly",
  "biweekly",
  "monthly",
];

export const RECEIVABLE_STATUSES = [
  "open",
  "partial",
  "paid",
  "overdue",
  "cancelled",
];

export const RECEIVABLE_BUCKETS = ["open", "overdue", "today", "next7"];

export const CUSTOMER_TYPES = ["individual", "company"];
