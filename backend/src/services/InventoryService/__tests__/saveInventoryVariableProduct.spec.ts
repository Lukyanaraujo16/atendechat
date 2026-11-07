/**
 * Testes de contrato do cadastro composto (parsing/helpers sem DB).
 */
import {
  buildCombinationKey,
  buildVariantLabel,
  MAX_VARIANTS_PER_PRODUCT
} from "../inventoryVariantCombination";
import {
  parseCharacteristics,
  parseVariantRows
} from "../SaveInventoryVariableProductService";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: jest.fn() }
}));

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
      characteristics: [{ name: "Cor", options: ["Azul", "Branco", "Rosé"] }],
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

describe("limite de 50 variações por produto", () => {
  const sizes = (n: number) => Array.from({ length: n }, (_, i) => `T${i + 1}`);
  const rows = (n: number, withIds = false) =>
    sizes(n).map((v, i) => ({
      ...(withIds ? { id: i + 1 } : {}),
      options: [{ characteristicName: "Tamanho", optionValue: v }],
      salePrice: 10
    }));
  const errorOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (err) {
      return err as {
        message: string;
        statusCode: number;
        clientMessage?: string;
      };
    }
    throw new Error("esperava erro");
  };

  it("limite é 50", () => {
    expect(MAX_VARIANTS_PER_PRODUCT).toBe(50);
  });

  it.each([29, 30, 31, 49, 50])("aceita %i variações e opções", n => {
    expect(parseVariantRows(rows(n))).toHaveLength(n);
    expect(parseVariantRows(rows(n, true))).toHaveLength(n);
    const [char] = parseCharacteristics([
      { name: "Tamanho", options: sizes(n) }
    ]);
    expect(char.options).toHaveLength(n);
  });

  it("rejeita a 51ª variação", () => {
    const err = errorOf(() => parseVariantRows(rows(51)));
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("ERR_INVENTORY_VARIANT_LIMIT");
    expect(err.clientMessage).toBe(
      "Limite de 50 variações por produto excedido (51 selecionadas). Remova variações ou reduza as opções."
    );
  });

  it("rejeita 51 quando ao menos uma é nova", () => {
    const mixed = [...rows(50, true), rows(51)[50]];
    expect(errorOf(() => parseVariantRows(mixed)).clientMessage).toMatch(
      /Limite de 50/
    );
  });

  it("produto legado acima de 50 segue editável sem variação nova", () => {
    expect(parseVariantRows(rows(51, true))).toHaveLength(51);
  });

  it("rejeita característica com 51 opções", () => {
    const err = errorOf(() =>
      parseCharacteristics([{ name: "Tamanho", options: sizes(51) }])
    );
    expect(err.clientMessage).toBe(
      "A característica Tamanho tem opções demais (máx. 50)."
    );
  });
});
