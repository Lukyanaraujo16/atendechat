/* eslint-disable import/no-import-module-exports */
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    return sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        "InventorySettings",
        "blockStoreCreditWhenOverdue",
        {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn(
      "InventorySettings",
      "blockStoreCreditWhenOverdue"
    );
  }
};
