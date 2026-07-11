import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentSimulationSessions", {
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
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "active"
      },
      provider: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      model: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      messageCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      totalPromptTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      totalCompletionTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      totalTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      totalLatencyMs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      endedAt: {
        type: DataTypes.DATE,
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

    await queryInterface.addIndex("AiAgentSimulationSessions", {
      name: "AiAgentSimulationSessions_company_agent_createdAt_idx",
      fields: ["companyId", "aiAgentId", "createdAt"]
    });

    await queryInterface.addIndex("AiAgentSimulationSessions", {
      name: "AiAgentSimulationSessions_company_agent_status_idx",
      fields: ["companyId", "aiAgentId", "status"]
    });

    await queryInterface.createTable("AiAgentSimulationMessages", {
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
      sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiAgentSimulationSessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      role: {
        type: DataTypes.STRING(16),
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      provider: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      model: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      promptTokens: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      completionTokens: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      totalTokens: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      latencyMs: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      errorCode: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      handoffSuggested: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      handoffReason: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("AiAgentSimulationMessages", {
      name: "AiAgentSimulationMessages_session_createdAt_idx",
      fields: ["sessionId", "createdAt"]
    });

    await queryInterface.createTable("AiAgentSimulationMessageReviews", {
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
      simulationMessageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AiAgentSimulationMessages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
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

    await queryInterface.addIndex("AiAgentSimulationMessageReviews", {
      name: "AiAgentSimulationMessageReviews_company_message_uq",
      unique: true,
      fields: ["companyId", "simulationMessageId"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgentSimulationMessageReviews");
    await queryInterface.dropTable("AiAgentSimulationMessages");
    await queryInterface.dropTable("AiAgentSimulationSessions");
  }
};
