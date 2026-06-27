import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("InventorySales", "paymentStatus", {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "unpaid"
    });
    await queryInterface.addColumn("InventorySales", "paymentMethod", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await queryInterface.addColumn("InventorySales", "paidAmount", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn("InventorySales", "paidAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("InventorySales", "paymentNotes", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("InventorySales", "paymentNotes");
    await queryInterface.removeColumn("InventorySales", "paidAt");
    await queryInterface.removeColumn("InventorySales", "paidAmount");
    await queryInterface.removeColumn("InventorySales", "paymentMethod");
    await queryInterface.removeColumn("InventorySales", "paymentStatus");
  }
};
