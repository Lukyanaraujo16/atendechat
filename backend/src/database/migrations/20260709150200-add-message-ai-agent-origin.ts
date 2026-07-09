import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Messages", "messageOrigin", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await queryInterface.addColumn("Messages", "aiAgentId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "AiAgents", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
    await queryInterface.addColumn("Messages", "aiAgentRuntimeLogId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "AiAgentRuntimeLogs", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Messages", "aiAgentRuntimeLogId");
    await queryInterface.removeColumn("Messages", "aiAgentId");
    await queryInterface.removeColumn("Messages", "messageOrigin");
  }
};
