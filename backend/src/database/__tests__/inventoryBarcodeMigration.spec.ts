import { UniqueConstraintError } from "sequelize";
import {
  diagnoseInventoryBarcodes,
  INVENTORY_BARCODE_INDEX
} from "../../helpers/inventoryBarcodeSchema";

// eslint-disable-next-line @typescript-eslint/no-var-requires -- Migration segue CommonJS do CLI.
const migration = require("../migrations/20261005120000-unique-inventory-product-barcode");

function fixture(
  dialect = "postgres",
  rows: object[] = [],
  duplicateGroups = 0
) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("INFORMATION_SCHEMA"))
      return [{ collation: "utf8mb4_bin" }];
    if (sql.includes("productsWithBarcode"))
      return [{ productsWithBarcode: rows.length }];
    if (sql.includes("duplicateGroups")) return [{ duplicateGroups }];
    if (sql.includes("INNER JOIN"))
      return duplicateGroups ? [{ companyId: 7, id: 1 }] : [];
    if (sql.includes("LIMIT 1000")) return rows;
    return [];
  });
  return {
    sequelize: { getDialect: () => dialect, query },
    describeTable: jest.fn().mockResolvedValue({
      barcode: {
        type: dialect === "postgres" ? "CHARACTER VARYING(64)" : "VARCHAR(64)",
        allowNull: true
      },
      companyId: { allowNull: false }
    }),
    addIndex: jest.fn(),
    removeIndex: jest.fn(),
    addColumn: jest.fn(),
    removeColumn: jest.fn(),
    bulkUpdate: jest.fn(),
    bulkDelete: jest.fn()
  };
}

it.each(["postgres", "mysql", "mariadb"])(
  "%s: audita antes de criar um único índice, sem active/SKU nem alteração dos dados",
  async dialect => {
    const qi = fixture(dialect, [{ id: 1, companyId: 7, barcode: "00ÁbC" }]);
    await migration.up(qi);
    if (dialect === "postgres") {
      expect(qi.sequelize.query).toHaveBeenLastCalledWith(
        `CREATE UNIQUE INDEX "${INVENTORY_BARCODE_INDEX}" ON "InventoryProducts" ("companyId", "barcode" COLLATE "C")`
      );
      expect(qi.addIndex).not.toHaveBeenCalled();
    } else {
      expect(qi.addIndex).toHaveBeenCalledWith(
        "InventoryProducts",
        ["companyId", "barcode"],
        { name: INVENTORY_BARCODE_INDEX, unique: true }
      );
      expect(
        qi.sequelize.query.mock.invocationCallOrder.slice(-1)[0]
      ).toBeLessThan(qi.addIndex.mock.invocationCallOrder[0]);
    }
    [qi.addColumn, qi.removeColumn, qi.bulkUpdate, qi.bulkDelete].forEach(
      mock => expect(mock).not.toHaveBeenCalled()
    );
  }
);

it.each(["postgres", "mysql"])(
  "%s: duplicidade bloqueia todo DDL",
  async dialect => {
    const qi = fixture(dialect, [], 1);
    await expect(migration.up(qi)).rejects.toThrow(
      /Corrija os dados manualmente/
    );
    expect(qi.addIndex).not.toHaveBeenCalled();
    expect(
      qi.sequelize.query.mock.calls.every(([sql]) => sql.startsWith("SELECT"))
    ).toBe(true);
  }
);

