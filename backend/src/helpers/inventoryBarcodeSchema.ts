import { QueryInterface, QueryTypes } from "sequelize";

export const INVENTORY_BARCODE_INDEX =
  "InventoryProducts_companyId_barcode_key";

export function assertInventoryBarcodeDialect(dialect: string): void {
  if (!["postgres", "mysql", "mariadb"].includes(dialect)) {
    throw new Error(`Barcode: dialeto não suportado: ${dialect}.`);
  }
}

/** Somente leitura. Nunca normaliza ou corrige dados persistidos. */
export async function diagnoseInventoryBarcodes(
  queryInterface: QueryInterface
) {
  const db = queryInterface.sequelize;
  const dialect = db.getDialect();
  assertInventoryBarcodeDialect(dialect);
  const pg = dialect === "postgres";
  const quote = (name: string) => (pg ? `"${name}"` : `\`${name}\``);
  const table = quote("InventoryProducts");
  const company = quote("companyId");
  const barcode = quote("barcode");
  // Expressão binária independe da collation legada para o diagnóstico.
  const identity = pg ? `${barcode} COLLATE "C"` : `BINARY ${barcode}`;
  const select = <T extends object>(sql: string, replacements = {}) =>
    db.query<T>(sql, { type: QueryTypes.SELECT, replacements });

  const [totals] = await select<{ productsWithBarcode: string | number }>(
    `SELECT COUNT(*) AS ${quote(
      "productsWithBarcode"
    )} FROM ${table} WHERE ${barcode} IS NOT NULL`
  );
  const groups = `SELECT ${company}, ${identity} AS ${barcode}, COUNT(*) AS total FROM ${table} WHERE ${barcode} IS NOT NULL GROUP BY ${company}, ${identity} HAVING COUNT(*) > 1`;
  const [duplicates] = await select<{ duplicateGroups: string | number }>(
    `SELECT COUNT(*) AS ${quote(
      "duplicateGroups"
    )} FROM (${groups}) AS barcode_duplicates`
  );
  // Não expõe os códigos no relatório: somente tenant, IDs e contagens.
  const duplicateSamples = await select<{ companyId: number; id: number }>(
    `SELECT p.${company} AS ${company}, p.${quote("id")} AS ${quote(
      "id"
    )} FROM ${table} AS p INNER JOIN (${groups}) AS d ON p.${company} = d.${company} AND ${
      pg
        ? `p.${barcode} COLLATE "C" = d.${barcode}`
        : `BINARY p.${barcode} = d.${barcode}`
    } ORDER BY p.${company}, p.${quote("id")} LIMIT 20`
  );

  let nonNormalizedProducts = 0;
  const nonNormalizedSamples: { companyId: number; id: number }[] = [];
  let lastId: number | undefined;
  // trim() do JS inclui tabs, NBSP etc.; TRIM SQL não tem o mesmo contrato.
  // Paginação evita carregar o catálogo inteiro na memória.
  for (;;) {
    const cursor = lastId === undefined ? "" : `AND ${quote("id")} > :lastId`;
    // eslint-disable-next-line no-await-in-loop
    const rows = await select<{
      id: number;
      companyId: number;
      barcode: string;
    }>(
      `SELECT ${quote(
        "id"
      )}, ${company}, ${barcode} FROM ${table} WHERE ${barcode} IS NOT NULL ${cursor} ORDER BY ${quote(
        "id"
      )} LIMIT 1000`,
      lastId === undefined ? {} : { lastId }
    );
    const invalid = rows.filter(
      row => !row.barcode.trim() || row.barcode !== row.barcode.trim()
    );
    nonNormalizedProducts += invalid.length;
    nonNormalizedSamples.push(
      ...invalid
        .slice(0, 20 - nonNormalizedSamples.length)
        .map(row => ({ companyId: row.companyId, id: row.id }))
    );
    if (rows.length < 1000) break;
    lastId = rows[rows.length - 1].id;
  }

  return {
    productsWithBarcode: Number(totals.productsWithBarcode),
    duplicateGroups: Number(duplicates.duplicateGroups),
    duplicateSamples,
    nonNormalizedProducts,
    nonNormalizedSamples
  };
}

export async function assertInventoryBarcodeSchema(
  queryInterface: QueryInterface
): Promise<void> {
  const dialect = queryInterface.sequelize.getDialect();
  assertInventoryBarcodeDialect(dialect);
  const columns = (await queryInterface.describeTable(
    "InventoryProducts"
  )) as Record<string, { type: string; allowNull: boolean }>;
  if (
    !columns.barcode ||
    !columns.barcode.allowNull ||
    !/^(VARCHAR|CHARACTER VARYING)\(64\)$/i.test(columns.barcode.type) ||
    !columns.companyId ||
    columns.companyId.allowNull
  ) {
    throw new Error(
      "Barcode: esperado barcode VARCHAR(64) nullable e companyId NOT NULL. Revise o esquema manualmente; nenhum dado foi alterado."
    );
  }
  if (dialect !== "postgres") {
    const rows = await queryInterface.sequelize.query<{ collation: string }>(
      "SELECT COLLATION_NAME AS collation FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'InventoryProducts' AND COLUMN_NAME = 'barcode'",
      { type: QueryTypes.SELECT }
    );
    if (rows[0]?.collation !== "utf8mb4_bin") {
      throw new Error(
        "Barcode: MySQL/MariaDB requer barcode COLLATE utf8mb4_bin. A collation existente não será alterada automaticamente; revise o esquema antes de reaplicar."
      );
    }
  }
}
