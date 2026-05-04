import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CrmDeals", "nextFollowUpAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("CrmDeals", "followUpNote", {
      type: DataTypes.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn("CrmDeals", "followUpNotifiedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CrmDeals", "followUpNotifiedAt");
    await queryInterface.removeColumn("CrmDeals", "followUpNote");
    await queryInterface.removeColumn("CrmDeals", "nextFollowUpAt");
  }
};
