import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fundação de descontos PDV (aditiva / compatível).
 * - Item: discountType + discountPercent (legado = null → fixed via discountAmount)
 * - Venda: globalDiscount* (não reutiliza sale.discountAmount)
 * - Settings: maxDiscountPercentWithoutAuthorization default 100 (não bloqueia legado)
 * - Auditoria: InventoryDiscountAuthorizations
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const itemDesc = (await queryInterface.describeTable(
      "InventorySaleItems"
    )) as Record<string, unknown>;
    if (!itemDesc.discountType) {
      await queryInterface.addColumn("InventorySaleItems", "discountType", {
        type: DataTypes.STRING(16),
        allowNull: true
      });
    }
    if (!itemDesc.discountPercent) {
      await queryInterface.addColumn("InventorySaleItems", "discountPercent", {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
      });
    }

    const saleDesc = (await queryInterface.describeTable(
      "InventorySales"
    )) as Record<string, unknown>;
    if (!saleDesc.globalDiscountType) {
      await queryInterface.addColumn("InventorySales", "globalDiscountType", {
        type: DataTypes.STRING(16),
        allowNull: true
      });
    }
    if (!saleDesc.globalDiscountPercent) {
      await queryInterface.addColumn("InventorySales", "globalDiscountPercent", {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
      });
    }
    if (!saleDesc.globalDiscountAmount) {
      await queryInterface.addColumn("InventorySales", "globalDiscountAmount", {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      });
    }

    const settingsDesc = (await queryInterface.describeTable(
      "InventorySettings"
    )) as Record<string, unknown>;
    if (!settingsDesc.maxDiscountPercentWithoutAuthorization) {
      await queryInterface.addColumn(
        "InventorySettings",
        "maxDiscountPercentWithoutAuthorization",
        {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false,
          defaultValue: 100
        }
      );
    }

    const tables = await queryInterface.showAllTables();
    const normalized = (tables as unknown[]).map(t =>
      typeof t === "string" ? t : (t as { tableName?: string; name?: string }).tableName || (t as { name?: string }).name
    );
    if (!normalized.includes("InventoryDiscountAuthorizations")) {
      await queryInterface.createTable("InventoryDiscountAuthorizations", {
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
        saleId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "InventorySales", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        authorizedByUserId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT"
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        effectiveDiscountPercent: {
          type: DataTypes.DECIMAL(8, 4),
          allowNull: false
        },
        maxAllowedPercent: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false
        },
        merchandiseAfterItemDiscounts: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false
        },
        itemDiscountTotal: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0
        },
        globalDiscountAmount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0
        },
        netMerchandise: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false
        }
      });

      await queryInterface.addIndex(
        "InventoryDiscountAuthorizations",
        ["companyId", "saleId"],
        { name: "InventoryDiscountAuthorizations_company_sale_idx" }
      );
      await queryInterface.addIndex(
        "InventoryDiscountAuthorizations",
        ["companyId", "createdAt"],
        { name: "InventoryDiscountAuthorizations_company_created_idx" }
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tables = await queryInterface.showAllTables();
    const normalized = (tables as unknown[]).map(t =>
      typeof t === "string" ? t : (t as { tableName?: string; name?: string }).tableName || (t as { name?: string }).name
    );
    if (normalized.includes("InventoryDiscountAuthorizations")) {
      await queryInterface.dropTable("InventoryDiscountAuthorizations");
    }

    const settingsDesc = (await queryInterface.describeTable(
      "InventorySettings"
    )) as Record<string, unknown>;
    if (settingsDesc.maxDiscountPercentWithoutAuthorization) {
      await queryInterface.removeColumn(
        "InventorySettings",
        "maxDiscountPercentWithoutAuthorization"
      );
    }

    const saleDesc = (await queryInterface.describeTable(
      "InventorySales"
    )) as Record<string, unknown>;
    for (const col of [
      "globalDiscountAmount",
      "globalDiscountPercent",
      "globalDiscountType"
    ]) {
      if (saleDesc[col]) await queryInterface.removeColumn("InventorySales", col);
    }

    const itemDesc = (await queryInterface.describeTable(
      "InventorySaleItems"
    )) as Record<string, unknown>;
    for (const col of ["discountPercent", "discountType"]) {
      if (itemDesc[col]) await queryInterface.removeColumn("InventorySaleItems", col);
    }
  }
};
