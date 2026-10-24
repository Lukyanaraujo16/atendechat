import { QueryInterface, QueryTypes } from "sequelize";

/**
 * Estoque e Vendas — exclusão definitiva de produto com histórico de vendas.
 *
 * InventorySaleItems.productId passa a aceitar NULL: o item histórico de venda concluída/cancelada
 * fica desvinculado do cadastro excluído, preservando o snapshot (productName, productSku, preços,
 * quantidade, totais). A FK continua RESTRICT: só o serviço de exclusão desvincula, de forma explícita.
 * Não altera nenhuma linha.
 *
 * `down` volta para NOT NULL só se não houver item desvinculado; havendo, para com erro (restaurar
 * exigiria inventar um produto para histórico financeiro) e nada é alterado.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE "InventorySaleItems" ALTER COLUMN "productId" DROP NOT NULL`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    const rows = await queryInterface.sequelize.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM "InventorySaleItems" WHERE "productId" IS NULL`,
      { type: QueryTypes.SELECT }
    );
    const total = Number(rows[0]?.total || 0);
    if (total > 0) {
      throw new Error(
        `[InventorySaleItems.productId] ${total} item(ns) de venda de produtos excluídos; ` +
          "não é possível voltar para NOT NULL sem perder histórico (nada foi alterado)."
      );
    }
    await queryInterface.sequelize.query(
      `ALTER TABLE "InventorySaleItems" ALTER COLUMN "productId" SET NOT NULL`
    );
  }
};
