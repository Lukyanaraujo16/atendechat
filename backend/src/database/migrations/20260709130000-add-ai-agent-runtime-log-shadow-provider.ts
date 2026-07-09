import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("AiAgentRuntimeLogs", "shadowProvider", {
      type: DataTypes.STRING(32),
      allowNull: true
    });

    await queryInterface.addIndex("AiAgentRuntimeLogs", {
      name: "AiAgentRuntimeLogs_company_shadowProvider_createdAt_idx",
      fields: ["companyId", "shadowProvider", "createdAt"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "AiAgentRuntimeLogs",
      "AiAgentRuntimeLogs_company_shadowProvider_createdAt_idx"
    );
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "shadowProvider");
  }
};
