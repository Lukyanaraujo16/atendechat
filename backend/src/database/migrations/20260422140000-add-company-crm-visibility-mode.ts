import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn(
        "Companies",
        "crmVisibilityMode",
        {
          type: DataTypes.STRING(16),
          allowNull: false,
          defaultValue: "all"
        },
        { transaction: t }
      );
    }),

  down: (queryInterface: QueryInterface) =>
    queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.removeColumn("Companies", "crmVisibilityMode", {
        transaction: t
      });
    })
};
