import {
  INVENTORY_SALES_AUTHORIZE_STORE_CREDIT_OVERRIDE,
  INVENTORY_SALES_GRANULAR_KEYS,
  INVENTORY_SALES_MANAGE_CUSTOMER_CREDIT,
  INVENTORY_SALES_MANAGE_CUSTOMERS,
  INVENTORY_SALES_RECEIVE_RECEIVABLES,
  INVENTORY_SALES_REVERSE_RECEIVABLE_PAYMENTS,
  INVENTORY_SALES_USE_STORE_CREDIT,
  INVENTORY_SALES_VIEW_CUSTOMER_FINANCIALS,
  INVENTORY_SALES_VIEW_CUSTOMERS,
  INVENTORY_SALES_VIEW_RECEIVABLES,
  isInventoryGranularPermissionKey
} from "../../../config/inventorySalesPermissions";
import { PAYMENT_METHODS } from "../inventoryPaymentHelpers";
import fs from "fs";
import path from "path";

describe("store credit permissions and payment method", () => {
  it("expõe as novas chaves granulares", () => {
    const required = [
      INVENTORY_SALES_VIEW_CUSTOMERS,
      INVENTORY_SALES_MANAGE_CUSTOMERS,
      INVENTORY_SALES_VIEW_CUSTOMER_FINANCIALS,
      INVENTORY_SALES_MANAGE_CUSTOMER_CREDIT,
      INVENTORY_SALES_USE_STORE_CREDIT,
      INVENTORY_SALES_AUTHORIZE_STORE_CREDIT_OVERRIDE,
      INVENTORY_SALES_VIEW_RECEIVABLES,
      INVENTORY_SALES_RECEIVE_RECEIVABLES,
      INVENTORY_SALES_REVERSE_RECEIVABLE_PAYMENTS
    ];
    for (const key of required) {
      expect(isInventoryGranularPermissionKey(key)).toBe(true);
      expect(INVENTORY_SALES_GRANULAR_KEYS).toContain(key);
    }
  });

  it("PAYMENT_METHODS inclui store_credit", () => {
    expect(PAYMENT_METHODS).toContain("store_credit");
  });

  it("rotas de clientes/recebíveis referenciam as permissões", () => {
    const routes = fs.readFileSync(
      path.join(__dirname, "../../../routes/inventoryRoutes.ts"),
      "utf8"
    );
    expect(routes).toContain("INVENTORY_SALES_VIEW_CUSTOMERS");
    expect(routes).toContain("INVENTORY_SALES_VIEW_RECEIVABLES");
    expect(routes).toContain("INVENTORY_SALES_RECEIVE_RECEIVABLES");
    expect(routes).toContain("INVENTORY_SALES_REVERSE_RECEIVABLE_PAYMENTS");
    expect(routes).toContain("INVENTORY_SALES_USE_STORE_CREDIT");
    expect(routes).toContain("/inventory/contacts/search");
    expect(routes).toContain("/inventory/receivables");
  });
});
