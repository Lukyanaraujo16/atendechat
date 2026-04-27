import { QueryInterface, DataTypes } from "sequelize";

/**
 * Super Admin: preferências sem empresa (companyId NULL).
 * Índice único (userId, COALESCE(companyId, 0)) via coluna gerada preferenceScopeKey;
 * 0 = âmbito plataforma (não deve existir empresa com id 0).
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "UserNotificationPreferences",
      "UserNotificationPreferences_user_company_unique"
    );

    await queryInterface.changeColumn("UserNotificationPreferences", "companyId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Companies", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });

    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "mysql" || dialect === "mariadb") {
      await queryInterface.sequelize.query(`
        ALTER TABLE UserNotificationPreferences
        ADD COLUMN preferenceScopeKey INT
          GENERATED ALWAYS AS (COALESCE(companyId, 0)) STORED,
        ADD UNIQUE INDEX UserNotificationPreferences_user_scope_unique (userId, preferenceScopeKey);
      `);
    } else if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        ALTER TABLE "UserNotificationPreferences"
        ADD COLUMN "preferenceScopeKey" INTEGER
          GENERATED ALWAYS AS (COALESCE("companyId", 0)) STORED;
      `);
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX "UserNotificationPreferences_user_scope_unique"
        ON "UserNotificationPreferences" ("userId", "preferenceScopeKey");
      `);
    } else {
      await queryInterface.addIndex("UserNotificationPreferences", {
        fields: ["userId", "companyId"],
        unique: true,
        name: "UserNotificationPreferences_user_company_unique"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "mysql" || dialect === "mariadb") {
      await queryInterface.sequelize.query(`
        ALTER TABLE UserNotificationPreferences
        DROP INDEX UserNotificationPreferences_user_scope_unique,
        DROP COLUMN preferenceScopeKey;
      `);
    } else if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS "UserNotificationPreferences_user_scope_unique";
      `);
      await queryInterface.sequelize.query(`
        ALTER TABLE "UserNotificationPreferences" DROP COLUMN IF EXISTS "preferenceScopeKey";
      `);
    } else {
      await queryInterface.removeIndex(
        "UserNotificationPreferences",
        "UserNotificationPreferences_user_company_unique"
      );
    }

    await queryInterface.sequelize.query(`
      DELETE FROM UserNotificationPreferences WHERE companyId IS NULL;
    `);

    await queryInterface.changeColumn("UserNotificationPreferences", "companyId", {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "Companies", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });

    await queryInterface.addIndex("UserNotificationPreferences", {
      fields: ["userId", "companyId"],
      unique: true,
      name: "UserNotificationPreferences_user_company_unique"
    });
  }
};
