import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Whatsapps";
    const column = "aiAgentMode";

    const tableInfo = await queryInterface.describeTable(table);
    if (!tableInfo[column]) {
      await queryInterface.addColumn(table, column, {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "disabled"
      });
    }

    // PostgreSQL: identificadores sem aspas viram minúsculas; a tabela é "Whatsapps".
    await queryInterface.sequelize.query(`
      UPDATE "Whatsapps"
      SET "aiAgentMode" = 'dry_run'
      WHERE "aiAgentEnabled" = true AND "aiAgentId" IS NOT NULL
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "aiAgentMode");
  }
};
