import { QueryInterface, DataTypes } from "sequelize";

/**
 * AgentOS persistence wave 1 — cognitive memory, multi-agent, MCP,
 * and shared typed documents / audits / events / metrics / replays /
 * settings / idempotency tables.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // 1. AutomationCognitiveMemories
    await queryInterface.createTable("AutomationCognitiveMemories", {
      id: {
        type: DataTypes.STRING(64),
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
      memoryType: { type: DataTypes.STRING(32), allowNull: false },
      agentId: { type: DataTypes.INTEGER, allowNull: true },
      ticketId: { type: DataTypes.INTEGER, allowNull: true },
      contactId: { type: DataTypes.INTEGER, allowNull: true },
      goalId: { type: DataTypes.STRING(64), allowNull: true },
      executionId: { type: DataTypes.STRING(64), allowNull: true },
      title: { type: DataTypes.STRING(255), allowNull: false },
      summary: { type: DataTypes.TEXT, allowNull: true },
      content: { type: DataTypes.TEXT, allowNull: true },
      contentEncrypted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      entities: { type: DataTypes.JSON, allowNull: true },
      tags: { type: DataTypes.JSON, allowNull: true },
      confidence: { type: DataTypes.FLOAT, allowNull: true },
      importance: { type: DataTypes.FLOAT, allowNull: true },
      source: { type: DataTypes.STRING(64), allowNull: true },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    });

    await queryInterface.addIndex(
      "AutomationCognitiveMemories",
      ["companyId", "memoryType"],
      { name: "AutomationCognitiveMemories_company_memoryType_idx" }
    );
    await queryInterface.addIndex(
      "AutomationCognitiveMemories",
      ["companyId", "agentId"],
      { name: "AutomationCognitiveMemories_company_agentId_idx" }
    );
    await queryInterface.addIndex(
      "AutomationCognitiveMemories",
      ["companyId", "ticketId"],
      { name: "AutomationCognitiveMemories_company_ticketId_idx" }
    );
    await queryInterface.addIndex(
      "AutomationCognitiveMemories",
      ["companyId", "contactId"],
      { name: "AutomationCognitiveMemories_company_contactId_idx" }
    );
    await queryInterface.addIndex(
      "AutomationCognitiveMemories",
      ["companyId", "updatedAt"],
      { name: "AutomationCognitiveMemories_company_updatedAt_idx" }
    );
    await queryInterface.addIndex(
      "AutomationCognitiveMemories",
      ["companyId", "importance"],
      { name: "AutomationCognitiveMemories_company_importance_idx" }
    );

    // 2. AutomationMultiAgents
    await queryInterface.createTable("AutomationMultiAgents", {
      id: {
        type: DataTypes.STRING(64),
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
      slug: { type: DataTypes.STRING(128), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      status: { type: DataTypes.STRING(32), allowNull: false },
      role: { type: DataTypes.STRING(32), allowNull: false },
      specialization: { type: DataTypes.STRING(32), allowNull: true },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      isCoordinator: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      payload: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    });

    await queryInterface.addIndex(
      "AutomationMultiAgents",
      ["companyId", "slug"],
      {
        name: "AutomationMultiAgents_company_slug_uq",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AutomationMultiAgents",
      ["companyId", "status"],
      { name: "AutomationMultiAgents_company_status_idx" }
    );
    await queryInterface.addIndex(
      "AutomationMultiAgents",
      ["companyId", "role"],
      { name: "AutomationMultiAgents_company_role_idx" }
    );

    // 3. AutomationMultiAgentVersions
    await queryInterface.createTable("AutomationMultiAgentVersions", {
      id: {
        type: DataTypes.STRING(64),
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
      agentId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        references: { model: "AutomationMultiAgents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      version: { type: DataTypes.INTEGER, allowNull: false },
      snapshot: { type: DataTypes.JSON, allowNull: false },
      changeSummary: { type: DataTypes.STRING(255), allowNull: true },
      changedBy: { type: DataTypes.INTEGER, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationMultiAgentVersions",
      ["companyId", "agentId", "version"],
      {
        name: "AutomationMultiAgentVersions_company_agent_version_uq",
        unique: true
      }
    );

    // 4. AutomationMultiAgentSessions
    await queryInterface.createTable("AutomationMultiAgentSessions", {
      id: {
        type: DataTypes.STRING(64),
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
      rootSessionId: { type: DataTypes.STRING(64), allowNull: false },
      parentSessionId: { type: DataTypes.STRING(64), allowNull: true },
      agentId: { type: DataTypes.STRING(64), allowNull: false },
      agentVersion: { type: DataTypes.INTEGER, allowNull: true },
      supervisorAgentId: { type: DataTypes.STRING(64), allowNull: true },
      delegatedByAgentId: { type: DataTypes.STRING(64), allowNull: true },
      delegationDepth: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      handoffCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      routingDecisionId: { type: DataTypes.STRING(64), allowNull: true },
      contextBoundaryId: { type: DataTypes.STRING(64), allowNull: true },
      status: { type: DataTypes.STRING(64), allowNull: false },
      payload: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    });

    await queryInterface.addIndex(
      "AutomationMultiAgentSessions",
      ["companyId", "agentId"],
      { name: "AutomationMultiAgentSessions_company_agentId_idx" }
    );
    await queryInterface.addIndex(
      "AutomationMultiAgentSessions",
      ["companyId", "rootSessionId"],
      { name: "AutomationMultiAgentSessions_company_rootSession_idx" }
    );
    await queryInterface.addIndex(
      "AutomationMultiAgentSessions",
      ["companyId", "status"],
      { name: "AutomationMultiAgentSessions_company_status_idx" }
    );

    // 5. AutomationMcpServers
    await queryInterface.createTable("AutomationMcpServers", {
      id: {
        type: DataTypes.STRING(64),
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
      name: { type: DataTypes.STRING(255), allowNull: false },
      slug: { type: DataTypes.STRING(128), allowNull: false },
      status: { type: DataTypes.STRING(32), allowNull: false },
      transport: { type: DataTypes.STRING(32), allowNull: false },
      payload: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    });

    await queryInterface.addIndex(
      "AutomationMcpServers",
      ["companyId", "slug"],
      {
        name: "AutomationMcpServers_company_slug_uq",
        unique: true
      }
    );

    // 6. AutomationMcpCredentials
    await queryInterface.createTable("AutomationMcpCredentials", {
      id: {
        type: DataTypes.STRING(64),
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
      name: { type: DataTypes.STRING(255), allowNull: false },
      authType: { type: DataTypes.STRING(32), allowNull: false },
      encryptedPayload: { type: DataTypes.TEXT, allowNull: false },
      maskedPreview: { type: DataTypes.STRING(64), allowNull: true },
      payload: { type: DataTypes.JSON, allowNull: true },
      createdBy: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    });

    await queryInterface.addIndex(
      "AutomationMcpCredentials",
      ["companyId", "authType"],
      { name: "AutomationMcpCredentials_company_authType_idx" }
    );

    // 7. AutomationMcpTools
    await queryInterface.createTable("AutomationMcpTools", {
      id: {
        type: DataTypes.STRING(64),
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
      serverId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(191), allowNull: false },
      payload: { type: DataTypes.JSON, allowNull: true },
      schemaHash: { type: DataTypes.STRING(64), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    });

    await queryInterface.addIndex(
      "AutomationMcpTools",
      ["companyId", "serverId", "name"],
      {
        name: "AutomationMcpTools_company_server_name_uq",
        unique: true
      }
    );

    // 8. AutomationAgentOsDocuments
    await queryInterface.createTable("AutomationAgentOsDocuments", {
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
      entityType: { type: DataTypes.STRING(64), allowNull: false },
      entityKey: { type: DataTypes.STRING(128), allowNull: false },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      payload: { type: DataTypes.JSON, allowNull: false },
      status: { type: DataTypes.STRING(32), allowNull: true },
      agentId: { type: DataTypes.STRING(64), allowNull: true },
      sessionId: { type: DataTypes.STRING(64), allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    });

    await queryInterface.addIndex(
      "AutomationAgentOsDocuments",
      ["companyId", "entityType", "entityKey"],
      {
        name: "AutomationAgentOsDocuments_company_entity_key_uq",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsDocuments",
      ["companyId", "entityType", "createdAt"],
      { name: "AutomationAgentOsDocuments_company_entity_created_idx" }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsDocuments",
      ["companyId", "sessionId"],
      { name: "AutomationAgentOsDocuments_company_sessionId_idx" }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsDocuments",
      ["companyId", "agentId"],
      { name: "AutomationAgentOsDocuments_company_agentId_idx" }
    );

    // 9. AutomationAgentOsAudits
    await queryInterface.createTable("AutomationAgentOsAudits", {
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
      moduleKey: { type: DataTypes.STRING(64), allowNull: false },
      action: { type: DataTypes.STRING(64), allowNull: false },
      agentId: { type: DataTypes.STRING(64), allowNull: true },
      sessionId: { type: DataTypes.STRING(64), allowNull: true },
      userId: { type: DataTypes.INTEGER, allowNull: true },
      previousState: { type: DataTypes.STRING(64), allowNull: true },
      newState: { type: DataTypes.STRING(64), allowNull: true },
      reasonCodes: { type: DataTypes.JSON, allowNull: true },
      payloadSanitized: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationAgentOsAudits",
      ["companyId", "createdAt"],
      { name: "AutomationAgentOsAudits_company_created_idx" }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsAudits",
      ["companyId", "agentId"],
      { name: "AutomationAgentOsAudits_company_agentId_idx" }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsAudits",
      ["companyId", "sessionId"],
      { name: "AutomationAgentOsAudits_company_sessionId_idx" }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsAudits",
      ["companyId", "moduleKey"],
      { name: "AutomationAgentOsAudits_company_moduleKey_idx" }
    );

    // 10. AutomationAgentOsEvents
    await queryInterface.createTable("AutomationAgentOsEvents", {
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
      moduleKey: { type: DataTypes.STRING(64), allowNull: false },
      eventName: { type: DataTypes.STRING(96), allowNull: false },
      entityId: { type: DataTypes.STRING(128), allowNull: true },
      payload: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationAgentOsEvents",
      ["companyId", "createdAt"],
      { name: "AutomationAgentOsEvents_company_created_idx" }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsEvents",
      ["companyId", "eventName"],
      { name: "AutomationAgentOsEvents_company_eventName_idx" }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsEvents",
      ["companyId", "moduleKey"],
      { name: "AutomationAgentOsEvents_company_moduleKey_idx" }
    );

    // 11. AutomationAgentOsMetrics
    await queryInterface.createTable("AutomationAgentOsMetrics", {
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
      moduleKey: { type: DataTypes.STRING(64), allowNull: false },
      metricKey: { type: DataTypes.STRING(96), allowNull: false },
      metricValue: { type: DataTypes.FLOAT, allowNull: false },
      dimensions: { type: DataTypes.JSON, allowNull: true },
      periodStart: { type: DataTypes.DATE, allowNull: true },
      periodEnd: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationAgentOsMetrics",
      ["companyId", "moduleKey", "metricKey", "periodStart"],
      {
        name: "AutomationAgentOsMetrics_company_module_metric_period_uq",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsMetrics",
      ["companyId", "createdAt"],
      { name: "AutomationAgentOsMetrics_company_created_idx" }
    );

    // 12. AutomationAgentOsReplays
    await queryInterface.createTable("AutomationAgentOsReplays", {
      id: {
        type: DataTypes.STRING(64),
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
      moduleKey: { type: DataTypes.STRING(64), allowNull: false },
      sourceId: { type: DataTypes.STRING(128), allowNull: true },
      sessionId: { type: DataTypes.STRING(64), allowNull: true },
      agentId: { type: DataTypes.STRING(64), allowNull: true },
      payload: { type: DataTypes.JSON, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    });

    await queryInterface.addIndex(
      "AutomationAgentOsReplays",
      ["companyId", "moduleKey"],
      { name: "AutomationAgentOsReplays_company_moduleKey_idx" }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsReplays",
      ["companyId", "sessionId"],
      { name: "AutomationAgentOsReplays_company_sessionId_idx" }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsReplays",
      ["companyId", "createdAt"],
      { name: "AutomationAgentOsReplays_company_created_idx" }
    );

    // 13. AutomationAgentOsSettings
    await queryInterface.createTable("AutomationAgentOsSettings", {
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
      moduleKey: { type: DataTypes.STRING(64), allowNull: false },
      config: { type: DataTypes.JSON, allowNull: false },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      updatedBy: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationAgentOsSettings",
      ["companyId", "moduleKey"],
      {
        name: "AutomationAgentOsSettings_company_moduleKey_uq",
        unique: true
      }
    );

    // 14. AutomationAgentOsIdempotency
    await queryInterface.createTable("AutomationAgentOsIdempotency", {
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
      idempotencyKey: { type: DataTypes.STRING(191), allowNull: false },
      entityType: { type: DataTypes.STRING(64), allowNull: false },
      entityId: { type: DataTypes.STRING(128), allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex(
      "AutomationAgentOsIdempotency",
      ["companyId", "idempotencyKey"],
      {
        name: "AutomationAgentOsIdempotency_company_key_uq",
        unique: true
      }
    );
    await queryInterface.addIndex(
      "AutomationAgentOsIdempotency",
      ["expiresAt"],
      { name: "AutomationAgentOsIdempotency_expiresAt_idx" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("AutomationAgentOsIdempotency");
    await queryInterface.dropTable("AutomationAgentOsSettings");
    await queryInterface.dropTable("AutomationAgentOsReplays");
    await queryInterface.dropTable("AutomationAgentOsMetrics");
    await queryInterface.dropTable("AutomationAgentOsEvents");
    await queryInterface.dropTable("AutomationAgentOsAudits");
    await queryInterface.dropTable("AutomationAgentOsDocuments");
    await queryInterface.dropTable("AutomationMcpTools");
    await queryInterface.dropTable("AutomationMcpCredentials");
    await queryInterface.dropTable("AutomationMcpServers");
    await queryInterface.dropTable("AutomationMultiAgentSessions");
    await queryInterface.dropTable("AutomationMultiAgentVersions");
    await queryInterface.dropTable("AutomationMultiAgents");
    await queryInterface.dropTable("AutomationCognitiveMemories");
  }
};
