import { QueryInterface, DataTypes } from "sequelize";

export async function tableExists(
  queryInterface: QueryInterface,
  tableName: string
): Promise<boolean> {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

export async function columnExists(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string
): Promise<boolean> {
  if (!(await tableExists(queryInterface, tableName))) {
    return false;
  }
  const table = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(table, columnName);
}

export async function addColumnIfMissing(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string,
  attributes: Parameters<QueryInterface["addColumn"]>[2]
): Promise<void> {
  if (!(await tableExists(queryInterface, tableName))) {
    return;
  }
  if (await columnExists(queryInterface, tableName, columnName)) {
    return;
  }
  await queryInterface.addColumn(tableName, columnName, attributes);
}

export async function removeColumnIfExists(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string
): Promise<void> {
  if (!(await columnExists(queryInterface, tableName, columnName))) {
    return;
  }
  await queryInterface.removeColumn(tableName, columnName);
}

export function jsonColumnType(queryInterface: QueryInterface) {
  const dialect = queryInterface.sequelize.getDialect();
  return dialect === "postgres" || dialect === "cockroachdb"
    ? DataTypes.JSONB
    : DataTypes.JSON;
}
