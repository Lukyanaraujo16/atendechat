import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase IA 2.0 — Automation Orchestrator.
 * Não altera chatbot/fluxos/live. Execuções em observe por padrão.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AutomationExecutions", {
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
      ticketId: { type: DataTypes.INTEGER, allowNull: true },
      contactId: { type: DataTypes.INTEGER, allowNull: true },
      whatsappId: { type: DataTypes.INTEGER, allowNull: true },
      channel: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "whatsapp"
      },
      messageId: { type: DataTypes.STRING(191), allowNull: true },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "queued"
      },
      controlMode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "observe"
      },
      plannerVersion: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "2.0.0"
      },
      currentStep: { type: DataTypes.INTEGER, allowNull: true },
      intent: { type: DataTypes.STRING(32), allowNull: true },
      executionContext: { type: DataTypes.JSON, allowNull: true },
      plan: { type: DataTypes.JSON, allowNull: true },
      graph: { type: DataTypes.JSON, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      errorCode: { type: DataTypes.STRING(64), allowNull: true },
      errorMessage: { type: DataTypes.STRING(500), allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationExecutions",
      ["companyId", "ticketId", "status"],
      { name: "AutomationExecutions_company_ticket_status_idx" }
    );
    await queryInterface.addIndex(
      "AutomationExecutions",
      ["companyId", "createdAt"],
      { name: "AutomationExecutions_company_created_idx" }
    );
    await queryInterface.addIndex(
      "AutomationExecutions",
      ["companyId", "messageId"],
      { name: "AutomationExecutions_company_messageId_idx" }
    );
    // Idempotência: uma execução por mensagem (quando messageId presente)
    await queryInterface.addIndex(
      "AutomationExecutions",
      ["companyId", "channel", "messageId"],
      {
        name: "AutomationExecutions_company_channel_message_uq",
        unique: true
      }
    );

    await queryInterface.createTable("AutomationExecutionSteps", {
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
      executionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AutomationExecutions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      stepIndex: { type: DataTypes.INTEGER, allowNull: false },
      actionName: { type: DataTypes.STRING(64), allowNull: false },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "pending"
      },
      resultStatus: { type: DataTypes.STRING(32), allowNull: true },
      inputPreview: { type: DataTypes.JSON, allowNull: true },
      outputPreview: { type: DataTypes.JSON, allowNull: true },
      errorCode: { type: DataTypes.STRING(64), allowNull: true },
      errorMessage: { type: DataTypes.STRING(500), allowNull: true },
      durationMs: { type: DataTypes.INTEGER, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationExecutionSteps",
      ["companyId", "executionId", "stepIndex"],
      {
        name: "AutomationExecutionSteps_company_exec_step_uq",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AutomationExecutionSteps",
      ["companyId", "actionName"],
      { name: "AutomationExecutionSteps_company_action_idx" }
    );

    await queryInterface.createTable("AutomationExecutionEvents", {
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
      executionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AutomationExecutions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      stepId: { type: DataTypes.INTEGER, allowNull: true },
      eventName: { type: DataTypes.STRING(64), allowNull: false },
      payload: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationExecutionEvents",
      ["companyId", "executionId", "createdAt"],
      { name: "AutomationExecutionEvents_company_exec_created_idx" }
    );
    await queryInterface.addIndex(
      "AutomationExecutionEvents",
      ["companyId", "eventName"],
      { name: "AutomationExecutionEvents_company_event_idx" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AutomationExecutionEvents");
    await queryInterface.dropTable("AutomationExecutionSteps");
    await queryInterface.dropTable("AutomationExecutions");
  }
};
