import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.sequelize.transaction(async t => {
      await queryInterface.addColumn(
        "Plans",
        "storageLimitGb",
        {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: null
        },
        { transaction: t }
      );
      await queryInterface.addColumn(
        "Companies",
        "storageLimitGb",
        {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          defaultValue: null
        },
        { transaction: t }
      );
      await queryInterface.addColumn(
        "Companies",
        "storageUsedBytes",
        {
          type: DataTypes.BIGINT,
          allowNull: false,
          defaultValue: 0
        },
        { transaction: t }
      );
      await queryInterface.addColumn(
        "Companies",
        "storageCalculatedAt",
        {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null
        },
        { transaction: t }
      );
    }),

  down: (queryInterface: QueryInterface) =>
    queryInterface.sequelize.transaction(async t => {
      await queryInterface.removeColumn("Plans", "storageLimitGb", {
        transaction: t
      });
      await queryInterface.removeColumn("Companies", "storageLimitGb", {
        transaction: t
      });
      await queryInterface.removeColumn("Companies", "storageUsedBytes", {
        transaction: t
      });
      await queryInterface.removeColumn("Companies", "storageCalculatedAt", {
        transaction: t
      });
    })
};
