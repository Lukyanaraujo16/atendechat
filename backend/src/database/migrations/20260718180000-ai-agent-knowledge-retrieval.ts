import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase IA 1.5.2D — vínculo Agente ↔ Bases, settings RAG e logs de retrieval.
 * RAG permanece desligado por padrão (enabled*=false). Sem jobs externos.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentKnowledgeBases", {
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
      knowledgeBaseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiKnowledgeBases", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AiAgentKnowledgeBases",
      ["companyId", "aiAgentId", "knowledgeBaseId"],
      {
        name: "AiAgentKnowledgeBases_company_agent_base_unique",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AiAgentKnowledgeBases",
      ["companyId", "aiAgentId", "enabled"],
      { name: "AiAgentKnowledgeBases_company_agent_enabled_idx" }
    );

    await queryInterface.createTable("AiAgentKnowledgeSettings", {
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
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      enabledInSimulator: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      enabledInShadow: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      enabledInLive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      topK: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 6
      },
      minimumScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.35
      },
      maxContextCharacters: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 6000
      },
      maxContextTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1500
      },
      maxChunksPerDocument: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2
      },
      maxChunksPerBase: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 4
      },
      includeSourcesInInternalMetadata: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      allowAnswerWithoutKnowledge: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      handoffWhenKnowledgeMissing: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      documentTypes: {
        type: DataTypes.JSON,
        allowNull: true
      },
      languages: {
        type: DataTypes.JSON,
        allowNull: true
      },
      retrievalMode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "semantic"
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AiAgentKnowledgeSettings",
      ["companyId", "aiAgentId"],
      {
        name: "AiAgentKnowledgeSettings_company_agent_unique",
        unique: true
      }
    );

    await queryInterface.createTable("AiKnowledgeRetrievals", {
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
      channel: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      messageId: {
        type: DataTypes.STRING(191),
        allowNull: true
      },
      simulationSessionId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      shadowSuggestionId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      requestId: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "skipped"
      },
      queryHash: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      queryPreview: {
        type: DataTypes.STRING(240),
        allowNull: true
      },
      knowledgeBaseIds: {
        type: DataTypes.JSON,
        allowNull: true
      },
      documentTypes: {
        type: DataTypes.JSON,
        allowNull: true
      },
      languages: {
        type: DataTypes.JSON,
        allowNull: true
      },
      topK: { type: DataTypes.INTEGER, allowNull: true },
      minimumScore: { type: DataTypes.FLOAT, allowNull: true },
      candidateCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      returnedChunkCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      returnedDocumentCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      embeddingProvider: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      embeddingModel: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      embeddingDimensions: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      contextCharacters: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      estimatedContextTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      durationMs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      embeddingDurationMs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      searchDurationMs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      skippedReason: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      errorCode: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      errorMessage: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AiKnowledgeRetrievals",
      ["companyId", "aiAgentId", "createdAt"],
      { name: "AiKnowledgeRetrievals_company_agent_created_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeRetrievals",
      ["companyId", "channel", "status"],
      { name: "AiKnowledgeRetrievals_company_channel_status_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeRetrievals",
      ["companyId", "requestId"],
      { name: "AiKnowledgeRetrievals_company_requestId_idx" }
    );

    // Metadata opcional nas mensagens do simulador (resumo de retrieval)
    const dialect = queryInterface.sequelize.getDialect();
    try {
      await queryInterface.addColumn("AiAgentSimulationMessages", "metadata", {
        type: DataTypes.JSON,
        allowNull: true
      });
    } catch (err) {
      // coluna pode já existir em ambientes parcialmente migrados
      if (dialect === "postgres" || dialect === "mysql") {
        // ignore duplicate
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeColumn("AiAgentSimulationMessages", "metadata");
    } catch {
      // ignore
    }
    await queryInterface.dropTable("AiKnowledgeRetrievals");
    await queryInterface.dropTable("AiAgentKnowledgeSettings");
    await queryInterface.dropTable("AiAgentKnowledgeBases");
  }
};
