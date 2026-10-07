/**
 * @jest-environment jsdom
 */
import {
  getInventorySaleItems,
  normalizeInventorySale,
} from "../normalizeInventorySale";

describe("normalizeInventorySale", () => {
  it("lê items padrão", () => {
    const sale = {
      id: 1,
      items: [
        {
          id: 10,
          productName: "Cabo",
          quantity: 2,
          unitPrice: 10,
          discountAmount: 0,
          totalAmount: 20,
        },
      ],
    };
    expect(getInventorySaleItems(sale)).toHaveLength(1);
    expect(getInventorySaleItems(sale)[0].productName).toBe("Cabo");
  });

  it("aceita alias InventorySaleItems", () => {
    const sale = {
      id: 1,
      InventorySaleItems: [
        {
          id: 11,
          productName: "Chip",
          quantity: 1,
          unitPrice: 50,
          discountAmount: 0,
          totalAmount: 50,
        },
      ],
    };
    const normalized = normalizeInventorySale(sale);
    expect(normalized.items).toHaveLength(1);
    expect(normalized.items[0].productName).toBe("Chip");
  });

  it("usa product.name como fallback de productName", () => {
    const sale = {
      items: [
        {
          id: 12,
          product: { name: "Fone", sku: "F1" },
          quantity: 1,
          unitPrice: 99,
          discountAmount: 0,
          totalAmount: 99,
        },
      ],
    };
    expect(getInventorySaleItems(sale)[0].productName).toBe("Fone");
    expect(getInventorySaleItems(sale)[0].productSku).toBe("F1");
  });
});
