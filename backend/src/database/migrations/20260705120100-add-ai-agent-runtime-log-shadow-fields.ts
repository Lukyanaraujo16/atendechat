import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("AiAgentRuntimeLogs", "shadowStatus", {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "not_requested"
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "suggestedReply", {
      type: DataTypes.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "shadowModel", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "promptTokens", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "completionTokens", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "totalTokens", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "latencyMs", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "errorCode", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "generatedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "contextMessageCount", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "contextHash", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "suggestionSource", {
      type: DataTypes.STRING(32),
      allowNull: true
    });

    await queryInterface.addIndex(
      "AiAgentRuntimeLogs",
      ["companyId", "shadowStatus", "createdAt"],
      { name: "AiAgentRuntimeLogs_company_shadowStatus_createdAt_idx" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "AiAgentRuntimeLogs",
      "AiAgentRuntimeLogs_company_shadowStatus_createdAt_idx"
    );
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "suggestionSource");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "contextHash");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "contextMessageCount");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "generatedAt");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "errorCode");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "latencyMs");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "totalTokens");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "completionTokens");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "promptTokens");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "shadowModel");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "suggestedReply");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "shadowStatus");
  }
};
