import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .createTable("InstagramAccounts", {
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
          type: DataTypes.STRING,
          allowNull: false
        },
        status: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: "PENDING"
        },
        instagramBusinessAccountId: {
          type: DataTypes.STRING,
          allowNull: true
        },
        facebookPageId: {
          type: DataTypes.STRING,
          allowNull: true
        },
        pageAccessToken: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        tokenExpiresAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        scopes: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        profilePicUrl: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        isDefault: {
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
      })
      .then(() =>
        queryInterface.addIndex("InstagramAccounts", ["companyId"], {
          name: "instagram_accounts_company_idx"
        })
      )
      .then(() =>
        queryInterface.createTable("InstagramAccountQueues", {
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
          instagramAccountId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "InstagramAccounts", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          queueId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Queues", key: "id" },
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
        })
      )
      .then(() =>
        queryInterface.addConstraint(
          "InstagramAccountQueues",
          ["companyId", "instagramAccountId", "queueId"],
          {
            type: "unique",
            name: "instagram_account_queues_company_account_queue_unique"
          }
        )
      )
      .then(() =>
        queryInterface.addColumn("Tickets", "channel", {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: "whatsapp"
        })
      )
      .then(() =>
        queryInterface.sequelize.query(
          `UPDATE "Tickets" SET channel = 'whatsapp' WHERE channel IS NULL`
        )
      )
      .then(() =>
        queryInterface.addColumn("Tickets", "instagramAccountId", {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: "InstagramAccounts", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL"
        })
      )
      .then(() =>
        queryInterface.addColumn("Contacts", "channel", {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: "whatsapp"
        })
      )
      .then(() =>
        queryInterface.sequelize.query(
          `UPDATE "Contacts" SET channel = 'whatsapp' WHERE channel IS NULL`
        )
      )
      .then(() =>
        queryInterface.addColumn("Contacts", "instagramScopedId", {
          type: DataTypes.STRING,
          allowNull: true
        })
      );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface
      .removeColumn("Contacts", "instagramScopedId")
      .then(() => queryInterface.removeColumn("Contacts", "channel"))
      .then(() => queryInterface.removeColumn("Tickets", "instagramAccountId"))
      .then(() => queryInterface.removeColumn("Tickets", "channel"))
      .then(() => queryInterface.dropTable("InstagramAccountQueues"))
      .then(() => queryInterface.dropTable("InstagramAccounts"));
  }
};
