import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface
      .createTable("CompanyStorageSnapshots", {
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
        usedBytes: {
          type: DataTypes.BIGINT,
          allowNull: false,
          defaultValue: 0
        },
        limitBytes: {
          type: DataTypes.BIGINT,
          allowNull: true
        },
        usagePercent: {
          type: DataTypes.DECIMAL(10, 1),
          allowNull: true
        },
        reason: {
          type: DataTypes.STRING(64),
          allowNull: false
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false
        }
      })
      .then(() =>
        queryInterface.addIndex("CompanyStorageSnapshots", ["companyId", "createdAt"], {
          name: "CompanyStorageSnapshots_company_created"
        })
      )
      .then(() =>
        queryInterface.addColumn("Companies", "storageAlertWatermark", {
          type: DataTypes.TINYINT,
          allowNull: false,
          defaultValue: 0
        })
      ),

  down: (queryInterface: QueryInterface) =>
    queryInterface
      .removeColumn("Companies", "storageAlertWatermark")
      .then(() => queryInterface.dropTable("CompanyStorageSnapshots"))
};
