/* eslint-disable import/no-import-module-exports -- Convenção das migrations Sequelize CLI. */
import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fundação aditiva de produtos com variações.
 * - productKind em InventoryProducts (default simple)
 * - atributos/opções por empresa
 * - variantes + combinação canônica
 * - registro unificado de códigos vendáveis (SKU/barcode)
 * - variantId nullable em sale items e stock movements
 * Sem backfill destrutivo; produtos existentes permanecem simple.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;
    const dialect = sequelize.getDialect();

    await queryInterface.addColumn("InventoryProducts", "productKind", {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "simple"
    });

    await queryInterface.createTable("InventoryProductAttributes", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: { type: DataTypes.STRING(80), allowNull: false },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("InventoryProductAttributes", ["companyId", "name"], {
      name: "InventoryProductAttributes_companyId_name_idx",
      unique: true
    });

    await queryInterface.createTable("InventoryProductAttributeOptions", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      attributeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "InventoryProductAttributes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      value: { type: DataTypes.STRING(120), allowNull: false },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex(
      "InventoryProductAttributeOptions",
      ["companyId", "attributeId", "value"],
      {
        name: "InventoryProductAttributeOptions_company_attr_value_idx",
        unique: true
      }
    );

    await queryInterface.createTable("InventoryProductVariants", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "InventoryProducts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      label: { type: DataTypes.STRING(200), allowNull: false },
      combinationKey: { type: DataTypes.STRING(500), allowNull: false },
      sku: { type: DataTypes.STRING(64), allowNull: true },
      barcode: { type: DataTypes.STRING(64), allowNull: true },
      salePrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      costPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      trackStock: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      currentQuantity: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false,
        defaultValue: 0
      },
      minStock: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex(
      "InventoryProductVariants",
      ["companyId", "productId", "combinationKey"],
      {
        name: "InventoryProductVariants_company_product_combo_uq",
        unique: true
      }
    );
    await queryInterface.addIndex("InventoryProductVariants", ["companyId", "sku"], {
      name: "InventoryProductVariants_companyId_sku_idx"
    });
    await queryInterface.addIndex(
      "InventoryProductVariants",
      ["companyId", "productId", "active"],
      { name: "InventoryProductVariants_company_product_active_idx" }
    );
    if (dialect === "postgres") {
      await sequelize.query(
        `CREATE UNIQUE INDEX "InventoryProductVariants_companyId_barcode_key"
         ON "InventoryProductVariants" ("companyId", "barcode" COLLATE "C")
         WHERE "barcode" IS NOT NULL`
      );
    } else {
      await queryInterface.addIndex(
        "InventoryProductVariants",
        ["companyId", "barcode"],
        {
          name: "InventoryProductVariants_companyId_barcode_key",
          unique: true
        }
      );
    }

    await queryInterface.createTable("InventoryProductVariantOptions", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      variantId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "InventoryProductVariants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      attributeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "InventoryProductAttributes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      optionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "InventoryProductAttributeOptions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex(
      "InventoryProductVariantOptions",
      ["variantId", "attributeId"],
      {
        name: "InventoryProductVariantOptions_variant_attr_uq",
        unique: true
      }
    );

    await queryInterface.createTable("InventorySellableCodes", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      codeType: { type: DataTypes.STRING(16), allowNull: false },
      codeValue: { type: DataTypes.STRING(64), allowNull: false },
      productId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "InventoryProducts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      variantId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "InventoryProductVariants", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    if (dialect === "postgres") {
      await sequelize.query(
        `CREATE UNIQUE INDEX "InventorySellableCodes_company_type_value_uq"
         ON "InventorySellableCodes" ("companyId", "codeType", "codeValue" COLLATE "C")`
      );
    } else {
      await queryInterface.addIndex(
        "InventorySellableCodes",
        ["companyId", "codeType", "codeValue"],
        {
          name: "InventorySellableCodes_company_type_value_uq",
          unique: true
        }
      );
    }

    await queryInterface.addColumn("InventorySaleItems", "variantId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "InventoryProductVariants", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT"
    });
    await queryInterface.addColumn("InventorySaleItems", "variantLabel", {
      type: DataTypes.STRING(200),
      allowNull: true
    });
    await queryInterface.addColumn("InventorySaleItems", "variantSku", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await queryInterface.addColumn("InventorySaleItems", "variantBarcode", {
      type: DataTypes.STRING(64),
      allowNull: true
    });
    await queryInterface.addIndex("InventorySaleItems", ["companyId", "variantId"], {
      name: "InventorySaleItems_companyId_variantId_idx"
    });

    await queryInterface.addColumn("InventoryStockMovements", "variantId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "InventoryProductVariants", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT"
    });
    await queryInterface.addIndex(
      "InventoryStockMovements",
      ["companyId", "variantId", "createdAt"],
      { name: "InventoryStockMovements_companyId_variantId_createdAt_idx" }
    );

    // Backfill sellable codes from existing simple products (additive, non-destructive).
    if (dialect === "postgres") {
      await sequelize.query(`
        INSERT INTO "InventorySellableCodes"
          ("companyId", "codeType", "codeValue", "productId", "variantId", "createdAt", "updatedAt")
        SELECT "companyId", 'sku', "sku", "id", NULL, NOW(), NOW()
        FROM "InventoryProducts"
        WHERE "sku" IS NOT NULL AND TRIM("sku") <> ''
        ON CONFLICT DO NOTHING
      `);
      await sequelize.query(`
        INSERT INTO "InventorySellableCodes"
          ("companyId", "codeType", "codeValue", "productId", "variantId", "createdAt", "updatedAt")
        SELECT "companyId", 'barcode', "barcode", "id", NULL, NOW(), NOW()
        FROM "InventoryProducts"
        WHERE "barcode" IS NOT NULL AND TRIM("barcode") <> ''
        ON CONFLICT DO NOTHING
      `);
    } else {
      await sequelize.query(`
        INSERT IGNORE INTO InventorySellableCodes
          (companyId, codeType, codeValue, productId, variantId, createdAt, updatedAt)
        SELECT companyId, 'sku', sku, id, NULL, NOW(), NOW()
        FROM InventoryProducts
        WHERE sku IS NOT NULL AND TRIM(sku) <> ''
      `);
      await sequelize.query(`
        INSERT IGNORE INTO InventorySellableCodes
          (companyId, codeType, codeValue, productId, variantId, createdAt, updatedAt)
        SELECT companyId, 'barcode', barcode, id, NULL, NOW(), NOW()
        FROM InventoryProducts
        WHERE barcode IS NOT NULL AND TRIM(barcode) <> ''
      `);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    await queryInterface.removeIndex(
      "InventoryStockMovements",
      "InventoryStockMovements_companyId_variantId_createdAt_idx"
    ).catch(() => undefined);
    await queryInterface.removeColumn("InventoryStockMovements", "variantId");
    await queryInterface.removeIndex(
      "InventorySaleItems",
      "InventorySaleItems_companyId_variantId_idx"
    ).catch(() => undefined);
    await queryInterface.removeColumn("InventorySaleItems", "variantBarcode");
    await queryInterface.removeColumn("InventorySaleItems", "variantSku");
    await queryInterface.removeColumn("InventorySaleItems", "variantLabel");
    await queryInterface.removeColumn("InventorySaleItems", "variantId");
    await queryInterface.dropTable("InventorySellableCodes");
    await queryInterface.dropTable("InventoryProductVariantOptions");
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS "InventoryProductVariants_companyId_barcode_key"`
      );
    }
    await queryInterface.dropTable("InventoryProductVariants");
    await queryInterface.dropTable("InventoryProductAttributeOptions");
    await queryInterface.dropTable("InventoryProductAttributes");
    await queryInterface.removeColumn("InventoryProducts", "productKind");
  }
};
