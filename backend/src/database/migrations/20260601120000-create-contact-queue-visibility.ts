import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .createTable("ContactQueueVisibility", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        companyId: {
          type: DataTypes.INTEGER,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        contactId: {
          type: DataTypes.INTEGER,
          references: { model: "Contacts", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          allowNull: false
        },
        queueId: {
          type: DataTypes.INTEGER,
          references: { model: "Queues", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
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
        queryInterface.addIndex("ContactQueueVisibility", {
          fields: ["companyId", "contactId", "queueId"],
          unique: true,
          name: "contact_queue_visibility_company_contact_queue_unique"
        })
      )
      .then(() =>
        queryInterface.addIndex("ContactQueueVisibility", {
          fields: ["companyId", "contactId"],
          name: "contact_queue_visibility_company_contact_idx"
        })
      );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("ContactQueueVisibility");
  }
};
