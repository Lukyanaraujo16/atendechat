import { QueryInterface } from "sequelize";

const FEATURE_KEY = "settings.instagram_integration";

/**
 * Habilita Instagram nos planos existentes (retrocompat).
 * Super Admin pode desativar por plano via PlanFeatures.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `
      INSERT INTO "PlanFeatures" ("planId", "featureKey", "enabled", "createdAt", "updatedAt")
      SELECT p.id, :featureKey, true, NOW(), NOW()
      FROM "Plans" p
      WHERE NOT EXISTS (
        SELECT 1 FROM "PlanFeatures" pf
        WHERE pf."planId" = p.id AND pf."featureKey" = :featureKey
      )
      `,
      { replacements: { featureKey: FEATURE_KEY } }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `DELETE FROM "PlanFeatures" WHERE "featureKey" = :featureKey`,
      { replacements: { featureKey: FEATURE_KEY } }
    );
  }
};
