import {
  MAX_VARIANTS_PER_PRODUCT,
  buildCartesianCombinations,
  combinationKey,
  combinationLabel,
  emptyDraftVariant,
  mergeCombinationPreview,
  resolveVariantImageUrl,
  variantLimitIssue,
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

  it("acima do limite não gera prévia parcial", () => {
    const options = Array.from({ length: 10 }, (_, i) => `O${i}`);
    const { combinations, truncated, totalPossible } = buildCartesianCombinations([
      { name: "A", options },
      { name: "B", options },
    ]);
    expect(totalPossible).toBe(100);
    expect(combinations).toEqual([]);
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

  describe("limite de 50 variações por produto", () => {
    const opts = (n) => Array.from({ length: n }, (_, i) => `T${i + 1}`);
    const drafts = (n, persisted = false) =>
      opts(n).map((v, i) => ({
        ...emptyDraftVariant([{ characteristicName: "Tamanho", optionValue: v }]),
        ...(persisted ? { id: i + 1, persisted: true } : {}),
      }));

    it("limite é 50", () => {
      expect(MAX_VARIANTS_PER_PRODUCT).toBe(50);
    });

    it.each([29, 30, 31, 49, 50])("%i opções geram %i variações", (n) => {
      const r = buildCartesianCombinations([{ name: "Tamanho", options: opts(n) }]);
      expect(r.truncated).toBe(false);
      expect(r.combinations).toHaveLength(n);
      expect(new Set(r.combinations.map(combinationKey)).size).toBe(n);
      expect(variantLimitIssue({ truncated: false, drafts: drafts(n) })).toBeNull();
    });

    it("51 opções são bloqueadas", () => {
      const r = buildCartesianCombinations([{ name: "Tamanho", options: opts(51) }]);
      expect(r.truncated).toBe(true);
      expect(r.totalPossible).toBe(51);
      expect(r.combinations).toEqual([]);
      expect(variantLimitIssue(r)).toBe("combinations");
    });

    it("10 × 5 = 50 combinações completas; 10 × 6 bloqueia", () => {
      const ok = buildCartesianCombinations([
        { name: "Cor", options: opts(10) },
        { name: "Tam", options: ["P", "M", "G", "GG", "XG"] },
      ]);
      expect(ok.truncated).toBe(false);
      expect(ok.combinations).toHaveLength(50);
      expect(ok.combinations.every((c) => c.length === 2)).toBe(true);
      const over = buildCartesianCombinations([
        { name: "Cor", options: opts(10) },
        { name: "Tam", options: ["P", "M", "G", "GG", "XG", "XXG"] },
      ]);
      expect(over.truncated).toBe(true);
      expect(over.totalPossible).toBe(60);
    });

    it("50 × 1 inclui todas as características (sem corte intermediário)", () => {
      const r = buildCartesianCombinations([
        { name: "Tamanho", options: opts(50) },
        { name: "Cor", options: ["Azul"] },
      ]);
      expect(r.truncated).toBe(false);
      expect(r.combinations).toHaveLength(50);
      expect(r.combinations.every((c) => c.length === 2)).toBe(true);
    });

    it("acima do limite mantém rascunhos existentes", () => {
      const existing = drafts(3).map((d) => ({ ...d, salePrice: 10 }));
      const out = mergeCombinationPreview(
        [{ name: "Tamanho", options: opts(51) }],
        existing
      );
      expect(out.truncated).toBe(true);
      expect(out.drafts).toBe(existing);
    });

    it("51 selecionadas com variação nova são bloqueadas", () => {
      expect(variantLimitIssue({ drafts: drafts(51) })).toBe("selected");
      const fiftyPlusOneUnselected = [
        ...drafts(50),
        { ...drafts(51)[50], selected: false },
      ];
      expect(variantLimitIssue({ drafts: fiftyPlusOneUnselected })).toBeNull();
    });

    it("produto legado com 51 já salvas segue editável sem variação nova", () => {
      expect(variantLimitIssue({ drafts: drafts(51, true) })).toBeNull();
      const withNew = [...drafts(51, true), emptyDraftVariant([
        { characteristicName: "Tamanho", optionValue: "Novo" },
      ])];
      expect(variantLimitIssue({ drafts: withNew })).toBe("selected");
    });
  });
});
