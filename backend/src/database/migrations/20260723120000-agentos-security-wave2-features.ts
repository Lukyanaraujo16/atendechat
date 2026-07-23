import { QueryInterface } from "sequelize";

const FEATURE_KEYS = [
  "automation.ai",
  "automation.memory",
  "automation.learning",
  "automation.mcp",
  "automation.multi_agent",
  "automation.runtime",
  "automation.replay",
  "automation.monitor",
  "automation.dashboard",
  "automation.tester"
];

/**
 * Seed oficial das feature flags AgentOS Wave 2.
 * Copia o estado de automation.ai_tools (senão ai_agent); default false.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    const qi = queryInterface.sequelize;

    for (const featureKey of FEATURE_KEYS) {
      const replacements = { featureKey };
      if (dialect === "postgres") {
        await qi.query(
          `
          INSERT INTO "PlanFeatures" ("planId", "featureKey", "enabled", "createdAt", "updatedAt")
          SELECT
            p.id,
            :featureKey,
            COALESCE(
              (SELECT pf."enabled" FROM "PlanFeatures" pf
                WHERE pf."planId" = p.id AND pf."featureKey" = 'automation.ai_tools' LIMIT 1),
              (SELECT pf."enabled" FROM "PlanFeatures" pf
                WHERE pf."planId" = p.id AND pf."featureKey" = 'automation.ai_agent' LIMIT 1),
              false
            ),
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
            COALESCE(
              (SELECT pf.enabled FROM PlanFeatures pf
                WHERE pf.planId = p.id AND pf.featureKey = 'automation.ai_tools' LIMIT 1),
              (SELECT pf.enabled FROM PlanFeatures pf
                WHERE pf.planId = p.id AND pf.featureKey = 'automation.ai_agent' LIMIT 1),
              0
            ),
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
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    for (const featureKey of FEATURE_KEYS) {
      const replacements = { featureKey };
      if (dialect === "postgres") {
        await queryInterface.sequelize.query(
          `DELETE FROM "PlanFeatures" WHERE "featureKey" = :featureKey`,
          { replacements }
        );
      } else {
        await queryInterface.sequelize.query(
          `DELETE FROM PlanFeatures WHERE featureKey = :featureKey`,
          { replacements }
        );
      }
    }
  }
};
