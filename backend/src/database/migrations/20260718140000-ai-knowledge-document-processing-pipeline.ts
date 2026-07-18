import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("AiKnowledgeDocuments", "uploadStatus", {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "pending"
    });
    await queryInterface.addColumn("AiKnowledgeDocuments", "processingStatus", {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "pending"
    });
    await queryInterface.addColumn("AiKnowledgeDocuments", "indexStatus", {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "pending"
    });
    await queryInterface.addColumn("AiKnowledgeDocuments", "lastProcessedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("AiKnowledgeDocuments", "lastProcessor", {
      type: DataTypes.STRING(40),
      allowNull: true
    });
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "lastProcessingError",
      {
        type: DataTypes.TEXT,
        allowNull: true
      }
    );
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "lastProcessedChecksum",
      {
        type: DataTypes.STRING(128),
        allowNull: true
      }
    );
    await queryInterface.addColumn(
      "AiKnowledgeDocuments",
      "lastProcessingDurationMs",
      {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    );

    await queryInterface.addIndex(
      "AiKnowledgeDocuments",
      ["companyId", "processingStatus"],
      { name: "AiKnowledgeDocuments_companyId_processingStatus_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocuments",
      ["companyId", "uploadStatus"],
      { name: "AiKnowledgeDocuments_companyId_uploadStatus_idx" }
    );

    // Backfill: uploads já armazenados
    await queryInterface.sequelize.query(`
      UPDATE "AiKnowledgeDocuments"
      SET "uploadStatus" = 'uploaded'
      WHERE "sourceType" = 'upload' AND "storagePath" IS NOT NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE "AiKnowledgeDocuments"
      SET "processingStatus" = 'completed',
          "lastProcessedAt" = "updatedAt"
      WHERE "sourceType" = 'manual'
        AND (
          ("contentText" IS NOT NULL AND LENGTH("contentText") > 0)
          OR ("contentMarkdown" IS NOT NULL AND LENGTH("contentMarkdown") > 0)
        )
    `);

    await queryInterface.createTable("AiKnowledgeDocumentProcessing", {
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
      processor: {
        type: DataTypes.STRING(40),
        allowNull: false
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
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      finishedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      durationMs: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      logs: {
        type: DataTypes.JSON,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex(
      "AiKnowledgeDocumentProcessing",
      ["companyId", "knowledgeDocumentId"],
      { name: "AiKnowledgeDocumentProcessing_companyId_documentId_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocumentProcessing",
      ["companyId", "status"],
      { name: "AiKnowledgeDocumentProcessing_companyId_status_idx" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiKnowledgeDocumentProcessing");
    await queryInterface.removeIndex(
      "AiKnowledgeDocuments",
      "AiKnowledgeDocuments_companyId_processingStatus_idx"
    );
    await queryInterface.removeIndex(
      "AiKnowledgeDocuments",
      "AiKnowledgeDocuments_companyId_uploadStatus_idx"
    );
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "lastProcessingDurationMs"
    );
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "lastProcessedChecksum"
    );
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "lastProcessingError"
    );
    await queryInterface.removeColumn("AiKnowledgeDocuments", "lastProcessor");
    await queryInterface.removeColumn("AiKnowledgeDocuments", "lastProcessedAt");
    await queryInterface.removeColumn("AiKnowledgeDocuments", "indexStatus");
    await queryInterface.removeColumn(
      "AiKnowledgeDocuments",
      "processingStatus"
    );
    await queryInterface.removeColumn("AiKnowledgeDocuments", "uploadStatus");
  }
};
