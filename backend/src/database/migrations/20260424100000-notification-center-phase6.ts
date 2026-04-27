import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("UserNotifications", "archivedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.changeColumn("UserNotifications", "companyId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Companies", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });

    await queryInterface.addColumn("UserNotificationPreferences", "inAppEnabled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    await queryInterface.addColumn(
      "UserNotificationPreferences",
      "inAppNewTickets",
      {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    );
    await queryInterface.addColumn(
      "UserNotificationPreferences",
      "inAppAssignedTickets",
      {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    );
    await queryInterface.addColumn(
      "UserNotificationPreferences",
      "inAppTicketMessages",
      {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    );
    await queryInterface.addColumn(
      "UserNotificationPreferences",
      "inAppTicketTransfers",
      {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    );
    await queryInterface.addColumn("UserNotificationPreferences", "inAppAgenda", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    await queryInterface.addColumn("UserNotificationPreferences", "inAppBilling", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("UserNotifications", "archivedAt");
    await queryInterface.changeColumn("UserNotifications", "companyId", {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Companies", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
    await queryInterface.removeColumn("UserNotificationPreferences", "inAppEnabled");
    await queryInterface.removeColumn("UserNotificationPreferences", "inAppNewTickets");
    await queryInterface.removeColumn(
      "UserNotificationPreferences",
      "inAppAssignedTickets"
    );
    await queryInterface.removeColumn(
      "UserNotificationPreferences",
      "inAppTicketMessages"
    );
    await queryInterface.removeColumn(
      "UserNotificationPreferences",
      "inAppTicketTransfers"
    );
    await queryInterface.removeColumn("UserNotificationPreferences", "inAppAgenda");
    await queryInterface.removeColumn("UserNotificationPreferences", "inAppBilling");
  }
};
