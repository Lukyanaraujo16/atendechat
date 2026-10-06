import {
  PERMISSION_UI_GROUPS,
  applyPermissionPreset,
  clearAllInPlan,
  keysForGroupInPlan,
  selectAllAllowedForActor,
  toggleInventoryPermission,
} from "../permissionUiConfig";
import { INVENTORY_SALES_GRANULAR_KEYS } from "../../../config/inventorySalesPermissions";

const planWithInventory = {
  "inventory.sales": true,
  "dashboard.main": true,
  "attendance.inbox": true,
};

const planWithoutInventory = {
  "dashboard.main": true,
  "attendance.inbox": true,
};

describe("permissões de Estoque e Vendas no modal", () => {
  it("mostra o grupo quando o plano tem inventory.sales", () => {
    const group = PERMISSION_UI_GROUPS.find((g) => g.id === "inventorySales");
    expect(keysForGroupInPlan(group, planWithInventory)).toEqual(
      INVENTORY_SALES_GRANULAR_KEYS
    );
  });

  it("esconde o grupo quando o plano não tem o módulo", () => {
    const group = PERMISSION_UI_GROUPS.find((g) => g.id === "inventorySales");
    expect(keysForGroupInPlan(group, planWithoutInventory)).toEqual([]);
  });

  it("selecionar tudo inclui as permissões granulares", () => {
    const next = selectAllAllowedForActor(planWithInventory, null);
    INVENTORY_SALES_GRANULAR_KEYS.forEach((key) => {
      expect(next[key]).toBe(true);
    });
  });

  it("limpar e o padrão não concedem Estoque e Vendas", () => {
    const cleared = clearAllInPlan(planWithInventory);
    const defaults = applyPermissionPreset(planWithInventory, "attendant");
    INVENTORY_SALES_GRANULAR_KEYS.forEach((key) => {
      expect(cleared[key]).toBe(false);
      expect(defaults[key]).toBe(false);
    });
  });

  it("marcar uma ação garante view e desmarcar view limpa as filhas", () => {
    const withProducts = toggleInventoryPermission(
      {},
      "inventory.sales.manageProducts",
      true
    );
    expect(withProducts["inventory.sales.view"]).toBe(true);
    expect(withProducts["inventory.sales.manageProducts"]).toBe(true);
    const cleared = toggleInventoryPermission(
      withProducts,
      "inventory.sales.view",
      false
    );
    expect(cleared["inventory.sales.view"]).toBe(false);
    expect(cleared["inventory.sales.manageProducts"]).toBe(false);
  });
});
