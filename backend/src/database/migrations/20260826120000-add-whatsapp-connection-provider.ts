import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase 5: provider de transporte por conexão WhatsApp.
 * Distinto de "provider" (stable/beta Baileys legado).
 *
 * Registros existentes recebem default "baileys" (NOT NULL + defaultValue).
 * NÃO executar nesta fase — apenas criar o arquivo.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Whatsapps";
    const column = "connectionProvider";

    const tableInfo = await queryInterface.describeTable(table);
    if (!tableInfo[column]) {
      await queryInterface.addColumn(table, column, {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "baileys"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = "Whatsapps";
    const column = "connectionProvider";
    const tableInfo = await queryInterface.describeTable(table);
    if (tableInfo[column]) {
      await queryInterface.removeColumn(table, column);
    }
  }
};
