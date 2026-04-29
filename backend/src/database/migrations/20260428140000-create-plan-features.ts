import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("PlanFeatures", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      planId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Plans", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      featureKey: {
        type: DataTypes.STRING(191),
        allowNull: false
      },
      enabled: {
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
    }).then(() =>
      queryInterface.addIndex("PlanFeatures", ["planId", "featureKey"], {
        unique: true,
        name: "PlanFeatures_planId_featureKey_unique"
      })
    );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("PlanFeatures");
  }
};
