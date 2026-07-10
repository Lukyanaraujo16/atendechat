import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "aiAgentHandoffRequested", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn("Tickets", "aiAgentHandoffRequestedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "aiAgentHandoffReason", {
      type: DataTypes.STRING(120),
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "aiAgentHandoffBy", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "aiAgentHandoffBy");
    await queryInterface.removeColumn("Tickets", "aiAgentHandoffReason");
    await queryInterface.removeColumn("Tickets", "aiAgentHandoffRequestedAt");
    await queryInterface.removeColumn("Tickets", "aiAgentHandoffRequested");
  }
};
