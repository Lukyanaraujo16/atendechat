import { QueryInterface, DataTypes } from "sequelize";
import {
  addColumnIfMissing,
  removeColumnIfExists,
  tableExists
} from "./helpers/migrationTableHelpers";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    if (!(await tableExists(queryInterface, "Stickers"))) {
      return;
    }

    await addColumnIfMissing(queryInterface, "Stickers", "fileHash", {
      type: DataTypes.STRING(64),
      allowNull: true
    });

    try {
      await queryInterface.addIndex("Stickers", ["companyId", "fileHash"], {
        name: "stickers_company_file_hash_idx"
      });
    } catch (err: unknown) {
      const msg = String((err as Error)?.message || err || "");
      if (!/exists|duplicate|already/i.test(msg)) {
        throw err;
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeIndex(
        "Stickers",
        "stickers_company_file_hash_idx"
      );
    } catch {
      /* índice pode não existir */
    }
    await removeColumnIfExists(queryInterface, "Stickers", "fileHash");
  }
};
