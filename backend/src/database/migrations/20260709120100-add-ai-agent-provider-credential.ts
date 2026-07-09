import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("AiAgents", "aiProviderCredentialId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "AiProviderCredentials", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("AiAgents", "aiProviderCredentialId");
  }
};
