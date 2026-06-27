import { INVENTORY_SALES_FEATURE_KEY } from "./inventorySalesFeature";

export const INVENTORY_SALES_VIEW = "inventory.sales.view";
export const INVENTORY_SALES_MANAGE_PRODUCTS = "inventory.sales.manageProducts";
export const INVENTORY_SALES_MANAGE_STOCK = "inventory.sales.manageStock";
export const INVENTORY_SALES_CREATE_SALE = "inventory.sales.createSale";
export const INVENTORY_SALES_CANCEL_SALE = "inventory.sales.cancelSale";
export const INVENTORY_SALES_MANAGE_PAYMENTS = "inventory.sales.managePayments";
export const INVENTORY_SALES_VIEW_REPORTS = "inventory.sales.viewReports";
export const INVENTORY_SALES_MANAGE_SETTINGS = "inventory.sales.manageSettings";

export const INVENTORY_SALES_GRANULAR_KEYS = [
  INVENTORY_SALES_VIEW,
  INVENTORY_SALES_MANAGE_PRODUCTS,
  INVENTORY_SALES_MANAGE_STOCK,
  INVENTORY_SALES_CREATE_SALE,
  INVENTORY_SALES_CANCEL_SALE,
  INVENTORY_SALES_MANAGE_PAYMENTS,
  INVENTORY_SALES_VIEW_REPORTS,
  INVENTORY_SALES_MANAGE_SETTINGS,
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
