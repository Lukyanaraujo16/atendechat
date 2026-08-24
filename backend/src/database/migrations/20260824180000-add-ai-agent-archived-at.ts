import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase 2.21C — soft archive de AiAgent.
 * Não usa paranoid. Product filtra archivedAt IS NULL.
 * NÃO executar em produção nesta fase de desenvolvimento.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("AiAgents", "archivedAt", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });
    await queryInterface.addIndex("AiAgents", ["companyId", "archivedAt"], {
      name: "AiAgents_companyId_archivedAt_idx"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "AiAgents",
      "AiAgents_companyId_archivedAt_idx"
    );
    await queryInterface.removeColumn("AiAgents", "archivedAt");
  }
};
