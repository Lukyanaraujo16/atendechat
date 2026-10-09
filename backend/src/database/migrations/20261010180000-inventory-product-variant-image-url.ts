/* eslint-disable import/no-import-module-exports -- Convenção das migrations Sequelize CLI. */
import { QueryInterface, DataTypes } from "sequelize";

/**
 * Imagem opcional por variante (aditiva).
 * Fallback de apresentação permanece no frontend/API (variant || product).
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("InventoryProductVariants", "imageUrl", {
      type: DataTypes.STRING(500),
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("InventoryProductVariants", "imageUrl");
  }
};
