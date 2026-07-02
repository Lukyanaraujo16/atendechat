import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Whatsapps", "aiAgentId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "AiAgents", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.addColumn("Whatsapps", "aiAgentEnabled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "aiAgentEnabled");
    await queryInterface.removeColumn("Whatsapps", "aiAgentId");
  }
};
