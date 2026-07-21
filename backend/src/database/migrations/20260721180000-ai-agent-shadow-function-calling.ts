import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentShadowEvaluations", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      aiAgentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "AiAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      runtimeLogId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiAgentRuntimeLogs", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      messageId: { type: DataTypes.STRING(128), allowNull: true },
      contactId: { type: DataTypes.INTEGER, allowNull: true },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "queued"
      },
      provider: { type: DataTypes.STRING(32), allowNull: true },
      model: { type: DataTypes.STRING(120), allowNull: true },
      officialReply: { type: DataTypes.TEXT, allowNull: true },
      shadowReply: { type: DataTypes.TEXT, allowNull: true },
      systemPrompt: { type: DataTypes.TEXT, allowNull: true },
      promptTokens: { type: DataTypes.INTEGER, allowNull: true },
      completionTokens: { type: DataTypes.INTEGER, allowNull: true },
      totalTokens: { type: DataTypes.INTEGER, allowNull: true },
      latencyMs: { type: DataTypes.INTEGER, allowNull: true },
      providerLatencyMs: { type: DataTypes.INTEGER, allowNull: true },
      toolLatencyMs: { type: DataTypes.INTEGER, allowNull: true },
      estimatedCostUsd: { type: DataTypes.FLOAT, allowNull: true },
      toolCallCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      loopCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      usedTools: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      usedKnowledge: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      errorCode: { type: DataTypes.STRING(64), allowNull: true },
      loopStopReason: { type: DataTypes.STRING(64), allowNull: true },
      trace: { type: DataTypes.JSON, allowNull: true },
      comparison: { type: DataTypes.JSON, allowNull: true },
      toolAnalytics: { type: DataTypes.JSON, allowNull: true },
      knowledgeMeta: { type: DataTypes.JSON, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex("AiAgentShadowEvaluations", ["companyId", "createdAt"], {
      name: "AiAgentShadowEvaluations_company_createdAt_idx"
    });
    await queryInterface.addIndex("AiAgentShadowEvaluations", ["runtimeLogId"], {
      name: "AiAgentShadowEvaluations_runtimeLog_idx"
    });
    await queryInterface.addIndex("AiAgentShadowEvaluations", ["companyId", "status"], {
      name: "AiAgentShadowEvaluations_company_status_idx"
    });

    await queryInterface.addColumn("AiAgentKnowledgeSettings", "functionCallingShadow", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("Whatsapps", "functionCallingShadow", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "functionCallingShadow");
    await queryInterface.removeColumn(
      "AiAgentKnowledgeSettings",
      "functionCallingShadow"
    );
    await queryInterface.dropTable("AiAgentShadowEvaluations");
  }
};
