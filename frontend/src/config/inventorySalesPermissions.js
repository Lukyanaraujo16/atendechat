import { INVENTORY_SALES_FEATURE_KEY } from "./inventorySalesFeature";

export const INVENTORY_SALES_VIEW = "inventory.sales.view";
export const INVENTORY_SALES_MANAGE_PRODUCTS = "inventory.sales.manageProducts";
export const INVENTORY_SALES_MANAGE_STOCK = "inventory.sales.manageStock";
export const INVENTORY_SALES_CREATE_SALE = "inventory.sales.createSale";
export const INVENTORY_SALES_CANCEL_SALE = "inventory.sales.cancelSale";
export const INVENTORY_SALES_MANAGE_PAYMENTS = "inventory.sales.managePayments";
export const INVENTORY_SALES_VIEW_REPORTS = "inventory.sales.viewReports";
export const INVENTORY_SALES_MANAGE_SETTINGS = "inventory.sales.manageSettings";
export const INVENTORY_SALES_VIEW_CUSTOMERS = "inventory.sales.viewCustomers";
export const INVENTORY_SALES_MANAGE_CUSTOMERS = "inventory.sales.manageCustomers";
export const INVENTORY_SALES_VIEW_CUSTOMER_FINANCIALS =
  "inventory.sales.viewCustomerFinancials";
export const INVENTORY_SALES_MANAGE_CUSTOMER_CREDIT =
  "inventory.sales.manageCustomerCredit";
export const INVENTORY_SALES_USE_STORE_CREDIT = "inventory.sales.useStoreCredit";
export const INVENTORY_SALES_AUTHORIZE_STORE_CREDIT_OVERRIDE =
  "inventory.sales.authorizeStoreCreditOverride";
export const INVENTORY_SALES_VIEW_RECEIVABLES = "inventory.sales.viewReceivables";
export const INVENTORY_SALES_RECEIVE_RECEIVABLES =
  "inventory.sales.receiveReceivables";
export const INVENTORY_SALES_REVERSE_RECEIVABLE_PAYMENTS =
  "inventory.sales.reverseReceivablePayments";
export const INVENTORY_SALES_APPLY_DISCOUNT = "inventory.sales.applyDiscount";
export const INVENTORY_SALES_AUTHORIZE_DISCOUNT =
  "inventory.sales.authorizeDiscount";

export const INVENTORY_SALES_GRANULAR_KEYS = [
  INVENTORY_SALES_VIEW,
  INVENTORY_SALES_MANAGE_PRODUCTS,
  INVENTORY_SALES_MANAGE_STOCK,
  INVENTORY_SALES_CREATE_SALE,
  INVENTORY_SALES_CANCEL_SALE,
  INVENTORY_SALES_MANAGE_PAYMENTS,
  INVENTORY_SALES_VIEW_REPORTS,
  INVENTORY_SALES_MANAGE_SETTINGS,
  INVENTORY_SALES_VIEW_CUSTOMERS,
  INVENTORY_SALES_MANAGE_CUSTOMERS,
  INVENTORY_SALES_VIEW_CUSTOMER_FINANCIALS,
  INVENTORY_SALES_MANAGE_CUSTOMER_CREDIT,
  INVENTORY_SALES_USE_STORE_CREDIT,
  INVENTORY_SALES_AUTHORIZE_STORE_CREDIT_OVERRIDE,
  INVENTORY_SALES_VIEW_RECEIVABLES,
  INVENTORY_SALES_RECEIVE_RECEIVABLES,
  INVENTORY_SALES_REVERSE_RECEIVABLE_PAYMENTS,
  INVENTORY_SALES_APPLY_DISCOUNT,
  INVENTORY_SALES_AUTHORIZE_DISCOUNT,
];

export { INVENTORY_SALES_FEATURE_KEY };

export function planHasInventoryModule(planFlags) {
  const tier = planFlags?.planTierEffectiveFeatures;
  if (tier && typeof tier === "object" && Object.keys(tier).length > 0) {
    return tier[INVENTORY_SALES_FEATURE_KEY] === true;
  }
  return planFlags?.effectiveFeatures?.[INVENTORY_SALES_FEATURE_KEY] === true;
}

export function mergeInventoryGranularFeatures(planFx, userFx, user) {
  const planOn = planFx[INVENTORY_SALES_FEATURE_KEY] === true;
  const bypass =
    user?.super === true ||
    user?.profile === "admin" ||
    user?.profile === "superadmin" ||
    user?.supportMode === true;

  const out = {};
  INVENTORY_SALES_GRANULAR_KEYS.forEach((key) => {
    if (!planOn) {
      out[key] = false;
      return;
    }
    if (bypass || !userFx || typeof userFx !== "object") {
      out[key] = true;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(userFx, key)) {
      out[key] = userFx[key] === true;
    } else {
      out[key] = true;
    }
  });
  return out;
}