it.each(["", " ", " ABC", "ABC ", "\tABC", "ABC\u00a0"])(
  "legado não normalizado %p bloqueia sem limpar",
  async barcode => {
    const qi = fixture("postgres", [{ id: 1, companyId: 7, barcode }]);
    await expect(migration.up(qi)).rejects.toThrow(/nonNormalizedProducts":1/);
    expect(
      qi.sequelize.query.mock.calls.every(([sql]) => sql.startsWith("SELECT"))
    ).toBe(true);
  }
);

it("diagnóstico retorna contagens e IDs, não códigos, nem escreve", async () => {
  const qi = fixture("postgres", [{ id: 3, companyId: 7, barcode: " X" }], 1);
  expect(await diagnoseInventoryBarcodes(qi as never)).toEqual({
    productsWithBarcode: 1,
    duplicateGroups: 1,
    duplicateSamples: [{ companyId: 7, id: 1 }],
    nonNormalizedProducts: 1,
    nonNormalizedSamples: [{ companyId: 7, id: 3 }]
  });
  expect(
    qi.sequelize.query.mock.calls.every(([sql]) => sql.startsWith("SELECT"))
  ).toBe(true);
});

it("diagnóstico pagina sem descartar anomalias após os primeiros 1000", async () => {
  const qi = fixture();
  const rows = Array.from({ length: 1000 }, (_, index) => ({
    id: index + 1,
    companyId: 7,
    barcode: String(index)
  }));
  qi.sequelize.query
    .mockResolvedValueOnce([{ productsWithBarcode: 1001 }] as never)
    .mockResolvedValueOnce([{ duplicateGroups: 0 }] as never)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(rows as never)
    .mockResolvedValueOnce([{ id: 1001, companyId: 7, barcode: " " }] as never);
  const report = await diagnoseInventoryBarcodes(qi as never);
  expect(report.nonNormalizedSamples).toEqual([{ id: 1001, companyId: 7 }]);
  expect(qi.sequelize.query).toHaveBeenLastCalledWith(
    expect.stringContaining("lastId"),
    expect.objectContaining({ replacements: { lastId: 1000 } })
  );
});

it("não assume collation MySQL e não a converte silenciosamente", async () => {
  const qi = fixture("mysql");
  qi.sequelize.query.mockResolvedValueOnce([
    { collation: "utf8mb4_unicode_ci" }
  ] as never);
  await expect(migration.up(qi)).rejects.toThrow(/utf8mb4_bin/);
  expect(qi.addIndex).not.toHaveBeenCalled();
});

it("rejeita esquema sem coluna, tenant nullable e dialeto não suportado", async () => {
  // eslint-disable-next-line no-restricted-syntax -- Casos sequenciais de migration.
  for (const columns of [
    {},
    {
      barcode: { type: "VARCHAR(64)", allowNull: true },
      companyId: { allowNull: true }
    }
  ]) {
    const qi = fixture();
    qi.describeTable.mockResolvedValue(columns);
    // eslint-disable-next-line no-await-in-loop
    await expect(migration.up(qi)).rejects.toThrow(/Revise o esquema/);
    expect(qi.sequelize.query).not.toHaveBeenCalled();
  }
  await expect(migration.up(fixture("sqlite"))).rejects.toThrow(
    /não suportado/
  );
});

it("falha clara se um duplicado aparece depois do diagnóstico", async () => {
  const qi = fixture("mysql");
  qi.addIndex.mockRejectedValue(new UniqueConstraintError({}));
  await expect(migration.up(qi)).rejects.toThrow(
    /possível gravação concorrente/
  );
});

it("não engole erros de DDL e down remove apenas o índice desta fase", async () => {
  const qi = fixture("mysql");
  const error = new Error("permission denied");
  qi.addIndex.mockRejectedValue(error);
  await expect(migration.up(qi)).rejects.toBe(error);
  await migration.down(qi);
  expect(qi.removeIndex).toHaveBeenCalledTimes(1);
  expect(qi.removeIndex).toHaveBeenCalledWith(
    "InventoryProducts",
    INVENTORY_BARCODE_INDEX
  );
  expect(qi.removeColumn).not.toHaveBeenCalled();
});

it.each([-1, 0])("preflight não ignora IDs legados %p", async id => {
  const qi = fixture("postgres", [{ id, companyId: 7, barcode: " X" }]);
  await expect(migration.up(qi)).rejects.toThrow(/nonNormalizedProducts":1/);
  const scan = qi.sequelize.query.mock.calls.find(([sql]) =>
    sql.includes("LIMIT 1000")
  );
  expect(scan[0]).not.toContain("> :lastId");
});
