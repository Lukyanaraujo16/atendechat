import { QueryInterface } from "sequelize";

/**
 * Wave 5 — Production readiness markers.
 * Não cria tabelas novas destrutivas: rollout/kill/incidents usam
 * AutomationAgentOsSetting / Events / Audit já existentes (Wave 1).
 * Seed da feature automation.production (default false).
 */
const FEATURE_KEY = "automation.production";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    const qi = queryInterface.sequelize;
    const replacements = { featureKey: FEATURE_KEY };

    if (dialect === "postgres") {
      await qi.query(
        `
        INSERT INTO "PlanFeatures" ("planId", "featureKey", "enabled", "createdAt", "updatedAt")
        SELECT
          p.id,
          :featureKey,
          false,
          NOW(),
          NOW()
        FROM "Plans" p
        WHERE NOT EXISTS (
          SELECT 1 FROM "PlanFeatures" pf
          WHERE pf."planId" = p.id AND pf."featureKey" = :featureKey
        )
        `,
        { replacements }
      );
    } else {
      await qi.query(
        `
        INSERT INTO PlanFeatures (planId, featureKey, enabled, createdAt, updatedAt)
        SELECT
          p.id,
          :featureKey,
          0,
          NOW(),
          NOW()
        FROM Plans p
        WHERE NOT EXISTS (
          SELECT 1 FROM PlanFeatures pf
          WHERE pf.planId = p.id AND pf.featureKey = :featureKey
        )
        `,
        { replacements }
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    const qi = queryInterface.sequelize;
    if (dialect === "postgres") {
      await qi.query(
        `DELETE FROM "PlanFeatures" WHERE "featureKey" = :featureKey`,
        { replacements: { featureKey: FEATURE_KEY } }
      );
    } else {
      await qi.query(
        `DELETE FROM PlanFeatures WHERE featureKey = :featureKey`,
        { replacements: { featureKey: FEATURE_KEY } }
      );
    }
  }
};
