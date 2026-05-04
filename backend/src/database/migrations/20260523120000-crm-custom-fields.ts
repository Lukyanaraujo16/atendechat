import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CrmCustomFields", {
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
      pipelineId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "CrmPipelines", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      key: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      label: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      type: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      options: {
        type: DataTypes.JSON,
        allowNull: true
      },
      required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      visibleOnCard: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      active: {
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

    await queryInterface.addIndex("CrmCustomFields", ["companyId"], {
      name: "CrmCustomFields_companyId_idx"
    });
    await queryInterface.addIndex("CrmCustomFields", ["companyId", "pipelineId"], {
      name: "CrmCustomFields_company_pipeline_idx"
    });

    await queryInterface.addColumn("CrmDeals", "customFields", {
      type: DataTypes.JSON,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CrmDeals", "customFields");
    await queryInterface.dropTable("CrmCustomFields");
  }
};
