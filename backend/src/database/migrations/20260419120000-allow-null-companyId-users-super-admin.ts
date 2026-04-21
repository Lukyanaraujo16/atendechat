import { QueryInterface } from "sequelize";

/**
 * Permite Super Admin sem empresa operacional (companyId nulo).
 * Requer que utilizadores sem empresa não acedam a rotas que dependem de tenant.
 */
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.query(
      "ALTER TABLE Users MODIFY COLUMN companyId INT NULL"
    );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.query(
      "ALTER TABLE Users MODIFY COLUMN companyId INT NOT NULL"
    );
  }
};
