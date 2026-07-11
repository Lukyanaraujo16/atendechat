import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentProfiles", {
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
      schemaVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      setupMode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "guided"
      },
      companyName: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      businessSegment: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      customBusinessSegment: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      departments: {
        type: DataTypes.JSON,
        allowNull: false
      },
      attendantName: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      attendantRole: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      tone: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      customTone: {
        type: DataTypes.STRING(200),
        allowNull: true
      },
      clientAddressStyle: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      emojiLevel: {
        type: DataTypes.STRING(16),
        allowNull: false
      },
      responseLength: {
        type: DataTypes.STRING(16),
        allowNull: false
      },
      allowedActions: {
        type: DataTypes.JSON,
        allowNull: true
      },
      forbiddenActions: {
        type: DataTypes.JSON,
        allowNull: true
      },
      handoffRules: {
        type: DataTypes.JSON,
        allowNull: true
      },
      companyDescription: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      productsAndServices: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      serviceArea: {
        type: DataTypes.STRING(200),
        allowNull: true
      },
      businessHours: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      pricingPolicy: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      negotiationPolicy: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      schedulingPolicy: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      frequentlyAskedQuestions: {
        type: DataTypes.JSON,
        allowNull: true
      },
      importantInformation: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      customInstructions: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      sourceWebsite: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      generatedPrompt: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      generatedPromptVersion: {
        type: DataTypes.STRING(16),
        allowNull: true
      },
      generatedAt: {
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

    await queryInterface.addIndex("AiAgentProfiles", {
      name: "AiAgentProfiles_company_agent_uq",
      unique: true,
      fields: ["companyId", "aiAgentId"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgentProfiles");
  }
};
