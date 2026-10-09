import { useContext, useMemo } from "react";

import { AuthContext } from "../context/Auth/AuthContext";
import usePlanFlags from "../hooks/usePlanFlags";
import {
  INVENTORY_SALES_AUTHORIZE_STORE_CREDIT_OVERRIDE,
  INVENTORY_SALES_CANCEL_SALE,
  INVENTORY_SALES_CREATE_SALE,
  INVENTORY_SALES_MANAGE_CUSTOMER_CREDIT,
  INVENTORY_SALES_MANAGE_CUSTOMERS,
  INVENTORY_SALES_MANAGE_PAYMENTS,
  INVENTORY_SALES_MANAGE_PRODUCTS,
  INVENTORY_SALES_MANAGE_SETTINGS,
  INVENTORY_SALES_MANAGE_STOCK,
  INVENTORY_SALES_RECEIVE_RECEIVABLES,
  INVENTORY_SALES_REVERSE_RECEIVABLE_PAYMENTS,
  INVENTORY_SALES_USE_STORE_CREDIT,
  INVENTORY_SALES_APPLY_DISCOUNT,
  INVENTORY_SALES_AUTHORIZE_DISCOUNT,
  INVENTORY_SALES_VIEW,
  INVENTORY_SALES_VIEW_CUSTOMER_FINANCIALS,
  INVENTORY_SALES_VIEW_CUSTOMERS,
  INVENTORY_SALES_VIEW_RECEIVABLES,
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

export function canViewInventoryCustomers(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_VIEW_CUSTOMERS
  );
}

export function canManageInventoryCustomers(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_MANAGE_CUSTOMERS
  );
}

export function canViewInventoryCustomerFinancials(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_VIEW_CUSTOMER_FINANCIALS
  );
}

export function canManageInventoryCustomerCredit(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_MANAGE_CUSTOMER_CREDIT
  );
}

export function canUseInventoryStoreCredit(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_USE_STORE_CREDIT
  );
}

export function canAuthorizeInventoryStoreCreditOverride(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_AUTHORIZE_STORE_CREDIT_OVERRIDE
  );
}

export function canApplyInventorySaleDiscount(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_APPLY_DISCOUNT
  );
}

export function canAuthorizeInventorySaleDiscount(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_AUTHORIZE_DISCOUNT
  );
}

export function canViewInventoryReceivables(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_VIEW_RECEIVABLES
  );
}

export function canReceiveInventoryReceivables(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_RECEIVE_RECEIVABLES
  );
}

export function canReverseInventoryReceivablePayments(planFlags, user) {
  return hasInventoryPermission(
    planFlags,
    user,
    INVENTORY_SALES_REVERSE_RECEIVABLE_PAYMENTS
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
      canViewCustomers: canViewInventoryCustomers(planFlags, user),
      canManageCustomers: canManageInventoryCustomers(planFlags, user),
      canViewCustomerFinancials: canViewInventoryCustomerFinancials(
        planFlags,
        user
      ),
      canManageCustomerCredit: canManageInventoryCustomerCredit(
        planFlags,
        user
      ),
      canUseStoreCredit: canUseInventoryStoreCredit(planFlags, user),
      canAuthorizeStoreCreditOverride:
        canAuthorizeInventoryStoreCreditOverride(planFlags, user),
      canApplyDiscount: canApplyInventorySaleDiscount(planFlags, user),
      canAuthorizeDiscount: canAuthorizeInventorySaleDiscount(planFlags, user),
      canViewReceivables: canViewInventoryReceivables(planFlags, user),
      canReceiveReceivables: canReceiveInventoryReceivables(planFlags, user),
      canReverseReceivablePayments: canReverseInventoryReceivablePayments(
        planFlags,
        user
      ),
    }),
    [planFlags, user]
  );
}
