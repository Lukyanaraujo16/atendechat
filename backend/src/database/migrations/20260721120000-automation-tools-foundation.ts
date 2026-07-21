import { QueryInterface, DataTypes } from "sequelize";

/**
 * Fase IA 2.1A — Automation Tools foundation.
 * Feature desabilitada por padrão. Nenhuma Tool operacional.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AutomationToolExecutions", {
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
      toolId: { type: DataTypes.STRING(128), allowNull: false },
      toolVersion: { type: DataTypes.STRING(32), allowNull: false },
      category: { type: DataTypes.STRING(64), allowNull: true },
      source: { type: DataTypes.STRING(32), allowNull: false },
      riskLevel: { type: DataTypes.STRING(32), allowNull: false },
      sideEffectType: { type: DataTypes.STRING(32), allowNull: false },
      status: { type: DataTypes.STRING(32), allowNull: false },
      controlMode: { type: DataTypes.STRING(32), allowNull: false },
      executionOwner: { type: DataTypes.STRING(32), allowNull: true },
      automationExecutionId: { type: DataTypes.INTEGER, allowNull: true },
      actionExecutionId: { type: DataTypes.STRING(64), allowNull: true },
      ticketId: { type: DataTypes.INTEGER, allowNull: true },
      contactId: { type: DataTypes.INTEGER, allowNull: true },
      messageId: { type: DataTypes.STRING(191), allowNull: true },
      requestId: { type: DataTypes.STRING(64), allowNull: true },
      correlationId: { type: DataTypes.STRING(64), allowNull: true },
      idempotencyKey: { type: DataTypes.STRING(64), allowNull: true },
      inputSnapshot: { type: DataTypes.JSON, allowNull: true },
      outputSnapshot: { type: DataTypes.JSON, allowNull: true },
      errorSnapshot: { type: DataTypes.JSON, allowNull: true },
      attemptCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      timeoutMs: { type: DataTypes.INTEGER, allowNull: true },
      durationMs: { type: DataTypes.INTEGER, allowNull: true },
      confirmationStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "none"
      },
      sideEffectCommitted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      rollbackStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "none"
      },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationToolExecutions",
      ["companyId", "toolId", "status"],
      { name: "AutomationToolExecutions_company_tool_status_idx" }
    );
    await queryInterface.addIndex(
      "AutomationToolExecutions",
      ["companyId", "createdAt"],
      { name: "AutomationToolExecutions_company_created_idx" }
    );
    await queryInterface.addIndex(
      "AutomationToolExecutions",
      ["companyId", "automationExecutionId"],
      { name: "AutomationToolExecutions_company_automation_idx" }
    );
    await queryInterface.addIndex(
      "AutomationToolExecutions",
      ["companyId", "ticketId"],
      { name: "AutomationToolExecutions_company_ticket_idx" }
    );
    await queryInterface.addIndex(
      "AutomationToolExecutions",
      ["companyId", "messageId"],
      { name: "AutomationToolExecutions_company_message_idx" }
    );
    await queryInterface.addIndex(
      "AutomationToolExecutions",
      ["companyId", "toolId", "idempotencyKey"],
      {
        name: "AutomationToolExecutions_company_tool_idem_uq",
        unique: true
      }
    );

    await queryInterface.createTable("AutomationToolPolicies", {
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
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      maxRiskLevel: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "read_only"
      },
      allowWrite: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      requireConfirmationFor: { type: DataTypes.JSON, allowNull: true },
      deniedToolIds: { type: DataTypes.JSON, allowNull: true },
      allowedToolIds: { type: DataTypes.JSON, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      updatedBy: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex("AutomationToolPolicies", ["companyId"], {
      name: "AutomationToolPolicies_company_uq",
      unique: true
    });

    await queryInterface.createTable("AutomationToolConfirmations", {
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
      toolExecutionId: { type: DataTypes.INTEGER, allowNull: true },
      toolId: { type: DataTypes.STRING(128), allowNull: false },
      toolVersion: { type: DataTypes.STRING(32), allowNull: false },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "pending"
      },
      policy: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "policy_based"
      },
      requestedBy: { type: DataTypes.INTEGER, allowNull: true },
      resolvedBy: { type: DataTypes.INTEGER, allowNull: true },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationToolConfirmations",
      ["companyId", "status"],
      { name: "AutomationToolConfirmations_company_status_idx" }
    );
    await queryInterface.addIndex(
      "AutomationToolConfirmations",
      ["companyId", "toolExecutionId"],
      { name: "AutomationToolConfirmations_company_tool_exec_idx" }
    );

    // Feature flag: desabilitada para todos os planos existentes
    const FEATURE_KEY = "automation.ai_tools";
    const dialect = queryInterface.sequelize.getDialect();
    const replacements = { featureKey: FEATURE_KEY };

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        `
        INSERT INTO "PlanFeatures" ("planId", "featureKey", "enabled", "createdAt", "updatedAt")
        SELECT p.id, :featureKey, false, NOW(), NOW()
        FROM "Plans" p
        WHERE NOT EXISTS (
          SELECT 1 FROM "PlanFeatures" pf
          WHERE pf."planId" = p.id AND pf."featureKey" = :featureKey
        )
        `,
        { replacements }
      );
    } else {
      await queryInterface.sequelize.query(
        `
        INSERT INTO PlanFeatures (planId, featureKey, enabled, createdAt, updatedAt)
        SELECT p.id, :featureKey, 0, NOW(), NOW()
        FROM Plans p
        WHERE NOT EXISTS (
          SELECT 1 FROM PlanFeatures pf
          WHERE pf.planId = p.id AND pf.featureKey = :featureKey
        )
        `,
        { replacements }
      );
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AutomationToolConfirmations");
    await queryInterface.dropTable("AutomationToolPolicies");
    await queryInterface.dropTable("AutomationToolExecutions");

    const FEATURE_KEY = "automation.ai_tools";
    const dialect = queryInterface.sequelize.getDialect();
    const replacements = { featureKey: FEATURE_KEY };

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        `DELETE FROM "PlanFeatures" WHERE "featureKey" = :featureKey`,
        { replacements }
      );
    } else {
      await queryInterface.sequelize.query(
        `DELETE FROM PlanFeatures WHERE featureKey = :featureKey`,
        { replacements }
      );
    }
  }
};
