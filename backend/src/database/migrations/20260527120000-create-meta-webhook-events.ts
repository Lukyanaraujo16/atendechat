import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .createTable("MetaWebhookEvents", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        instagramAccountId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "InstagramAccounts", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        },
        object: {
          type: DataTypes.STRING(64),
          allowNull: false
        },
        eventType: {
          type: DataTypes.STRING(64),
          allowNull: true
        },
        externalEventId: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        rawPayload: {
          type: DataTypes.JSONB,
          allowNull: true
        },
        signatureValid: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        processed: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
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
      })
      .then(() =>
        queryInterface.addIndex("MetaWebhookEvents", ["externalEventId"], {
          name: "meta_webhook_events_external_event_id_unique",
          unique: true
        })
      )
      .then(() =>
        queryInterface.addIndex("MetaWebhookEvents", ["instagramAccountId"], {
          name: "meta_webhook_events_instagram_account_idx"
        })
      )
      .then(() =>
        queryInterface.addIndex("MetaWebhookEvents", ["companyId"], {
          name: "meta_webhook_events_company_idx"
        })
      );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("MetaWebhookEvents");
  }
};
