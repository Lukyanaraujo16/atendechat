import {
  MAX_AUTO_VARIANT_COMBINATIONS,
  buildCartesianCombinations,
  combinationKey,
  combinationLabel,
  emptyDraftVariant,
  mergeCombinationPreview,
  resolveVariantImageUrl,
} from "../productVariantCombinations";

describe("productVariantCombinations", () => {
  it("gera três cores a partir de uma característica", () => {
    const { combinations, truncated } = buildCartesianCombinations([
      { name: "Cor", options: ["Azul", "Branco", "Rosé"] },
    ]);
    expect(truncated).toBe(false);
    expect(combinations).toHaveLength(3);
    expect(combinations.map(combinationLabel)).toEqual([
      "Azul",
      "Branco",
      "Rosé",
    ]);
  });

  it("gera cartesiano cor x armazenamento", () => {
    const { combinations } = buildCartesianCombinations([
      { name: "Cor", options: ["Azul", "Branco"] },
      { name: "Armazenamento", options: ["256 GB", "512 GB"] },
    ]);
    expect(combinations).toHaveLength(4);
    expect(combinations.map(combinationLabel).sort()).toEqual([
      "Azul / 256 GB",
      "Azul / 512 GB",
      "Branco / 256 GB",
      "Branco / 512 GB",
    ]);
  });

  it("limita geração automática", () => {
    const options = Array.from({ length: 10 }, (_, i) => `O${i}`);
    const { combinations, truncated, totalPossible } = buildCartesianCombinations([
      { name: "A", options },
      { name: "B", options },
    ]);
    expect(totalPossible).toBe(100);
    expect(combinations.length).toBe(MAX_AUTO_VARIANT_COMBINATIONS);
    expect(truncated).toBe(true);
  });

  it("preserva rascunhos existentes ao mesclar prévia", () => {
    const existing = [
      {
        ...emptyDraftVariant([
          { characteristicName: "Cor", optionValue: "Azul" },
        ]),
        salePrice: 8500,
        id: 11,
        persisted: true,
      },
    ];
    const { drafts } = mergeCombinationPreview(
      [{ name: "Cor", options: ["Azul", "Branco"] }],
      existing
    );
    const azul = drafts.find(
      (d) => combinationKey(d.options) === combinationKey(existing[0].options)
    );
    expect(azul.salePrice).toBe(8500);
    expect(azul.id).toBe(11);
    expect(drafts).toHaveLength(2);
  });

  it("permite desmarcar combinação sugerida mantendo outras", () => {
    const { drafts } = mergeCombinationPreview(
      [{ name: "Cor", options: ["Azul", "Branco", "Rosé"] }],
      []
    );
    drafts[1].selected = false;
    const selected = drafts.filter((d) => d.selected !== false);
    expect(selected).toHaveLength(2);
  });

  it("resolve imagem da variante com fallback no produto", () => {
    expect(
      resolveVariantImageUrl(
        { imageUrl: "https://img/azul.png" },
        { imageUrl: "https://img/pai.png" }
      )
    ).toBe("https://img/azul.png");
    expect(
      resolveVariantImageUrl({ imageUrl: "" }, { imageUrl: "https://img/pai.png" })
    ).toBe("https://img/pai.png");
    expect(resolveVariantImageUrl({}, {})).toBeNull();
  });
});
