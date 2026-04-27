import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("UserNotificationPreferences", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        pushEnabled: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        notifyNewTickets: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        notifyAssignedTickets: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        notifyTicketMessages: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        notifyTicketTransfers: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
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
    await queryInterface.addIndex("UserNotificationPreferences", {
      fields: ["userId", "companyId"],
      unique: true,
      name: "UserNotificationPreferences_user_company_unique"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("UserNotificationPreferences");
  }
};
