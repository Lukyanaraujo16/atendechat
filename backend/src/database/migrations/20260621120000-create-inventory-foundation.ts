import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("InventorySettings", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      defaultCommissionRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      allowNegativeStock: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      saleNumberPrefix: {
        type: DataTypes.STRING(16),
        allowNull: true
      },
      nextSaleNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
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

    await queryInterface.createTable("InventoryCategories", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "InventoryCategories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.createTable("InventoryProducts", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "InventoryCategories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      sku: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      barcode: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      unit: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "un"
      },
      salePrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
      },
      costPrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
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
      minStock: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: true
      },
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.createTable("InventoryStockMovements", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
      type: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      quantity: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
      },
      balanceAfter: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
      },
      unitCost: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
      referenceType: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      referenceId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.createTable("InventorySellerProfiles", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      commissionRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.createTable("InventorySales", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      saleNumber: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "draft"
      },
      source: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "manual"
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      sellerUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      subtotalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      },
      discountAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      },
      totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      },
      commissionRate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
      },
      commissionAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      cancelledBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      cancelReason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
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

    await queryInterface.createTable("InventorySaleItems", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
      productId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "InventoryProducts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      productName: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      productSku: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      unit: {
        type: DataTypes.STRING(16),
        allowNull: false
      },
      unitPrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
      },
      costPrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
      quantity: {
        type: DataTypes.DECIMAL(12, 3),
        allowNull: false
      },
      discountAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      },
      totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
      },
      trackStock: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.addIndex("InventorySettings", ["companyId"], {
      unique: true,
      name: "InventorySettings_companyId_unique"
    });

    await queryInterface.addIndex(
      "InventoryCategories",
      ["companyId", "active", "position"],
      { name: "InventoryCategories_companyId_active_position_idx" }
    );
    await queryInterface.addIndex(
      "InventoryCategories",
      ["companyId", "parentId", "name"],
      { name: "InventoryCategories_companyId_parentId_name_idx" }
    );

    await queryInterface.addIndex(
      "InventoryProducts",
      ["companyId", "active", "name"],
      { name: "InventoryProducts_companyId_active_name_idx" }
    );
    await queryInterface.addIndex("InventoryProducts", ["companyId", "sku"], {
      name: "InventoryProducts_companyId_sku_idx"
    });
    await queryInterface.addIndex("InventoryProducts", ["companyId", "categoryId"], {
      name: "InventoryProducts_companyId_categoryId_idx"
    });
    await queryInterface.addIndex(
      "InventoryProducts",
      ["companyId", "currentQuantity"],
      { name: "InventoryProducts_companyId_currentQuantity_idx" }
    );

    await queryInterface.addIndex(
      "InventoryStockMovements",
      ["companyId", "productId", "createdAt"],
      { name: "InventoryStockMovements_companyId_productId_createdAt_idx" }
    );
    await queryInterface.addIndex(
      "InventoryStockMovements",
      ["companyId", "referenceType", "referenceId"],
      { name: "InventoryStockMovements_companyId_reference_idx" }
    );

    await queryInterface.addIndex(
      "InventorySellerProfiles",
      ["companyId", "userId"],
      { unique: true, name: "InventorySellerProfiles_companyId_userId_unique" }
    );

    await queryInterface.addIndex(
      "InventorySales",
      ["companyId", "saleNumber"],
      { unique: true, name: "InventorySales_companyId_saleNumber_unique" }
    );
    await queryInterface.addIndex(
      "InventorySales",
      ["companyId", "status", "completedAt"],
      { name: "InventorySales_companyId_status_completedAt_idx" }
    );
    await queryInterface.addIndex(
      "InventorySales",
      ["companyId", "contactId", "completedAt"],
      { name: "InventorySales_companyId_contactId_completedAt_idx" }
    );
    await queryInterface.addIndex(
      "InventorySales",
      ["companyId", "sellerUserId", "completedAt"],
      { name: "InventorySales_companyId_sellerUserId_completedAt_idx" }
    );
    await queryInterface.addIndex("InventorySales", ["companyId", "ticketId"], {
      name: "InventorySales_companyId_ticketId_idx"
    });

    await queryInterface.addIndex("InventorySaleItems", ["saleId"], {
      name: "InventorySaleItems_saleId_idx"
    });
    await queryInterface.addIndex(
      "InventorySaleItems",
      ["companyId", "productId"],
      { name: "InventorySaleItems_companyId_productId_idx" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("InventorySaleItems");
    await queryInterface.dropTable("InventorySales");
    await queryInterface.dropTable("InventorySellerProfiles");
    await queryInterface.dropTable("InventoryStockMovements");
    await queryInterface.dropTable("InventoryProducts");
    await queryInterface.dropTable("InventoryCategories");
    await queryInterface.dropTable("InventorySettings");
  }
};
