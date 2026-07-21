import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("AiAgentKnowledgeSettings", "functionCallingLive", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn("Whatsapps", "functionCallingLive", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "functionCallingLive");
    await queryInterface.removeColumn(
      "AiAgentKnowledgeSettings",
      "functionCallingLive"
    );
  }
};
