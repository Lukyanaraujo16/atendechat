import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase IA 2.0.1 — Config de rollout, planner validation e métricas de ativação.
 * Não ativa Orchestrator em produção. Defaults = observe/legacy.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AutomationOrchestratorSettings", {
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
      whatsappId: { type: DataTypes.INTEGER, allowNull: true },
      aiAgentId: { type: DataTypes.INTEGER, allowNull: true },
      controlMode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "observe"
      },
      capabilities: { type: DataTypes.JSON, allowNull: true },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      circuitBreakerOpenUntil: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      updatedBy: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationOrchestratorSettings",
      ["companyId", "whatsappId", "aiAgentId"],
      {
        name: "AutomationOrchestratorSettings_scope_uq",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AutomationOrchestratorSettings",
      ["companyId", "controlMode"],
      { name: "AutomationOrchestratorSettings_company_mode_idx" }
    );

    await queryInterface.createTable("AutomationPlannerValidations", {
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
      whatsappId: { type: DataTypes.INTEGER, allowNull: true },
      messageId: { type: DataTypes.STRING(191), allowNull: true },
      executionId: { type: DataTypes.INTEGER, allowNull: true },
      plannedIntent: { type: DataTypes.STRING(32), allowNull: true },
      plannedActions: { type: DataTypes.JSON, allowNull: true },
      legacyIntent: { type: DataTypes.STRING(32), allowNull: true },
      legacyHandler: { type: DataTypes.STRING(64), allowNull: true },
      legacyResult: { type: DataTypes.STRING(64), allowNull: true },
      matched: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      divergenceSeverity: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "info"
      },
      divergenceReason: { type: DataTypes.STRING(240), allowNull: true },
      processingTimeMs: { type: DataTypes.INTEGER, allowNull: true },
      ownership: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "legacy"
      },
      controlMode: { type: DataTypes.STRING(32), allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationPlannerValidations",
      ["companyId", "createdAt"],
      { name: "AutomationPlannerValidations_company_created_idx" }
    );
    await queryInterface.addIndex(
      "AutomationPlannerValidations",
      ["companyId", "matched", "divergenceSeverity"],
      { name: "AutomationPlannerValidations_company_match_sev_idx" }
    );
    await queryInterface.addIndex(
      "AutomationPlannerValidations",
      ["companyId", "messageId"],
      { name: "AutomationPlannerValidations_company_message_idx" }
    );

    // Colunas extras em AutomationExecutions (safe se já existirem via try)
    const addCol = async (name: string, def: Record<string, unknown>) => {
      try {
        await queryInterface.addColumn("AutomationExecutions", name, def as any);
      } catch {
        // already exists
      }
    };

    await addCol("ownership", {
      type: DataTypes.STRING(16),
      allowNull: true,
      defaultValue: "legacy"
    });
    await addCol("capabilitiesSnapshot", {
      type: DataTypes.JSON,
      allowNull: true
    });
    await addCol("fallbackToLegacy", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await addCol("circuitBreakerTripped", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await addCol("plannerValidationId", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const dropCol = async (name: string) => {
      try {
        await queryInterface.removeColumn("AutomationExecutions", name);
      } catch {
        // ignore
      }
    };
    await dropCol("plannerValidationId");
    await dropCol("circuitBreakerTripped");
    await dropCol("fallbackToLegacy");
    await dropCol("capabilitiesSnapshot");
    await dropCol("ownership");
    await queryInterface.dropTable("AutomationPlannerValidations");
    await queryInterface.dropTable("AutomationOrchestratorSettings");
  }
};
