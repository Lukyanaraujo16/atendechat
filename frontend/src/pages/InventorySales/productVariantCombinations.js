/**
 * Helpers locais para combinações comerciais (prévia no formulário).
 * Não persistem nada — só montam a sugestão de variações.
 */

export const MAX_AUTO_VARIANT_COMBINATIONS = 48;

/**
 * @param {Array<{ name: string, options: string[] }>} characteristics
 * @returns {{ combinations: Array<Array<{ characteristicName: string, optionValue: string }>>, truncated: boolean, totalPossible: number }}
 */
export function buildCartesianCombinations(characteristics) {
  const chars = (characteristics || [])
    .map((c) => ({
      name: String(c?.name || "").trim(),
      options: (c?.options || [])
        .map((o) => String(o || "").trim())
        .filter(Boolean),
    }))
    .filter((c) => c.name && c.options.length);

  if (!chars.length) {
    return { combinations: [], truncated: false, totalPossible: 0 };
  }

  let totalPossible = 1;
  for (const c of chars) {
    totalPossible *= c.options.length;
  }

  let acc = [[]];
  for (const char of chars) {
    const next = [];
    for (const prefix of acc) {
      for (const optionValue of char.options) {
        next.push([
          ...prefix,
          { characteristicName: char.name, optionValue },
        ]);
        if (next.length >= MAX_AUTO_VARIANT_COMBINATIONS) {
          return {
            combinations: next,
            truncated: totalPossible > next.length,
            totalPossible,
          };
        }
      }
    }
    acc = next;
  }

  return {
    combinations: acc,
    truncated: false,
    totalPossible,
  };
}

export function combinationKey(options) {
  return (options || [])
    .map(
      (o) =>
        `${String(o.characteristicName || "").trim().toLowerCase()}::${String(
          o.optionValue || ""
        )
          .trim()
          .toLowerCase()}`
    )
    .sort()
    .join("|");
}

export function combinationLabel(options) {
  return (options || [])
    .map((o) => String(o.optionValue || "").trim())
    .filter(Boolean)
    .join(" / ");
}

/**
 * Extrai características a partir das variantes já persistidas.
 */
function variantOptionRows(variant) {
  return (
    variant?.optionLinks ||
    variant?.options ||
    variant?.InventoryProductVariantOptions ||
    []
  );
}

export function characteristicsFromVariants(variants) {
  const byName = new Map();
  for (const variant of variants || []) {
    const opts = variantOptionRows(variant);
    for (const row of opts) {
      const attr = row.attribute || row.InventoryProductAttribute;
      const opt = row.option || row.InventoryProductAttributeOption;
      const name = attr?.name;
      const value = opt?.value;
      if (!name || !value) continue;
      if (!byName.has(name)) {
        byName.set(name, { name, options: [], _seen: new Set() });
      }
      const entry = byName.get(name);
      const key = String(value).toLowerCase();
      if (!entry._seen.has(key)) {
        entry._seen.add(key);
        entry.options.push(String(value));
      }
    }
  }
  return Array.from(byName.values()).map(({ name, options }) => ({
    name,
    options,
  }));
}

export function draftVariantsFromPersisted(variants) {
  return (variants || []).map((variant) => {
    const opts = variantOptionRows(variant);
    const options = opts
      .map((row) => {
        const attr = row.attribute || row.InventoryProductAttribute;
        const opt = row.option || row.InventoryProductAttributeOption;
        if (!attr?.name || !opt?.value) return null;
        return {
          characteristicName: attr.name,
          optionValue: opt.value,
        };
      })
      .filter(Boolean);
    return {
      localKey: combinationKey(options) || `id:${variant.id}`,
      id: variant.id,
      options,
      label: variant.label || combinationLabel(options),
      salePrice:
        variant.salePrice != null && variant.salePrice !== ""
          ? String(variant.salePrice)
          : "",
      costPrice:
        variant.costPrice != null && variant.costPrice !== ""
          ? String(variant.costPrice)
          : "",
      sku: variant.sku || "",
      barcode: variant.barcode || "",
      minStock:
        variant.minStock != null && variant.minStock !== ""
          ? String(variant.minStock)
          : "",
      currentQuantity: "",
      trackStock: variant.trackStock !== false,
      active: variant.active !== false,
      selected: true,
      persisted: true,
      currentQuantityDisplay:
        variant.currentQuantity != null ? String(variant.currentQuantity) : "0",
    };
  });
}

export function emptyDraftVariant(options) {
  return {
    localKey: combinationKey(options),
    id: null,
    options,
    label: combinationLabel(options),
    salePrice: "",
    costPrice: "",
    sku: "",
    barcode: "",
    minStock: "",
    currentQuantity: "",
    trackStock: true,
    active: true,
    selected: true,
    persisted: false,
    currentQuantityDisplay: null,
  };
}

/**
 * Mescla prévia cartesiana com linhas já existentes (preserva ids/preços).
 */
export function mergeCombinationPreview(characteristics, existingDrafts) {
  const { combinations, truncated, totalPossible } =
    buildCartesianCombinations(characteristics);
  const byKey = new Map(
    (existingDrafts || []).map((d) => [d.localKey || combinationKey(d.options), d])
  );
  const next = [];
  const seen = new Set();

  for (const options of combinations) {
    const key = combinationKey(options);
    seen.add(key);
    const prev = byKey.get(key);
    if (prev) {
      next.push({
        ...prev,
        options,
        label: prev.label || combinationLabel(options),
        localKey: key,
        selected: prev.selected !== false,
      });
    } else {
      next.push(emptyDraftVariant(options));
    }
  }

  // Mantém variantes persistidas que saíram do cartesiano (ex.: opção removida).
  for (const draft of existingDrafts || []) {
    const key = draft.localKey || combinationKey(draft.options);
    if (seen.has(key)) continue;
    if (draft.persisted || draft.id) {
      next.push({ ...draft, selected: draft.selected !== false });
    }
  }

  return { drafts: next, truncated, totalPossible };
}
