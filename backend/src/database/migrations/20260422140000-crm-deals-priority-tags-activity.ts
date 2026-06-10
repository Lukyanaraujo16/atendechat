import { QueryInterface, DataTypes } from "sequelize";
import {
  addColumnIfMissing,
  jsonColumnType,
  removeColumnIfExists,
  tableExists
} from "./helpers/migrationTableHelpers";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    if (!(await tableExists(queryInterface, "CrmDeals"))) {
      return;
    }

    const jsonType = jsonColumnType(queryInterface);

    await addColumnIfMissing(queryInterface, "CrmDeals", "priority", {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "medium"
    });

    await addColumnIfMissing(queryInterface, "CrmDeals", "tags", {
      type: jsonType,
      allowNull: true
    });

    await addColumnIfMissing(queryInterface, "CrmDeals", "lastActivityAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    const dialect = queryInterface.sequelize.getDialect();
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
    await removeColumnIfExists(queryInterface, "CrmDeals", "lastActivityAt");
    await removeColumnIfExists(queryInterface, "CrmDeals", "tags");
    await removeColumnIfExists(queryInterface, "CrmDeals", "priority");
  }
};
