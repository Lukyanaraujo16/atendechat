import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addIndex("Contacts", ["companyId", "updatedAt"], {
      name: "idx_cont_company_id_updated_at"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeIndex(
      "Contacts",
      "idx_cont_company_id_updated_at"
    );
  }
};
