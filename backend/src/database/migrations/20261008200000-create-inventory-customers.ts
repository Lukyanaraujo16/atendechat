/* eslint-disable import/no-import-module-exports */
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;
    const dialect = sequelize.getDialect();

    return sequelize.transaction(async transaction => {
      // Âncora para FK composta Contact ↔ Customer (mesmo tenant).
      await sequelize.query(
        `
          CREATE UNIQUE INDEX IF NOT EXISTS "Contacts_id_companyId_unique"
          ON "Contacts" ("id", "companyId");
        `,
        { transaction }
      );

      await queryInterface.createTable(
        "InventoryCustomers",
        {
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
          // Sem FK simples — composta abaixo (contactId, companyId).
          contactId: {
            type: DataTypes.INTEGER,
            allowNull: true
          },
          type: {
            type: DataTypes.STRING(16),
            allowNull: false,
            defaultValue: "individual"
          },
          name: {
            type: DataTypes.STRING(255),
            allowNull: false
          },
          tradeName: {
            type: DataTypes.STRING(255),
            allowNull: true
          },
          document: {
            type: DataTypes.STRING(32),
            allowNull: true
          },
          phone: {
            type: DataTypes.STRING(32),
            allowNull: true
          },
          email: {
            type: DataTypes.STRING(255),
            allowNull: true
          },
          postalCode: {
            type: DataTypes.STRING(16),
            allowNull: true
          },
          street: {
            type: DataTypes.STRING(255),
            allowNull: true
          },
          addressNumber: {
            type: DataTypes.STRING(32),
            allowNull: true
          },
          addressComplement: {
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
            type: DataTypes.STRING(8),
            allowNull: true
          },
          notes: {
            type: DataTypes.TEXT,
            allowNull: true
          },
          creditLimit: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0
          },
          isActive: {
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
        },
        { transaction }
      );

      await sequelize.query(
        `
          CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCustomers_id_companyId_unique"
          ON "InventoryCustomers" ("id", "companyId");
        `,
        { transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryCustomers"
          ADD CONSTRAINT "InventoryCustomers_contact_company_fk"
          FOREIGN KEY ("contactId", "companyId")
          REFERENCES "Contacts" ("id", "companyId")
          ON UPDATE CASCADE
          ON DELETE SET NULL;
        `,
        { transaction }
      );

      if (dialect === "postgres") {
        await sequelize.query(
          `
            CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCustomers_company_document_uq"
            ON "InventoryCustomers" ("companyId", "document")
            WHERE "document" IS NOT NULL;
          `,
          { transaction }
        );
        await sequelize.query(
          `
            CREATE UNIQUE INDEX IF NOT EXISTS "InventoryCustomers_company_contactId_uq"
            ON "InventoryCustomers" ("companyId", "contactId")
            WHERE "contactId" IS NOT NULL;
          `,
          { transaction }
        );
      } else {
        await queryInterface.addIndex(
          "InventoryCustomers",
          ["companyId", "document"],
          {
            name: "InventoryCustomers_company_document_uq",
            unique: true,
            transaction
          }
        );
        await queryInterface.addIndex(
          "InventoryCustomers",
          ["companyId", "contactId"],
          {
            name: "InventoryCustomers_company_contactId_uq",
            unique: true,
            transaction
          }
        );
      }

      await queryInterface.addIndex(
        "InventoryCustomers",
        ["companyId", "name"],
        { name: "InventoryCustomers_company_name_idx", transaction }
      );
      await queryInterface.addIndex(
        "InventoryCustomers",
        ["companyId", "phone"],
        { name: "InventoryCustomers_company_phone_idx", transaction }
      );
      await queryInterface.addIndex(
        "InventoryCustomers",
        ["companyId", "isActive"],
        { name: "InventoryCustomers_company_isActive_idx", transaction }
      );

      await sequelize.query(
        `
          ALTER TABLE "InventoryCustomers"
          ADD CONSTRAINT "InventoryCustomers_type_chk"
          CHECK (type IN ('individual', 'company'));
        `,
        { transaction }
      );
      await sequelize.query(
        `
          ALTER TABLE "InventoryCustomers"
          ADD CONSTRAINT "InventoryCustomers_creditLimit_nonneg_chk"
          CHECK ("creditLimit" >= 0);
        `,
        { transaction }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async transaction => {
      await queryInterface.dropTable("InventoryCustomers", { transaction });
      await sequelize.query(
        `DROP INDEX IF EXISTS "Contacts_id_companyId_unique";`,
        { transaction }
      );
    });
  }
};
