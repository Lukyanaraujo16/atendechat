import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Stickers", "fileHash", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await queryInterface.addIndex("Stickers", ["companyId", "fileHash"], {
      name: "stickers_company_file_hash_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "Stickers",
      "stickers_company_file_hash_idx"
    );
    await queryInterface.removeColumn("Stickers", "fileHash");
  }
};
