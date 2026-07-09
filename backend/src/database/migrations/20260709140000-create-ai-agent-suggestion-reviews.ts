import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentSuggestionReviews", {
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
      aiAgentRuntimeLogId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiAgentRuntimeLogs", key: "id" },
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
      rating: {
        type: DataTypes.STRING(16),
        allowNull: false
      },
      tags: {
        type: DataTypes.JSON,
        allowNull: true
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      reviewedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
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

    await queryInterface.addIndex("AiAgentSuggestionReviews", {
      name: "AiAgentSuggestionReviews_company_log_uq",
      unique: true,
      fields: ["companyId", "aiAgentRuntimeLogId"]
    });

    await queryInterface.addIndex("AiAgentSuggestionReviews", {
      name: "AiAgentSuggestionReviews_company_createdAt_idx",
      fields: ["companyId", "createdAt"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgentSuggestionReviews");
  }
};
