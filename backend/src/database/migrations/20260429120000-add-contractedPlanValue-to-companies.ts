import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Companies", "contractedPlanValue", {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Companies", "contractedPlanValue");
  }
};
