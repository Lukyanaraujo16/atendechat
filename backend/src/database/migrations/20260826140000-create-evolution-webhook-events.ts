import { QueryInterface, DataTypes } from "sequelize";

/**
 * Idempotência de webhooks Evolution (Fase 6).
 * NÃO executar nesta tarefa — apenas criar o arquivo.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("EvolutionWebhookEvents", {
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
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      eventType: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      externalEventId: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      providerMessageId: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      processingStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "received"
      },
      skipReason: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      errorSummary: {
        type: DataTypes.STRING(512),
        allowNull: true
      },
      apiKeyValid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      processed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      /** Payload sanitizado (sem apikey). */
      rawPayload: {
        type: DataTypes.JSONB,
        allowNull: true
      },
      receivedAt: {
        type: DataTypes.DATE,
        allowNull: false
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
      "EvolutionWebhookEvents",
      ["externalEventId"],
      {
        name: "evolution_webhook_events_external_event_id_unique",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "EvolutionWebhookEvents",
      ["companyId", "whatsappId", "providerMessageId"],
      {
        name: "evolution_webhook_events_company_whatsapp_msgid_idx"
      }
    );
    await queryInterface.addIndex("EvolutionWebhookEvents", ["whatsappId"], {
      name: "evolution_webhook_events_whatsapp_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("EvolutionWebhookEvents");
  }
};
