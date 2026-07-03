import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("AiAgentRuntimeLogs", "messageId", {
      type: DataTypes.STRING(191),
      allowNull: true
    });

    await queryInterface.addIndex(
      "AiAgentRuntimeLogs",
      ["companyId", "whatsappId", "channel", "messageId"],
      {
        name: "AiAgentRuntimeLogs_idempotency_uq",
        unique: true
      }
    );

    await queryInterface.addIndex(
      "AiAgentRuntimeLogs",
      ["aiAgentId", "createdAt"],
      {
        name: "AiAgentRuntimeLogs_aiAgentId_createdAt_idx"
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "AiAgentRuntimeLogs",
      "AiAgentRuntimeLogs_aiAgentId_createdAt_idx"
    );
    await queryInterface.removeIndex(
      "AiAgentRuntimeLogs",
      "AiAgentRuntimeLogs_idempotency_uq"
    );
    await queryInterface.removeColumn("AiAgentRuntimeLogs", "messageId");
  }
};
