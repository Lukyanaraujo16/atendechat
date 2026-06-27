import { QueryInterface } from "sequelize";

const FEATURE_KEY = "inventory.sales";

/**
 * Registra a feature Estoque e Vendas nos planos existentes como desativada.
 * Super Admin habilita por plano via PlanFeatures.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    const replacements = { featureKey: FEATURE_KEY };

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        `
        INSERT INTO "PlanFeatures" ("planId", "featureKey", "enabled", "createdAt", "updatedAt")
        SELECT p.id, :featureKey, false, NOW(), NOW()
        FROM "Plans" p
        WHERE NOT EXISTS (
          SELECT 1 FROM "PlanFeatures" pf
          WHERE pf."planId" = p.id AND pf."featureKey" = :featureKey
        )
        `,
        { replacements }
      );
      return;
    }

    await queryInterface.sequelize.query(
      `
      INSERT INTO PlanFeatures (planId, featureKey, enabled, createdAt, updatedAt)
      SELECT p.id, :featureKey, 0, NOW(), NOW()
      FROM Plans p
      WHERE NOT EXISTS (
        SELECT 1 FROM PlanFeatures pf
        WHERE pf.planId = p.id AND pf.featureKey = :featureKey
      )
      `,
      { replacements }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    const replacements = { featureKey: FEATURE_KEY };

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        `DELETE FROM "PlanFeatures" WHERE "featureKey" = :featureKey`,
        { replacements }
      );
      return;
    }

    await queryInterface.sequelize.query(
      `DELETE FROM PlanFeatures WHERE featureKey = :featureKey`,
      { replacements }
    );
  }
};
