import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    let table: Awaited<ReturnType<QueryInterface["describeTable"]>> | null =
      null;
    try {
      table = await queryInterface.describeTable("Appointments");
    } catch {
      // Tabela ainda não existe (create-Appointments corre depois por timestamp).
      return;
    }
    if (table && "color" in table) {
      return;
    }
    return queryInterface.addColumn("Appointments", "color", {
      type: DataTypes.STRING(16),
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface: QueryInterface) => {
    let table: Awaited<ReturnType<QueryInterface["describeTable"]>> | null =
      null;
    try {
      table = await queryInterface.describeTable("Appointments");
    } catch {
      return;
    }
    if (!table || !("color" in table)) {
      return;
    }
    return queryInterface.removeColumn("Appointments", "color");
  }
};
