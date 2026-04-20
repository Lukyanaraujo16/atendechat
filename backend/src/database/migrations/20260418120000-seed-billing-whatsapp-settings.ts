import { QueryInterface } from "sequelize";

const ROWS: [string, string][] = [
  ["billingAuto_enableAutoWhatsAppWarning", "false"],
  ["billingAuto_whatsappSenderCompanyId", "1"]
];

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;
    const dialect = sequelize.getDialect();
    const now = new Date();

    for (const [key, value] of ROWS) {
      if (dialect === "postgres") {
        await sequelize.query(
          `INSERT INTO "SystemSettings" ("key", value, "createdAt", "updatedAt")
           SELECT :key, :value, :now, :now
           WHERE NOT EXISTS (SELECT 1 FROM "SystemSettings" WHERE "key" = :key)`,
          { replacements: { key, value, now } }
        );
      } else {
        await sequelize.query(
          `INSERT INTO SystemSettings (\`key\`, value, createdAt, updatedAt)
           SELECT :key, :value, :now, :now
           FROM DUAL
           WHERE NOT EXISTS (SELECT 1 FROM SystemSettings WHERE \`key\` = :key)`,
          { replacements: { key, value, now } }
        );
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;
    const dialect = sequelize.getDialect();
    for (const key of ROWS.map((r) => r[0])) {
      if (dialect === "postgres") {
        await sequelize.query(`DELETE FROM "SystemSettings" WHERE "key" = :key`, {
          replacements: { key }
        });
      } else {
        await sequelize.query("DELETE FROM SystemSettings WHERE `key` = :key", {
          replacements: { key }
        });
      }
    }
  }
};
