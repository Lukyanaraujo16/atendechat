import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Companies", "businessSegment", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "general"
    });

    await queryInterface.createTable("CrmPipelines", {
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
      segment: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "general"
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
    });

    await queryInterface.createTable("CrmStages", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      pipelineId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "CrmPipelines", key: "id" },
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
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      color: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "#90caf9"
      },
      isWon: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      isLost: {
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
    });

    await queryInterface.createTable("CrmDeals", {
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
        allowNull: false,
        references: { model: "CrmPipelines", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      stageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "CrmStages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false
      },
      value: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "open"
      },
      source: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "manual"
      },
      expectedCloseAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      assignedUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
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

    await queryInterface.addIndex("CrmPipelines", ["companyId"], {
      name: "CrmPipelines_companyId_idx"
    });
    await queryInterface.addIndex("CrmStages", ["companyId"], {
      name: "CrmStages_companyId_idx"
    });
    await queryInterface.addIndex("CrmStages", ["pipelineId"], {
      name: "CrmStages_pipelineId_idx"
    });
    await queryInterface.addIndex("CrmDeals", ["companyId"], {
      name: "CrmDeals_companyId_idx"
    });
    await queryInterface.addIndex("CrmDeals", ["pipelineId"], {
      name: "CrmDeals_pipelineId_idx"
    });
    await queryInterface.addIndex("CrmDeals", ["stageId"], {
      name: "CrmDeals_stageId_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("CrmDeals");
    await queryInterface.dropTable("CrmStages");
    await queryInterface.dropTable("CrmPipelines");
    await queryInterface.removeColumn("Companies", "businessSegment");
  }
};
