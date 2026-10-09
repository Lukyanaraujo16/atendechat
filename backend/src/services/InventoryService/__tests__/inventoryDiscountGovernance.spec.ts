import InventoryDiscountAuthorization from "../../../models/InventoryDiscountAuthorization";
import User from "../../../models/User";
import {
  assertMerchandiseDiscountGovernance,
  buildMerchandiseDiscountSnapshot
} from "../inventoryDiscountGovernance";

describe("buildMerchandiseDiscountSnapshot — governança", () => {
  const baseItem = {
    unitPrice: 1000,
    quantity: 1,
    discountType: "fixed" as const,
    discountAmount: 100
  };

  test("exceedsLimit quando % efetivo > max permitido", () => {
    const snap = buildMerchandiseDiscountSnapshot({
      items: [baseItem],
      globalDiscountType: "percentage",
      globalDiscountPercent: 10,
      maxAllowedPercent: 15
    });
    expect(snap.effectivePercent).toBe(19);
    expect(snap.exceedsLimit).toBe(true);
  });

  test("R$ e % com mesma política efetiva (19% sobre bruto)", () => {
    const viaPercent = buildMerchandiseDiscountSnapshot({
      items: [
        {
          unitPrice: 1000,
          quantity: 1,
          discountType: "percentage",
          discountPercent: 10
        }
      ],
      globalDiscountType: "percentage",
      globalDiscountPercent: 10,
      maxAllowedPercent: 100
    });

    const viaFixed = buildMerchandiseDiscountSnapshot({
      items: [baseItem],
      globalDiscountType: "fixed",
      globalDiscountAmount: 90,
      maxAllowedPercent: 100
    });

    expect(viaPercent.effectivePercent).toBe(19);
    expect(viaFixed.effectivePercent).toBe(19);
    expect(viaPercent.netMerchandise).toBe(viaFixed.netMerchandise);
    expect(viaPercent.exceedsLimit).toBe(viaFixed.exceedsLimit);
  });

  test("desconto item + global somados disparam % efetivo total", () => {
    const snap = buildMerchandiseDiscountSnapshot({
      items: [
        {
          unitPrice: 200,
          quantity: 1,
          discountType: "fixed",
          discountAmount: 20
        }
      ],
      globalDiscountType: "fixed",
      globalDiscountAmount: 20,
      maxAllowedPercent: 15
    });
    expect(snap.itemDiscountTotal).toBe(20);
    expect(snap.globalDiscountAmount).toBe(20);
    expect(snap.effectivePercent).toBe(20);
    expect(snap.exceedsLimit).toBe(true);
  });

  test("dentro do limite → exceedsLimit false", () => {
    const snap = buildMerchandiseDiscountSnapshot({
      items: [
        {
          unitPrice: 100,
          quantity: 1,
          discountType: "fixed",
          discountAmount: 5
        }
      ],
      globalDiscountType: null,
      maxAllowedPercent: 10
    });
    expect(snap.effectivePercent).toBe(5);
    expect(snap.exceedsLimit).toBe(false);
  });

  test("desconto zero nunca exige autorização mesmo com max 0", () => {
    const snap = buildMerchandiseDiscountSnapshot({
      items: [{ unitPrice: 100, quantity: 1, discountType: "fixed", discountAmount: 0 }],
      maxAllowedPercent: 0
    });
    expect(snap.effectivePercent).toBe(0);
    expect(snap.exceedsLimit).toBe(false);
  });
});

describe("assertMerchandiseDiscountGovernance", () => {
  const createAuth = jest.spyOn(InventoryDiscountAuthorization, "create");
  const findUser = jest.spyOn(User, "findOne");

  beforeEach(() => {
    createAuth.mockReset();
    findUser.mockReset();
  });

  afterAll(() => {
    createAuth.mockRestore();
    findUser.mockRestore();
  });

  it("retorna null quando snapshot dentro do limite", async () => {
    const snapshot = buildMerchandiseDiscountSnapshot({
      items: [{ unitPrice: 100, quantity: 1, discountType: "fixed", discountAmount: 0 }],
      maxAllowedPercent: 5
    });
    const result = await assertMerchandiseDiscountGovernance({
      companyId: 1,
      sale: { id: 9 } as any,
      snapshot,
      transaction: {} as any
    });
    expect(result).toBeNull();
    expect(createAuth).not.toHaveBeenCalled();
  });

  it("exige autorização quando excede limite", async () => {
    const snapshot = buildMerchandiseDiscountSnapshot({
      items: [
        {
          unitPrice: 100,
          quantity: 1,
          discountType: "fixed",
          discountAmount: 20
        }
      ],
      maxAllowedPercent: 10
    });
    await expect(
      assertMerchandiseDiscountGovernance({
        companyId: 1,
        sale: { id: 9 } as any,
        snapshot,
        transaction: {} as any
      })
    ).rejects.toMatchObject({
      message: "ERR_INVENTORY_DISCOUNT_AUTHORIZATION_REQUIRED"
    });
  });

  it("grava auditoria quando autorizado", async () => {
    const snapshot = buildMerchandiseDiscountSnapshot({
      items: [
        {
          unitPrice: 100,
          quantity: 1,
          discountType: "fixed",
          discountAmount: 20
        }
      ],
      maxAllowedPercent: 10
    });
    findUser.mockResolvedValue({ id: 2 } as any);
    createAuth.mockResolvedValue({ id: 99 } as any);

    const result = await assertMerchandiseDiscountGovernance({
      companyId: 1,
      sale: { id: 9 } as any,
      snapshot,
      authorization: {
        authorize: true,
        canAuthorizeDiscount: true,
        authorizedByUserId: 2,
        reason: "Cliente fidelidade"
      },
      transaction: {} as any
    });

    expect(result).toEqual({ id: 99 });
    expect(createAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 1,
        saleId: 9,
        authorizedByUserId: 2,
        reason: "Cliente fidelidade",
        effectiveDiscountPercent: 20
      }),
      expect.any(Object)
    );
  });
});
