import { QueryInterface } from "sequelize";

/**
 * Renomeia PlanFeatures: contacts.crm → contacts.tags
 * (a chave antiga controlava Etiquetas; "CRM / etiquetas" confundia com crm.pipeline).
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE "PlanFeatures" SET "featureKey" = 'contacts.tags' WHERE "featureKey" = 'contacts.crm'`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `UPDATE "PlanFeatures" SET "featureKey" = 'contacts.crm' WHERE "featureKey" = 'contacts.tags'`
    );
  }
};
