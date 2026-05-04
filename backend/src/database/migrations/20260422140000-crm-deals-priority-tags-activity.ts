import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    const jsonType =
      dialect === "postgres" || dialect === "cockroachdb"
        ? DataTypes.JSONB
        : DataTypes.JSON;

    await queryInterface.addColumn("CrmDeals", "priority", {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "medium"
    });

    await queryInterface.addColumn("CrmDeals", "tags", {
      type: jsonType,
      allowNull: true
    });

    await queryInterface.addColumn("CrmDeals", "lastActivityAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    if (dialect === "mysql" || dialect === "mariadb") {
      await queryInterface.sequelize.query(`
        UPDATE CrmDeals
        SET lastActivityAt = COALESCE(updatedAt, createdAt)
        WHERE lastActivityAt IS NULL;
      `);
      await queryInterface.sequelize.query(`
        UPDATE CrmDeals SET tags = JSON_ARRAY() WHERE tags IS NULL;
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE "CrmDeals"
        SET "lastActivityAt" = COALESCE("updatedAt", "createdAt")
        WHERE "lastActivityAt" IS NULL;
      `);
      await queryInterface.sequelize.query(`
        UPDATE "CrmDeals" SET "tags" = '[]'::jsonb WHERE "tags" IS NULL;
      `);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CrmDeals", "lastActivityAt");
    await queryInterface.removeColumn("CrmDeals", "tags");
    await queryInterface.removeColumn("CrmDeals", "priority");
  }
};
