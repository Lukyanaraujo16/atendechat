import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase IA 1.5.3 — Analytics, gaps, sugestões assistidas e replay.
 * Não ativa RAG, não cria documentos, não altera agentes existentes.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentAnalyticsDailies", {
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
        allowNull: false,
        references: { model: "AiAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      day: { type: DataTypes.DATEONLY, allowNull: false },
      totalInteractions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      simulatorExecutions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      shadowSuggestions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      liveResponses: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      knowledgeRetrievals: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      knowledgeHits: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      knowledgeMisses: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      handoffs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      clarificationRequests: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      failures: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sumResponseTimeMs: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      countResponseTime: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sumRetrievalTimeMs: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      countRetrievalTime: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sumEmbeddingTimeMs: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      countEmbeddingTime: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sumGenerationTimeMs: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      countGenerationTime: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sumKnowledgeScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      countKnowledgeScore: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sumChunks: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sumContextTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      estimatedTokensInput: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      estimatedTokensOutput: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0
      },
      providerUsage: { type: DataTypes.JSON, allowNull: true },
      modelUsage: { type: DataTypes.JSON, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AiAgentAnalyticsDailies",
      ["companyId", "aiAgentId", "day"],
      {
        name: "AiAgentAnalyticsDailies_company_agent_day_uq",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AiAgentAnalyticsDailies",
      ["companyId", "day"],
      { name: "AiAgentAnalyticsDailies_company_day_idx" }
    );

    await queryInterface.createTable("AiKnowledgeDocumentStats", {
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
      knowledgeBaseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiKnowledgeBases", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      documentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiKnowledgeDocuments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      retrievalCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      top1Count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sumScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      sumRank: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      scoreSamples: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      sumChunksReturned: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      retrievalFailures: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lastRetrievedAt: { type: DataTypes.DATE, allowNull: true },
      lastUsedByAgentId: { type: DataTypes.INTEGER, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AiKnowledgeDocumentStats",
      ["companyId", "documentId"],
      {
        name: "AiKnowledgeDocumentStats_company_document_uq",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocumentStats",
      ["companyId", "knowledgeBaseId"],
      { name: "AiKnowledgeDocumentStats_company_base_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocumentStats",
      ["companyId", "retrievalCount"],
      { name: "AiKnowledgeDocumentStats_company_retrievalCount_idx" }
    );

    await queryInterface.createTable("AiKnowledgeGaps", {
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
        allowNull: false,
        references: { model: "AiAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      ticketId: { type: DataTypes.INTEGER, allowNull: true },
      simulationId: { type: DataTypes.INTEGER, allowNull: true },
      channel: { type: DataTypes.STRING(32), allowNull: false },
      questionPreview: { type: DataTypes.STRING(240), allowNull: false },
      questionHash: { type: DataTypes.STRING(64), allowNull: false },
      knowledgeStatus: { type: DataTypes.STRING(32), allowNull: false },
      reason: { type: DataTypes.STRING(64), allowNull: false },
      frequency: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      firstSeenAt: { type: DataTypes.DATE, allowNull: false },
      lastSeenAt: { type: DataTypes.DATE, allowNull: false },
      resolved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      resolutionStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "open"
      },
      resolvedDocumentId: { type: DataTypes.INTEGER, allowNull: true },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
      resolvedBy: { type: DataTypes.INTEGER, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AiKnowledgeGaps",
      ["companyId", "aiAgentId", "questionHash", "reason"],
      {
        name: "AiKnowledgeGaps_company_agent_hash_reason_uq",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AiKnowledgeGaps",
      ["companyId", "frequency"],
      { name: "AiKnowledgeGaps_company_frequency_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeGaps",
      ["companyId", "resolved", "lastSeenAt"],
      { name: "AiKnowledgeGaps_company_resolved_lastSeen_idx" }
    );

    await queryInterface.createTable("AiKnowledgeSuggestions", {
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
      ticketId: { type: DataTypes.INTEGER, allowNull: true },
      runtimeLogId: { type: DataTypes.INTEGER, allowNull: true },
      knowledgeGapId: { type: DataTypes.INTEGER, allowNull: true },
      origin: { type: DataTypes.STRING(32), allowNull: false },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "pending"
      },
      questionPreview: { type: DataTypes.STRING(240), allowNull: true },
      aiReplyPreview: { type: DataTypes.TEXT, allowNull: true },
      humanReplyPreview: { type: DataTypes.TEXT, allowNull: true },
      differenceSummary: { type: DataTypes.TEXT, allowNull: true },
      reason: { type: DataTypes.STRING(120), allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      reviewedBy: { type: DataTypes.INTEGER, allowNull: true },
      reviewedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AiKnowledgeSuggestions",
      ["companyId", "status", "createdAt"],
      { name: "AiKnowledgeSuggestions_company_status_created_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeSuggestions",
      ["companyId", "aiAgentId"],
      { name: "AiKnowledgeSuggestions_company_agent_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeSuggestions",
      ["companyId", "origin"],
      { name: "AiKnowledgeSuggestions_company_origin_idx" }
    );

    await queryInterface.createTable("AiAgentExecutionReplays", {
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
        allowNull: false,
        references: { model: "AiAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      channel: { type: DataTypes.STRING(32), allowNull: false },
      ticketId: { type: DataTypes.INTEGER, allowNull: true },
      messageId: { type: DataTypes.STRING(191), allowNull: true },
      runtimeLogId: { type: DataTypes.INTEGER, allowNull: true },
      retrievalId: { type: DataTypes.INTEGER, allowNull: true },
      simulationSessionId: { type: DataTypes.INTEGER, allowNull: true },
      requestId: { type: DataTypes.STRING(64), allowNull: true },
      decision: { type: DataTypes.STRING(64), allowNull: true },
      handoff: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      provider: { type: DataTypes.STRING(32), allowNull: true },
      model: { type: DataTypes.STRING(120), allowNull: true },
      latencyMs: { type: DataTypes.INTEGER, allowNull: true },
      messagePreview: { type: DataTypes.STRING(240), allowNull: true },
      responsePreview: { type: DataTypes.STRING(500), allowNull: true },
      snapshot: { type: DataTypes.JSON, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AiAgentExecutionReplays",
      ["companyId", "aiAgentId", "createdAt"],
      { name: "AiAgentExecutionReplays_company_agent_created_idx" }
    );
    await queryInterface.addIndex(
      "AiAgentExecutionReplays",
      ["companyId", "channel", "createdAt"],
      { name: "AiAgentExecutionReplays_company_channel_created_idx" }
    );
    await queryInterface.addIndex(
      "AiAgentExecutionReplays",
      ["companyId", "requestId"],
      { name: "AiAgentExecutionReplays_company_requestId_idx" }
    );
    await queryInterface.addIndex(
      "AiAgentExecutionReplays",
      ["companyId", "retrievalId"],
      { name: "AiAgentExecutionReplays_company_retrievalId_idx" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgentExecutionReplays");
    await queryInterface.dropTable("AiKnowledgeSuggestions");
    await queryInterface.dropTable("AiKnowledgeGaps");
    await queryInterface.dropTable("AiKnowledgeDocumentStats");
    await queryInterface.dropTable("AiAgentAnalyticsDailies");
  }
};
