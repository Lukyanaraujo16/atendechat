import { Op, fn, literal, where as sqlWhere } from "sequelize";
import sequelize from "../../database";

const ACCENTS = "ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ";
const FOLDED = "AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn";

function quoteIdent(name: string, dialect: string) {
  if (dialect === "postgres" || dialect === "cockroachdb") return `"${name}"`;
  if (dialect === "mssql") return `[${name}]`;
  return `\`${name}\``;
}

/**
 * A comparação padrão do projeto é utf8mb4_bin: o LIKE distingue caixa e acento.
 * A coluna não muda. Só a comparação da busca fica insensível.
 * MySQL/MariaDB usam utf8mb4_unicode_ci na expressão.
 * Postgres usa lower + translate, sem a extensão unaccent e sem migration.
 * Igualdade exata de barcode/SKU continua binária e não passa por aqui.
 * qualifier evita coluna ambígua quando a listagem faz JOIN (produto e categoria têm name).
 */
export function inventoryInsensitiveLike(
  column: string,
  search: string,
  dialect?: string,
  qualifier?: string
) {
  const resolvedDialect = dialect || sequelize.getDialect();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
    throw new Error("invalid-search-column");
  }
  if (qualifier && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(qualifier)) {
    throw new Error("invalid-search-column");
  }
  const quoted = qualifier
    ? `${quoteIdent(qualifier, resolvedDialect)}.${quoteIdent(
        column,
        resolvedDialect
      )}`
    : quoteIdent(column, resolvedDialect);
  if (resolvedDialect === "postgres" || resolvedDialect === "cockroachdb") {
    const folded = search
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return sqlWhere(
      fn("translate", fn("lower", literal(quoted)), ACCENTS, FOLDED),
      { [Op.like]: `%${folded}%` }
    );
  }
  return sqlWhere(literal(`${quoted} COLLATE utf8mb4_unicode_ci`), {
    [Op.like]: `%${search}%`
  });
}
