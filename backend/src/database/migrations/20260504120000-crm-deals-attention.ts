import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CrmDeals", "attentionAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("CrmDeals", "attentionReason", {
      type: DataTypes.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn("CrmDeals", "attentionNotifiedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CrmDeals", "attentionNotifiedAt");
    await queryInterface.removeColumn("CrmDeals", "attentionReason");
    await queryInterface.removeColumn("CrmDeals", "attentionAt");
  }
};
