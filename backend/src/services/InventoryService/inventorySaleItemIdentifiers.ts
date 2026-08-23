import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import InventorySaleItemIdentifier from "../../models/InventorySaleItemIdentifier";

export type NormalizedSaleItemIdentifier = {
  position: number;
  identifier: string;
};

export type PersistedSaleItemIdentifier = {
  companyId: number;
  saleItemId: number;
  position: number;
  identifier: string;
};

const IDENTIFIER_MAX_LEN = 255;

export function isWholeQuantity(quantity: number): boolean {
  if (!Number.isFinite(quantity)) return false;
  return Math.abs(quantity - Math.round(quantity)) < 1e-6;
}

export function parseIdentifiersField(raw: unknown): "omitted" | unknown[] {
  if (raw === undefined) return "omitted";
  if (raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "identifiers deve ser uma lista."
    );
  }
  return raw;
}

function parsePosition(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "position deve ser um inteiro a partir de 1."
    );
  }
  return n;
}

/**
 * Normaliza identificadores de unidade vendida.
 * Não cria linha para string vazia. Só faz trim; preserva :, -, /, espaços internos.
 */
export function parseAndNormalizeIdentifiers(
  raw: unknown[] | "omitted",
  quantity: number
): NormalizedSaleItemIdentifier[] {
  if (raw === "omitted") return [];

  const filled = raw
    .map(entry => {
      if (entry == null || typeof entry !== "object") {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          "Cada identificador deve ter position e identifier."
        );
      }
      const row = entry as { position?: unknown; identifier?: unknown };
      const identifier =
        row.identifier == null ? "" : String(row.identifier).trim();
      if (!identifier) return null;
      if (identifier.length > IDENTIFIER_MAX_LEN) {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          "identifier deve ter no máximo 255 caracteres."
        );
      }
      return {
        position: parsePosition(row.position),
        identifier
      };
    })
    .filter((row): row is NormalizedSaleItemIdentifier => row != null);

  if (filled.length === 0) {
    return [];
  }

  if (!isWholeQuantity(quantity)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Identificadores só podem ser informados quando a quantidade for inteira."
    );
  }

  const maxPosition = Math.round(quantity);
  const seenPositions = new Set<number>();
  const seenIdentifiers = new Set<string>();

  filled.forEach(row => {
    if (row.position > maxPosition) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        `position deve ser no máximo ${maxPosition}.`
      );
    }
    if (seenPositions.has(row.position)) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Não é permitido repetir position no mesmo item."
      );
    }
    seenPositions.add(row.position);

    if (seenIdentifiers.has(row.identifier)) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Identificador duplicado no mesmo item."
      );
    }
    seenIdentifiers.add(row.identifier);
  });

  return filled.sort((a, b) => a.position - b.position);
}

export function assertQuantityReductionAllowsIdentifiers(
  existing: Array<{ position: number }>,
  newQuantity: number
): void {
  const maxPosition = isWholeQuantity(newQuantity)
    ? Math.round(newQuantity)
    : newQuantity;
  const exceeding = existing
    .map(row => row.position)
    .filter(position => position > maxPosition)
    .sort((a, b) => a - b);

  if (exceeding.length > 0) {
    const position = exceeding[0];
    throw new AppError(
      "ERR_INVENTORY_SALE_IDENTIFIER_POSITION_EXCEEDS_QUANTITY",
      400,
      `Remova a identificação da unidade ${position} antes de reduzir a quantidade.`
    );
  }

  if (!isWholeQuantity(newQuantity) && existing.length > 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Identificadores só podem ser informados quando a quantidade for inteira."
    );
  }
}

export function assertIdentifiersForCompleteSale(input: {
  companyId: number;
  items: Array<{ id: number; companyId: number; quantity: string | number }>;
  identifiers: PersistedSaleItemIdentifier[];
}): void {
  const itemsById = new Map(input.items.map(item => [item.id, item]));

  input.identifiers.forEach(row => {
    if (row.companyId !== input.companyId) {
      throw new AppError(
        "ERR_INVENTORY_SALE_IDENTIFIER_COMPANY_MISMATCH",
        403,
        "Identificador não pertence à empresa da venda."
      );
    }
    const item = itemsById.get(row.saleItemId);
    if (!item || item.companyId !== input.companyId) {
      throw new AppError(
        "ERR_INVENTORY_SALE_IDENTIFIER_ITEM_MISMATCH",
        400,
        "Identificador não pertence ao item da venda."
      );
    }
  });

  input.items.forEach(item => {
    if (item.companyId !== input.companyId) {
      throw new AppError(
        "ERR_INVENTORY_SALE_IDENTIFIER_COMPANY_MISMATCH",
        403,
        "Item não pertence à empresa da venda."
      );
    }
    const rows = input.identifiers.filter(row => row.saleItemId === item.id);
    parseAndNormalizeIdentifiers(
      rows.map(row => ({
        position: row.position,
        identifier: row.identifier
      })),
      Number(item.quantity)
    );
  });
}

export async function replaceSaleItemIdentifiers(input: {
  companyId: number;
  saleItemId: number;
  identifiers: NormalizedSaleItemIdentifier[];
  transaction: Transaction;
}): Promise<void> {
  await InventorySaleItemIdentifier.destroy({
    where: { saleItemId: input.saleItemId, companyId: input.companyId },
    transaction: input.transaction
  });

  if (!input.identifiers.length) return;

  await InventorySaleItemIdentifier.bulkCreate(
    input.identifiers.map(row => ({
      companyId: input.companyId,
      saleItemId: input.saleItemId,
      position: row.position,
      identifier: row.identifier
    })),
    { transaction: input.transaction }
  );
}

export function buildInventorySaleItemIdentifierInclude(companyId: number) {
  return {
    model: InventorySaleItemIdentifier,
    as: "identifiers" as const,
    required: false,
    separate: true,
    where: { companyId },
    order: [["position", "ASC"]] as [string, string][]
  };
}
