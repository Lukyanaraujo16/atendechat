import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CrmAutomationRules", {
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
        type: DataTypes.STRING(255),
        allowNull: false
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      triggerType: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      triggerConfig: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
      },
      actionType: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      actionConfig: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
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

    await queryInterface.addIndex("CrmAutomationRules", ["companyId"], {
      name: "CrmAutomationRules_companyId"
    });

    await queryInterface.addColumn("CrmDeals", "automationLastStaleNotifyAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CrmDeals", "automationLastStaleNotifyAt");
    await queryInterface.dropTable("CrmAutomationRules");
  }
};
