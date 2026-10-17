import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase 8.4 — dados cadastrais da empresa (razão social, documento, endereço).
 * Migration aditiva e idempotente: todas as colunas são nullable, sem backfill.
 */
const COLUMNS: Array<[string, Record<string, unknown>]> = [
  ["tradeName", { type: DataTypes.STRING, allowNull: true }],
  ["legalName", { type: DataTypes.STRING, allowNull: true }],
  ["document", { type: DataTypes.STRING(14), allowNull: true }],
  ["documentType", { type: DataTypes.STRING(4), allowNull: true }],
  ["addressZipCode", { type: DataTypes.STRING(8), allowNull: true }],
  ["addressStreet", { type: DataTypes.STRING, allowNull: true }],
  ["addressNumber", { type: DataTypes.STRING(20), allowNull: true }],
  ["addressComplement", { type: DataTypes.STRING, allowNull: true }],
  ["addressNeighborhood", { type: DataTypes.STRING, allowNull: true }],
  ["addressCity", { type: DataTypes.STRING, allowNull: true }],
  ["addressState", { type: DataTypes.STRING(2), allowNull: true }]
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Companies");
    for (const [name, def] of COLUMNS) {
      if (!(name in table)) {
        await queryInterface.addColumn("Companies", name, def as any);
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("Companies");
    for (const [name] of [...COLUMNS].reverse()) {
      if (name in table) {
        await queryInterface.removeColumn("Companies", name);
      }
    }
  }
};
