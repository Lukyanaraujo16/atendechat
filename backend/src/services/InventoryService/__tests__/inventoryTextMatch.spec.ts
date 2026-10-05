import { Op } from "sequelize";
import { inventoryInsensitiveLike } from "../inventoryTextMatch";

describe("inventoryTextMatch", () => {
  it("no Postgres dobra acento com translate, sem extensão e sem migration", () => {
    const clause = inventoryInsensitiveLike("name", "Película", "postgres");
    const dumped = JSON.stringify(clause);
    expect(dumped).toContain("translate");
    expect(clause.logic[Op.like]).toBe("%pelicula%");
    expect(dumped).not.toContain("COLLATE");
    expect(dumped).not.toContain("Película");
  });

  it("no MySQL qualifica a coluna do produto para não colidir com a categoria", () => {
    const clause = inventoryInsensitiveLike(
      "name",
      "capinha",
      "mysql",
      "InventoryProduct"
    );
    const dumped = JSON.stringify(clause);
    expect(dumped).toContain("`InventoryProduct`.`name`");
    expect(dumped).toContain("utf8mb4_unicode_ci");
    expect(clause.logic[Op.like]).toBe("%capinha%");
  });

  it("no MySQL preserva o barcode na comparação parcial", () => {
    const clause = inventoryInsensitiveLike("barcode", "ABC-123", "mysql");
    const dumped = JSON.stringify(clause);
    expect(dumped).toContain("utf8mb4_unicode_ci");
    expect(clause.logic[Op.like]).toBe("%ABC-123%");
    expect(dumped).not.toContain("abc-123");
  });
});
