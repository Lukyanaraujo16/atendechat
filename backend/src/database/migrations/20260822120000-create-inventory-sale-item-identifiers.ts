/* eslint-disable import/no-import-module-exports */
import { QueryInterface, DataTypes } from "sequelize";

/**
 * Identificadores de unidade vendida.
 *
 * Coerência multiempresa: FK composta
 *   (saleItemId, companyId) → InventorySaleItems(id, companyId)
 * exige UNIQUE (id, companyId) no pai. A FK simples saleItemId→id
 * sozinha não impediria companyId divergente.
 *
 * SQL cru na unique do pai e na FK composta: Sequelize 5 addConstraint
 * é inconsistente com FKs compostas no PostgreSQL (padrão já usado
 * em 20260415120000-queues-unique-per-company).
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "InventorySaleItems_id_companyId_unique"
      ON "InventorySaleItems" ("id", "companyId");
    `);

    await queryInterface.createTable("InventorySaleItemIdentifiers", {
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
      saleItemId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      identifier: {
        type: DataTypes.STRING(255),
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

    await sequelize.query(`
      ALTER TABLE "InventorySaleItemIdentifiers"
      ADD CONSTRAINT "InventorySaleItemIdentifiers_saleItem_company_fk"
      FOREIGN KEY ("saleItemId", "companyId")
      REFERENCES "InventorySaleItems" ("id", "companyId")
      ON UPDATE CASCADE
      ON DELETE CASCADE;
    `);

    await queryInterface.addIndex(
      "InventorySaleItemIdentifiers",
      ["saleItemId", "position"],
      {
        unique: true,
        name: "InventorySaleItemIdentifiers_saleItemId_position_unique"
      }
    );

    await queryInterface.addIndex(
      "InventorySaleItemIdentifiers",
      ["companyId", "identifier"],
      {
        name: "InventorySaleItemIdentifiers_companyId_identifier_idx"
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    const { sequelize } = queryInterface;

    await queryInterface.dropTable("InventorySaleItemIdentifiers");

    await sequelize.query(`
      DROP INDEX IF EXISTS "InventorySaleItems_id_companyId_unique";
    `);
  }
};
