import { useContext, useMemo } from "react";

import { AuthContext } from "../context/Auth/AuthContext";
import usePlanFlags from "../hooks/usePlanFlags";
import {
  INVENTORY_SALES_CANCEL_SALE,
  INVENTORY_SALES_CREATE_SALE,
  INVENTORY_SALES_MANAGE_PAYMENTS,
  INVENTORY_SALES_MANAGE_PRODUCTS,
  INVENTORY_SALES_MANAGE_SETTINGS,
  INVENTORY_SALES_MANAGE_STOCK,
  INVENTORY_SALES_VIEW,
  INVENTORY_SALES_VIEW_REPORTS,
  planHasInventoryModule,
} from "../config/inventorySalesPermissions";

function isAdminBypass(user) {
  return (
    user?.super === true ||
    user?.profile === "admin" ||
    user?.profile === "superadmin" ||
    user?.supportMode === true
  );
}

export function hasInventoryPermission(planFlags, user, permissionKey) {
  if (!planFlags?.loaded) return false;
  if (!planHasInventoryModule(planFlags)) return false;
  if (isAdminBypass(user)) return true;
  return planFlags?.effectiveFeatures?.[permissionKey] === true;
}

export function canViewInventory(planFlags, user) {
  return hasInventoryPermission(planFlags, user, INVENTORY_SALES_VIEW);
}

export function canManageInventoryProducts(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_MANAGE_PRODUCTS
  );
}

export function canManageInventoryStock(planFlags, user) {
  return hasInventoryPermission(planFlags, user, INVENTORY_SALES_MANAGE_STOCK);
}

export function canCreateInventorySale(planFlags, user) {
  return hasInventoryPermission(planFlags, user, INVENTORY_SALES_CREATE_SALE);
}

export function canCancelInventorySale(planFlags, user) {
  return hasInventoryPermission(planFlags, user, INVENTORY_SALES_CANCEL_SALE);
}

export function canManageInventoryPayments(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_MANAGE_PAYMENTS
  );
}

export function canViewInventoryReports(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_VIEW_REPORTS
  );
}

export function canManageInventorySettings(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_MANAGE_SETTINGS
  );
}

export { planHasInventoryModule };

export function useInventoryPermissions() {
  const { user } = useContext(AuthContext);
  const planFlags = usePlanFlags();

  return useMemo(
    () => ({
      loaded: planFlags.loaded,
      canView: canViewInventory(planFlags, user),
      canManageProducts: canManageInventoryProducts(planFlags, user),
      canManageStock: canManageInventoryStock(planFlags, user),
      canCreateSale: canCreateInventorySale(planFlags, user),
      canCancelSale: canCancelInventorySale(planFlags, user),
      canManagePayments: canManageInventoryPayments(planFlags, user),
      canViewReports: canViewInventoryReports(planFlags, user),
      canManageSettings: canManageInventorySettings(planFlags, user),
    }),
    [planFlags, user]
  );
}
