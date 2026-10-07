/* eslint-disable import/no-import-module-exports */
import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fundação Entrega/Frete (E1):
 * - InventoryDeliveryMethods (modalidades tenant-scoped)
 * - freightAmount + snapshots de modalidade em InventorySales
 * - InventorySaleDeliveries (snapshot 1:1 de endereço)
 * - endereço estruturado opcional em Contacts
 *
 * Não backfilla vendas antigas como pickup.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    await queryInterface.createTable("InventoryDeliveryMethods", {
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
      name: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      kind: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      defaultAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      },
      allowAmountOverride: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      requiresAddress: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
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
      "InventoryDeliveryMethods",
      ["companyId", "active", "position"],
      { name: "InventoryDeliveryMethods_company_active_position_idx" }
    );
    await queryInterface.addIndex(
      "InventoryDeliveryMethods",
      ["companyId", "name"],
      { name: "InventoryDeliveryMethods_company_name_idx" }
    );
    await queryInterface.addIndex(
      "InventoryDeliveryMethods",
      ["companyId", "kind"],
      { name: "InventoryDeliveryMethods_company_kind_idx" }
    );

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "InventorySales_id_companyId_unique"
      ON "InventorySales" ("id", "companyId");
    `);

    await queryInterface.addColumn("InventorySales", "freightAmount", {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn("InventorySales", "deliveryMethodId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "InventoryDeliveryMethods", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
    await queryInterface.addColumn("InventorySales", "deliveryMethodName", {
      type: DataTypes.STRING(120),
      allowNull: true
    });
    await queryInterface.addColumn("InventorySales", "deliveryKind", {
      type: DataTypes.STRING(32),
      allowNull: true
    });

    await queryInterface.createTable("InventorySaleDeliveries", {
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
        allowNull: false
      },
      recipientName: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      recipientPhone: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      postalCode: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      street: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      number: {
        type: DataTypes.STRING(30),
        allowNull: true
      },
      complement: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      district: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      city: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      state: {
        type: DataTypes.STRING(2),
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
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

    await sequelize.query(`
      ALTER TABLE "InventorySaleDeliveries"
      ADD CONSTRAINT "InventorySaleDeliveries_sale_company_fk"
      FOREIGN KEY ("saleId", "companyId")
      REFERENCES "InventorySales" ("id", "companyId")
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `);

    await queryInterface.addIndex("InventorySaleDeliveries", ["saleId"], {
      unique: true,
      name: "InventorySaleDeliveries_saleId_unique"
    });
    await queryInterface.addIndex(
      "InventorySaleDeliveries",
      ["companyId", "saleId"],
      { name: "InventorySaleDeliveries_company_sale_idx" }
    );

    await queryInterface.addColumn("Contacts", "postalCode", {
      type: DataTypes.STRING(20),
      allowNull: true
    });
    await queryInterface.addColumn("Contacts", "street", {
      type: DataTypes.STRING(255),
      allowNull: true
    });
    await queryInterface.addColumn("Contacts", "addressNumber", {
      type: DataTypes.STRING(30),
      allowNull: true
    });
    await queryInterface.addColumn("Contacts", "addressComplement", {
      type: DataTypes.STRING(120),
      allowNull: true
    });
    await queryInterface.addColumn("Contacts", "district", {
      type: DataTypes.STRING(120),
      allowNull: true
    });
    await queryInterface.addColumn("Contacts", "city", {
      type: DataTypes.STRING(120),
      allowNull: true
    });
    await queryInterface.addColumn("Contacts", "state", {
      type: DataTypes.STRING(2),
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    await queryInterface.removeColumn("Contacts", "state");
    await queryInterface.removeColumn("Contacts", "city");
    await queryInterface.removeColumn("Contacts", "district");
    await queryInterface.removeColumn("Contacts", "addressComplement");
    await queryInterface.removeColumn("Contacts", "addressNumber");
    await queryInterface.removeColumn("Contacts", "street");
    await queryInterface.removeColumn("Contacts", "postalCode");

    await queryInterface.dropTable("InventorySaleDeliveries");

    await queryInterface.removeColumn("InventorySales", "deliveryKind");
    await queryInterface.removeColumn("InventorySales", "deliveryMethodName");
    await queryInterface.removeColumn("InventorySales", "deliveryMethodId");
    await queryInterface.removeColumn("InventorySales", "freightAmount");

    await sequelize.query(`
      DROP INDEX IF EXISTS "InventorySales_id_companyId_unique";
    `);

    await queryInterface.dropTable("InventoryDeliveryMethods");
  }
};
