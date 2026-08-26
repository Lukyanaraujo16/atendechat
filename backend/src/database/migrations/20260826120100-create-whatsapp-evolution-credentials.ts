import { QueryInterface, DataTypes } from "sequelize";

/**
 * Credenciais Evolution por conexão WhatsApp.
 * API key apenas cifrada (apiKeyEncrypted) + máscara (apiKeyMasked).
 * NÃO usar Whatsapps.token (contrato Bearer da API externa).
 *
 * NÃO executar nesta fase — apenas criar o arquivo.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("WhatsappEvolutionCredentials", {
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
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      baseUrl: {
        type: DataTypes.STRING(512),
        allowNull: false
      },
      instanceName: {
        type: DataTypes.STRING(120),
        allowNull: false
      },
      instanceId: {
        type: DataTypes.STRING(120),
        allowNull: true
      },
      apiKeyEncrypted: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      apiKeyMasked: {
        type: DataTypes.STRING(64),
        allowNull: false
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
      "WhatsappEvolutionCredentials",
      ["companyId"],
      { name: "WhatsappEvolutionCredentials_companyId_idx" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("WhatsappEvolutionCredentials");
  }
};
