import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiKnowledgeBases", {
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
      name: {
        type: DataTypes.STRING(160),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    await queryInterface.addIndex("AiKnowledgeBases", ["companyId", "enabled"], {
      name: "AiKnowledgeBases_companyId_enabled_idx"
    });
    await queryInterface.addIndex("AiKnowledgeBases", ["companyId", "deletedAt"], {
      name: "AiKnowledgeBases_companyId_deletedAt_idx"
    });

    await queryInterface.createTable("AiKnowledgeDocuments", {
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
        onDelete: "RESTRICT"
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      documentType: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "general"
      },
      sourceType: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "manual"
      },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "draft"
      },
      language: {
        type: DataTypes.STRING(16),
        allowNull: true,
        defaultValue: "pt-BR"
      },
      contentText: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      contentMarkdown: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      sourceUrl: {
        type: DataTypes.STRING(2048),
        allowNull: true
      },
      fileName: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      mimeType: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      fileSize: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      checksum: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      storagePath: {
        type: DataTypes.STRING(512),
        allowNull: true
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    });

    await queryInterface.addIndex(
      "AiKnowledgeDocuments",
      ["companyId", "knowledgeBaseId"],
      { name: "AiKnowledgeDocuments_companyId_knowledgeBaseId_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocuments",
      ["companyId", "status"],
      { name: "AiKnowledgeDocuments_companyId_status_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocuments",
      ["companyId", "documentType"],
      { name: "AiKnowledgeDocuments_companyId_documentType_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocuments",
      ["companyId", "sourceType"],
      { name: "AiKnowledgeDocuments_companyId_sourceType_idx" }
    );
    await queryInterface.addIndex(
      "AiKnowledgeDocuments",
      ["companyId", "deletedAt"],
      { name: "AiKnowledgeDocuments_companyId_deletedAt_idx" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiKnowledgeDocuments");
    await queryInterface.dropTable("AiKnowledgeBases");
  }
};
