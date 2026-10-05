/* eslint-disable import/no-import-module-exports -- Convenção das migrations Sequelize CLI. */
import { QueryInterface, UniqueConstraintError } from "sequelize";
import {
  assertInventoryBarcodeSchema,
  diagnoseInventoryBarcodes,
  INVENTORY_BARCODE_INDEX
} from "../../helpers/inventoryBarcodeSchema";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await assertInventoryBarcodeSchema(queryInterface);
    const report = await diagnoseInventoryBarcodes(queryInterface);
    if (report.duplicateGroups || report.nonNormalizedProducts) {
      throw new Error(
        `Barcode: unicidade não criada. Corrija os dados manualmente e repita o diagnóstico. Nenhum produto foi alterado. ${JSON.stringify(
          report
        )}`
      );
    }
    try {
      if (queryInterface.sequelize.getDialect() === "postgres") {
        await queryInterface.sequelize.query(
          `CREATE UNIQUE INDEX "${INVENTORY_BARCODE_INDEX}" ON "InventoryProducts" ("companyId", "barcode" COLLATE "C")`
        );
      } else {
        await queryInterface.addIndex(
          "InventoryProducts",
          ["companyId", "barcode"],
          {
            name: INVENTORY_BARCODE_INDEX,
            unique: true
          }
        );
      }
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new Error(
          "Barcode: duplicidade durante a criação do índice (possível gravação concorrente). Interrompa as gravações de produtos, corrija os dados manualmente e repita o diagnóstico. Nenhum produto foi alterado pela migration."
        );
      }
      throw error;
    }
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "InventoryProducts",
      INVENTORY_BARCODE_INDEX
    );
  }
};
