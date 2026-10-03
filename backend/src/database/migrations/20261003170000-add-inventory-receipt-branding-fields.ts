import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("InventorySettings", "receiptTradeName", {
      type: DataTypes.STRING(120),
      allowNull: true
    });
    await queryInterface.addColumn("InventorySettings", "receiptLegalName", {
      type: DataTypes.STRING(160),
      allowNull: true
    });
    await queryInterface.addColumn("InventorySettings", "receiptDocument", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await queryInterface.addColumn("InventorySettings", "receiptPhone", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await queryInterface.addColumn("InventorySettings", "receiptAddress", {
      type: DataTypes.STRING(255),
      allowNull: true
    });
    await queryInterface.addColumn(
      "InventorySettings",
      "receiptFooterMessage",
      {
        type: DataTypes.STRING(500),
        allowNull: true
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn(
      "InventorySettings",
      "receiptFooterMessage"
    );
    await queryInterface.removeColumn("InventorySettings", "receiptAddress");
    await queryInterface.removeColumn("InventorySettings", "receiptPhone");
    await queryInterface.removeColumn("InventorySettings", "receiptDocument");
    await queryInterface.removeColumn("InventorySettings", "receiptLegalName");
    await queryInterface.removeColumn("InventorySettings", "receiptTradeName");
  }
};
