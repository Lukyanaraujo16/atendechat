import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();

    // Preparação pgvector (não falha a migration se a extensão não existir).
    let pgvectorReady = false;
    if (dialect === "postgres") {
      try {
        await queryInterface.sequelize.query(
          'CREATE EXTENSION IF NOT EXISTS "vector"'
        );
        pgvectorReady = true;
      } catch {
        pgvectorReady = false;
      }
    }

    await queryInterface.createTable("AiKnowledgeEmbeddingSettings", {
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
      credentialId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "AiProviderCredentials", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      provider: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "openai"
      },
      model: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: "text-embedding-3-small"
      },
      dimensions: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1536
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      chunkSize: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 800
      },
      chunkOverlap: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 120
      },
      minChunkSize: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 40
      },
      batchSize: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 16
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
      "AiKnowledgeEmbeddingSettings",
      ["companyId"],
      {
        unique: true,
        name: "AiKnowledgeEmbeddingSettings_companyId_unique"
      }
    );

    await queryInterface.createTable("AiKnowledgeDocumentIndexings", {
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
      knowledgeDocumentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiKnowledgeDocuments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "queued"
      },
      attempt: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      indexVersion: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      chunkingVersion: {
        type: DataTypes.STRING(40),
        allowNull: false
      },
      embeddingProvider: {
        type: DataTypes.STRING(40),
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
      sourceChecksum: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      contentHash: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      configurationHash: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      chunksGenerated: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      chunksEmbedded: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      charactersProcessed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      tokensEstimated: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
      durationMs: { type: DataTypes.INTEGER, allowNull: true },
      errorCode: { type: DataTypes.STRING(80), allowNull: true },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      logs: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AiKnowledgeDocumentIndexings",
      ["companyId", "knowledgeDocumentId"],
      { name: "AiKnowledgeDocumentIndexings_company_document_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocumentIndexings",
      ["companyId", "status"],
      { name: "AiKnowledgeDocumentIndexings_company_status_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocumentIndexings",
      ["companyId", "knowledgeDocumentId", "isActive"],
      { name: "AiKnowledgeDocumentIndexings_company_document_active_idx" }
    );

    await queryInterface.createTable("AiKnowledgeDocumentChunks", {
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
      knowledgeDocumentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiKnowledgeDocuments", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      indexingId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiKnowledgeDocumentIndexings", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      chunkIndex: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      chunkHash: {
        type: DataTypes.STRING(128),
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      characterStart: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      characterEnd: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      tokenCount: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      tokenCountEstimated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      documentType: {
        type: DataTypes.STRING(40),
        allowNull: true
      },
      language: {
        type: DataTypes.STRING(16),
        allowNull: true
      },
      sourceType: {
        type: DataTypes.STRING(40),
        allowNull: true
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      sectionTitle: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      },
      embeddingProvider: {
        type: DataTypes.STRING(40),
        allowNull: false
      },
      embeddingModel: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      embeddingDimensions: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      embeddingVersion: {
        type: DataTypes.STRING(80),
        allowNull: false
      },
      /** float32 LE serializado — armazenamento portátil (bytea_cosine). */
      embedding: {
        type: DataTypes.BLOB,
        allowNull: true
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    });

    await queryInterface.addIndex(
      "AiKnowledgeDocumentChunks",
      ["companyId", "knowledgeBaseId", "enabled"],
      { name: "AiKnowledgeDocumentChunks_company_base_enabled_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocumentChunks",
      ["companyId", "knowledgeDocumentId"],
      { name: "AiKnowledgeDocumentChunks_company_document_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocumentChunks",
      ["companyId", "indexingId"],
      { name: "AiKnowledgeDocumentChunks_company_indexing_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocumentChunks",
      [
        "companyId",
        "embeddingProvider",
        "embeddingModel",
        "embeddingDimensions",
        "enabled"
      ],
      { name: "AiKnowledgeDocumentChunks_company_embed_compat_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocumentChunks",
      ["indexingId", "chunkIndex"],
      {
        unique: true,
        name: "AiKnowledgeDocumentChunks_indexing_chunkIndex_unique"
      }
    );

    // Colunas pgvector por dimensão (768 / 1536 / 3072). Não usar vector(N) único.
    if (pgvectorReady && dialect === "postgres") {
      try {
        await queryInterface.sequelize.query(`
          ALTER TABLE "AiKnowledgeDocumentChunks"
          ADD COLUMN IF NOT EXISTS "embeddingVector768" vector(768)
        `);
        await queryInterface.sequelize.query(`
          ALTER TABLE "AiKnowledgeDocumentChunks"
          ADD COLUMN IF NOT EXISTS "embeddingVector1536" vector(1536)
        `);
        await queryInterface.sequelize.query(`
          ALTER TABLE "AiKnowledgeDocumentChunks"
          ADD COLUMN IF NOT EXISTS "embeddingVector3072" vector(3072)
        `);
      } catch {
        // extensão/permissões — BYTEA permanece o path portátil
      }
    }

    // Campos de indexação no documento
    await queryInterface.addColumn("AiKnowledgeDocuments", "lastIndexedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "lastIndexingError",
      { type: DataTypes.TEXT, allowNull: true }
    );
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "lastIndexedChecksum",
      { type: DataTypes.STRING(128), allowNull: true }
    );
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "lastIndexingDurationMs",
      { type: DataTypes.INTEGER, allowNull: true }
    );
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "lastEmbeddingProvider",
      { type: DataTypes.STRING(40), allowNull: true }
    );
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "lastEmbeddingModel",
      { type: DataTypes.STRING(120), allowNull: true }
    );
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "lastEmbeddingDimensions",
      { type: DataTypes.INTEGER, allowNull: true }
    );
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "lastChunkingVersion",
      { type: DataTypes.STRING(40), allowNull: true }
    );
    await queryInterface.addColumn("AiKnowledgeDocuments", "chunkCount", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "activeIndexingId",
      {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    );

    await queryInterface.addIndex(
      "AiKnowledgeDocuments",
      ["companyId", "indexStatus"],
      { name: "AiKnowledgeDocuments_companyId_indexStatus_idx" }
    );

    // Documentos já processados ficam pending de indexação (não indexar na migration).
    await queryInterface.sequelize.query(`
      UPDATE "AiKnowledgeDocuments"
      SET "indexStatus" = 'pending'
      WHERE "indexStatus" IS NULL OR "indexStatus" = 'pending'
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "AiKnowledgeDocuments",
      "AiKnowledgeDocuments_companyId_indexStatus_idx"
    );
    await queryInterface.removeColumn("AiKnowledgeDocuments", "activeIndexingId");
    await queryInterface.removeColumn("AiKnowledgeDocuments", "chunkCount");
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "lastChunkingVersion"
    );
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "lastEmbeddingDimensions"
    );
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "lastEmbeddingModel"
    );
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "lastEmbeddingProvider"
    );
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "lastIndexingDurationMs"
    );
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "lastIndexedChecksum"
    );
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "lastIndexingError"
    );
    await queryInterface.removeColumn("AiKnowledgeDocuments", "lastIndexedAt");

    await queryInterface.dropTable("AiKnowledgeDocumentChunks");
    await queryInterface.dropTable("AiKnowledgeDocumentIndexings");
    await queryInterface.dropTable("AiKnowledgeEmbeddingSettings");
  }
};
