import { canViewInventory } from "./inventoryAccess";

export { INVENTORY_SALES_FEATURE_KEY } from "../config/inventorySalesFeature";

export const canUseInventorySales = (planFlags, user) =>
  canViewInventory(planFlags, user);
