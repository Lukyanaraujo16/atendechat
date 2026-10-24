import { canDeleteInventoryProducts } from "../inventoryAccess";

/** Exclusão definitiva de produto: só admin da empresa / Super Admin (espelha o backend). */
describe("canDeleteInventoryProducts", () => {
  const planFlags = {
    loaded: true,
    effectiveFeatures: {
      "inventory.sales": true,
      "inventory.sales.manageProducts": true,
    },
  };

  it("admin, Super Admin e modo suporte podem excluir", () => {
    expect(canDeleteInventoryProducts(planFlags, { profile: "admin" })).toBe(true);
    expect(canDeleteInventoryProducts(planFlags, { profile: "user", super: true })).toBe(true);
    expect(canDeleteInventoryProducts(planFlags, { profile: "user", supportMode: true })).toBe(true);
  });

  it("atendente e supervisor com manageProducts não podem", () => {
    expect(canDeleteInventoryProducts(planFlags, { profile: "user" })).toBe(false);
    expect(canDeleteInventoryProducts(planFlags, { profile: "supervisor" })).toBe(false);
  });

  it("sem o módulo no plano ninguém exclui", () => {
    const noModule = { loaded: true, effectiveFeatures: {} };
    expect(canDeleteInventoryProducts(noModule, { profile: "admin" })).toBe(false);
  });
});
