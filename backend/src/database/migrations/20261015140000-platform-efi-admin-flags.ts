import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase 8.3-B2 — flags administrativas complementares (aditiva).
 * Não altera migration B1 já aplicada.
 *
 * adminEnabled: Super Admin habilitou a config para cutover futuro (B3).
 * pixHomologated: Pix ponta a ponta comprovado (somente após B3/homologação).
 * Nunca definidos automaticamente por OAuth Cobranças.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("PlatformEfiConfigs");

    if (!("adminEnabled" in table)) {
      await queryInterface.addColumn("PlatformEfiConfigs", "adminEnabled", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    if (!("pixHomologated" in table)) {
      await queryInterface.addColumn("PlatformEfiConfigs", "pixHomologated", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const table = await queryInterface.describeTable("PlatformEfiConfigs");
    if ("pixHomologated" in table) {
      await queryInterface.removeColumn("PlatformEfiConfigs", "pixHomologated");
    }
    if ("adminEnabled" in table) {
      await queryInterface.removeColumn("PlatformEfiConfigs", "adminEnabled");
    }
  }
};
