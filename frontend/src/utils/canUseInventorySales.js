import { INVENTORY_SALES_FEATURE_KEY } from "../config/inventorySalesFeature";

export { INVENTORY_SALES_FEATURE_KEY };

export const canUseInventorySales = (planFlags) =>
  planFlags?.effectiveFeatures?.[INVENTORY_SALES_FEATURE_KEY] === true;
