/**
 * Testes de contrato do cadastro composto (parsing/helpers sem DB).
 */
import {
  buildCombinationKey,
  buildVariantLabel
} from "../inventoryVariantCombination";

describe("SaveInventoryVariableProduct — combinação", () => {
  it("rótulo de três cores", () => {
    expect(
      buildVariantLabel([{ attributeName: "Cor", optionValue: "Azul" }])
    ).toBe("Azul");
  });

  it("rótulo cor + armazenamento", () => {
    expect(
      buildVariantLabel([
        { attributeName: "Cor", optionValue: "Azul" },
        { attributeName: "Armazenamento", optionValue: "256 GB" }
      ])
    ).toBe("Azul / 256 GB");
  });

  it("chave canônica evita duplicata por ordem", () => {
    const a = buildCombinationKey([
      { attributeId: 2, optionId: 20 },
      { attributeId: 1, optionId: 10 }
    ]);
    const b = buildCombinationKey([
      { attributeId: 1, optionId: 10 },
      { attributeId: 2, optionId: 20 }
    ]);
    expect(a).toBe(b);
  });
});

describe("payload shape with-variants", () => {
  it("documenta contrato esperado pelo serviço", () => {
    const body = {
      name: "iPhone 17 Pro Max",
      unit: "un",
      active: true,
      characteristics: [
        { name: "Cor", options: ["Azul", "Branco", "Rosé"] }
      ],
      variants: [
        {
          options: [{ characteristicName: "Cor", optionValue: "Azul" }],
          salePrice: 8500,
          costPrice: 6500,
          currentQuantity: 5,
          imageUrl: "https://cdn.example/azul.png"
        },
        {
          options: [{ characteristicName: "Cor", optionValue: "Branco" }],
          salePrice: 8700,
          currentQuantity: 3,
          imageUrl: null
        },
        {
          options: [{ characteristicName: "Cor", optionValue: "Rosé" }],
          salePrice: 8900,
          currentQuantity: 8
        }
      ]
    };
    expect(body.characteristics[0].options).toHaveLength(3);
    expect(body.variants).toHaveLength(3);
    expect(new Set(body.variants.map(v => v.salePrice)).size).toBe(3);
    expect(body.variants[0].imageUrl).toContain("azul");
  });
});
