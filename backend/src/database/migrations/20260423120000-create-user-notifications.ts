import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("UserNotifications", {
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
      type: {
        type: DataTypes.STRING(128),
        allowNull: false
      },
      title: {
        type: DataTypes.STRING(512),
        allowNull: false
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      data: {
        type: DataTypes.JSON,
        allowNull: true
      },
      read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      readAt: {
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

    await queryInterface.addIndex("UserNotifications", ["userId", "read"], {
      name: "UserNotifications_userId_read"
    });
    await queryInterface.addIndex("UserNotifications", ["companyId"], {
      name: "UserNotifications_companyId"
    });
    await queryInterface.addIndex("UserNotifications", ["createdAt"], {
      name: "UserNotifications_createdAt"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("UserNotifications");
  }
};
