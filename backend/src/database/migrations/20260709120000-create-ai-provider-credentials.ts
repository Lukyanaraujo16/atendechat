import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AiProviderCredentials", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      provider: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "openai"
      },
      apiKeyEncrypted: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      apiKeyMasked: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex(
      "AiProviderCredentials",
      ["companyId", "enabled"],
      { name: "AiProviderCredentials_companyId_enabled_idx" }
    );
    await queryInterface.addIndex(
      "AiProviderCredentials",
      ["companyId", "isDefault"],
      { name: "AiProviderCredentials_companyId_isDefault_idx" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AiProviderCredentials");
  }
};
