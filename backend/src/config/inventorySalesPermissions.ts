import User from "../models/User";
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
  INVENTORY_SALES_MANAGE_SETTINGS
] as const;

export type InventorySalesGranularKey =
  (typeof INVENTORY_SALES_GRANULAR_KEYS)[number];

export function isInventoryGranularPermissionKey(
  key: string
): key is InventorySalesGranularKey {
  return (INVENTORY_SALES_GRANULAR_KEYS as readonly string[]).includes(key);
}

export function planAllowsInventoryModule(
  planMap: Record<string, boolean>
): boolean {
  return planMap[INVENTORY_SALES_FEATURE_KEY] === true;
}

function userBypassesGranularPermissions(
  userRow: Pick<User, "super" | "profile">,
  jwt: { supportMode?: boolean }
): boolean {
  return (
    userRow.super === true ||
    userRow.profile === "superadmin" ||
    userRow.profile === "admin" ||
    jwt.supportMode === true
  );
}

export function resolveInventoryGranularPermission(
  userRow: Pick<User, "super" | "profile">,
  jwt: { supportMode?: boolean },
  explicitMap: Record<string, boolean> | null,
  planMap: Record<string, boolean>,
  permissionKey: InventorySalesGranularKey
): boolean {
  if (!planAllowsInventoryModule(planMap)) return false;
  if (userBypassesGranularPermissions(userRow, jwt)) return true;
  if (explicitMap === null) return true;
  if (Object.prototype.hasOwnProperty.call(explicitMap, permissionKey)) {
    return explicitMap[permissionKey] === true;
  }
  return true;
}

export function mergeInventoryGranularIntoFeatureMap(
  base: Record<string, boolean>,
  userRow: Pick<User, "super" | "profile">,
  jwt: { supportMode?: boolean },
  explicitMap: Record<string, boolean> | null,
  planMap: Record<string, boolean>
): Record<string, boolean> {
  const out = { ...base };
  for (const key of INVENTORY_SALES_GRANULAR_KEYS) {
    out[key] = resolveInventoryGranularPermission(
      userRow,
      jwt,
      explicitMap,
      planMap,
      key
    );
  }
  return out;
}

export function inventoryGranularKeysInPlan(
  planMap: Record<string, boolean>
): InventorySalesGranularKey[] {
  if (!planAllowsInventoryModule(planMap)) return [];
  return [...INVENTORY_SALES_GRANULAR_KEYS];
}
