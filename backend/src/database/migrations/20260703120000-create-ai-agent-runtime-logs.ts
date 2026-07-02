import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiAgentRuntimeLogs", {
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
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Contacts", key: "id" },
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
      aiAgentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "AiAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      channel: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "whatsapp"
      },
      mode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "dry_run"
      },
      eligible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      reason: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      metadata: {
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

    await queryInterface.addIndex("AiAgentRuntimeLogs", ["companyId", "createdAt"], {
      name: "AiAgentRuntimeLogs_companyId_createdAt_idx"
    });
    await queryInterface.addIndex("AiAgentRuntimeLogs", ["ticketId", "createdAt"], {
      name: "AiAgentRuntimeLogs_ticketId_createdAt_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiAgentRuntimeLogs");
  }
};
