import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Whatsapps", "sendGreetingAccepted", {
        type: DataTypes.STRING(16),
        allowNull: true,
        defaultValue: null
      }),
      queryInterface.addColumn("Whatsapps", "sendMsgTransfTicket", {
        type: DataTypes.STRING(16),
        allowNull: true,
        defaultValue: null
      }),
      queryInterface.addColumn("Whatsapps", "sendGreetingMessageOneQueues", {
        type: DataTypes.STRING(16),
        allowNull: true,
        defaultValue: null
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Whatsapps", "sendGreetingAccepted"),
      queryInterface.removeColumn("Whatsapps", "sendMsgTransfTicket"),
      queryInterface.removeColumn("Whatsapps", "sendGreetingMessageOneQueues")
    ]);
  }
};
