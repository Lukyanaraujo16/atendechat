import { QueryInterface, DataTypes } from "sequelize";

/**
 * AI Agent V1.1 — Fase 1.1
 * Permissões internas de plataforma (Console Técnico / AgentOS).
 *
 * Seed idempotente: concede apenas agentOS.console.view a usuários que
 * já atendem identidade interna (super=true OU profile=superadmin).
 * Não concede manage/replay/rollout/production automaticamente.
 * Novos supers após esta migration NÃO recebem grant automático.
 */
const CONSOLE_VIEW = "agentOS.console.view";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("PlatformUserPermissions", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      permissionKey: {
        type: DataTypes.STRING(128),
        allowNull: false
      },
      enabled: {
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

    await queryInterface.addIndex(
      "PlatformUserPermissions",
      ["userId", "permissionKey"],
      {
        unique: true,
        name: "PlatformUserPermissions_userId_permissionKey_unique"
      }
    );

    await queryInterface.addIndex("PlatformUserPermissions", ["userId"], {
      name: "PlatformUserPermissions_userId_idx"
    });

    const dialect = queryInterface.sequelize.getDialect();
    const qi = queryInterface.sequelize;
    const replacements = { permissionKey: CONSOLE_VIEW };

    if (dialect === "postgres") {
      await qi.query(
        `
        INSERT INTO "PlatformUserPermissions"
          ("userId", "permissionKey", "enabled", "createdAt", "updatedAt")
        SELECT
          u.id,
          :permissionKey,
          true,
          NOW(),
          NOW()
        FROM "Users" u
        WHERE (u."super" = true OR u.profile = 'superadmin')
          AND NOT EXISTS (
            SELECT 1 FROM "PlatformUserPermissions" p
            WHERE p."userId" = u.id AND p."permissionKey" = :permissionKey
          )
        `,
        { replacements }
      );
    } else {
      await qi.query(
        `
        INSERT INTO PlatformUserPermissions
          (userId, permissionKey, enabled, createdAt, updatedAt)
        SELECT
          u.id,
          :permissionKey,
          1,
          NOW(),
          NOW()
        FROM Users u
        WHERE (u.super = 1 OR u.profile = 'superadmin')
          AND NOT EXISTS (
            SELECT 1 FROM PlatformUserPermissions p
            WHERE p.userId = u.id AND p.permissionKey = :permissionKey
          )
        `,
        { replacements }
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("PlatformUserPermissions");
  }
};
