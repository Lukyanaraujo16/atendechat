import { QueryInterface } from "sequelize";

module.exports = {
  // Sequencial: antes, `return remove(...), add(...)` (operador vírgula) disparava os dois em
  // paralelo e a criação podia vencer a remoção ("relation ... already exists") em bases novas.
  // Bancos existentes já aplicaram esta migration; a mudança só afeta instalações novas.
  up: async (queryInterface: QueryInterface) => {
    // IF EXISTS: pode ser reexecutada após falha parcial (constraint já removida).
    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query(
        'ALTER TABLE "Tickets" DROP CONSTRAINT IF EXISTS "contactid_companyid_unique"'
      );
    } else {
      await queryInterface.removeConstraint(
        "Tickets",
        "contactid_companyid_unique"
      );
    }
    await queryInterface.addConstraint(
      "Tickets",
      ["contactId", "companyId", "whatsappId"],
      {
        type: "unique",
        name: "contactid_companyid_unique"
      }
    );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeConstraint(
      "Tickets",
      "contactid_companyid_unique"
    );
  }
};
