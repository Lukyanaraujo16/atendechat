import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgents", {
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
        type: DataTypes.STRING(120),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      model: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: "gpt-4o-mini"
      },
      temperature: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.3
      },
      maxTokens: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 512
      },
      systemPrompt: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      fallbackMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      handoffMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      allowAudioInput: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      allowAudioOutput: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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

    await queryInterface.addIndex("AiAgents", ["companyId", "enabled"], {
      name: "AiAgents_companyId_enabled_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgents");
  }
};
