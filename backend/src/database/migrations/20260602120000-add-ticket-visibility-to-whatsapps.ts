import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addColumn("Whatsapps", "ticketVisibility", {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "all"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Whatsapps", "ticketVisibility");
  }
};
