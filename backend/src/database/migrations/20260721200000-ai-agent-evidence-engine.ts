import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentEvidenceReports", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      shadowEvaluationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiAgentShadowEvaluations", key: "id" },
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
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      provider: { type: DataTypes.STRING(32), allowNull: true },
      model: { type: DataTypes.STRING(120), allowNull: true },
      primaryType: { type: DataTypes.STRING(48), allowNull: false },
      verified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      hallucination: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      knowledgeVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      knowledgeUnused: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      emptyResult: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      toolUnused: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      latencyMs: { type: DataTypes.INTEGER, allowNull: true },
      totalTokens: { type: DataTypes.INTEGER, allowNull: true },
      estimatedCostUsd: { type: DataTypes.FLOAT, allowNull: true },
      toolCallCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      loopStopReason: { type: DataTypes.STRING(64), allowNull: true },
      report: { type: DataTypes.JSON, allowNull: false },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AiAgentEvidenceReports",
      ["companyId", "createdAt"],
      { name: "AiAgentEvidenceReports_company_createdAt_idx" }
    );
    await queryInterface.addIndex(
      "AiAgentEvidenceReports",
      ["shadowEvaluationId"],
      {
        name: "AiAgentEvidenceReports_shadowEvaluation_idx",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AiAgentEvidenceReports",
      ["companyId", "primaryType"],
      { name: "AiAgentEvidenceReports_company_primaryType_idx" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgentEvidenceReports");
  }
};
