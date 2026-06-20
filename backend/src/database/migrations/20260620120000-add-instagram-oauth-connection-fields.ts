import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .addColumn("InstagramAccounts", "connectedVia", {
        type: DataTypes.STRING(32),
        allowNull: true
      })
      .then(() =>
        queryInterface.addColumn("InstagramAccounts", "metaUserId", {
          type: DataTypes.STRING,
          allowNull: true
        })
      )
      .then(() =>
        queryInterface.addColumn("InstagramAccounts", "tokenRefreshedAt", {
          type: DataTypes.DATE,
          allowNull: true
        })
      )
      .then(() =>
        queryInterface.addColumn("InstagramAccounts", "connectionError", {
          type: DataTypes.TEXT,
          allowNull: true
        })
      );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface
      .removeColumn("InstagramAccounts", "connectionError")
      .then(() => queryInterface.removeColumn("InstagramAccounts", "tokenRefreshedAt"))
      .then(() => queryInterface.removeColumn("InstagramAccounts", "metaUserId"))
      .then(() => queryInterface.removeColumn("InstagramAccounts", "connectedVia"));
  }
};
