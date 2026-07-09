import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("AiAgentRuntimeLogs", "liveStatus", {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "not_requested"
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "sentMessageId", {
      type: DataTypes.STRING(191),
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "sentAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "sendErrorCode", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "deliveryStatus", {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "not_sent"
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "liveProvider", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "liveModel", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "liveLatencyMs", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "livePromptTokens", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "liveCompletionTokens", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn("AiAgentRuntimeLogs", "liveTotalTokens", {
      type: DataTypes.INTEGER,
      allowNull: true
    });

    await queryInterface.addIndex("AiAgentRuntimeLogs", {
      name: "AiAgentRuntimeLogs_company_liveStatus_createdAt_idx",
      fields: ["companyId", "liveStatus", "createdAt"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "AiAgentRuntimeLogs",
      "AiAgentRuntimeLogs_company_liveStatus_createdAt_idx"
    );
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "liveTotalTokens");
    await queryInterface.removeColumn(
      "AiAgentRuntimeLogs",
      "liveCompletionTokens"
    );
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "livePromptTokens");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "liveLatencyMs");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "liveModel");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "liveProvider");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "deliveryStatus");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "sendErrorCode");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "sentAt");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "sentMessageId");
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "liveStatus");
  }
};
