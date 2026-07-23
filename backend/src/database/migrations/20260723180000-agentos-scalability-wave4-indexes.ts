import { QueryInterface, DataTypes } from "sequelize";

/**
 * Wave 4 — índices e colunas de correlação para Events/Audits/Replays.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const qi = queryInterface;

    const addCol = async (
      table: string,
      column: string,
      def: any
    ) => {
      const desc = await qi.describeTable(table);
      if (!(column in desc)) {
        await qi.addColumn(table, column, def);
      }
    };

    await addCol("AutomationAgentOsEvents", "traceId", {
      type: DataTypes.STRING(96),
      allowNull: true
    });
    await addCol("AutomationAgentOsEvents", "correlationId", {
      type: DataTypes.STRING(96),
      allowNull: true
    });
    await addCol("AutomationAgentOsEvents", "sessionId", {
      type: DataTypes.STRING(128),
      allowNull: true
    });
    await addCol("AutomationAgentOsEvents", "executionId", {
      type: DataTypes.STRING(128),
      allowNull: true
    });
    await addCol("AutomationAgentOsEvents", "severity", {
      type: DataTypes.STRING(16),
      allowNull: true
    });
    await addCol("AutomationAgentOsEvents", "origin", {
      type: DataTypes.STRING(32),
      allowNull: true
    });

    await addCol("AutomationAgentOsAudits", "traceId", {
      type: DataTypes.STRING(96),
      allowNull: true
    });
    await addCol("AutomationAgentOsAudits", "correlationId", {
      type: DataTypes.STRING(96),
      allowNull: true
    });

    await addCol("AutomationAgentOsReplays", "traceId", {
      type: DataTypes.STRING(96),
      allowNull: true
    });
    await addCol("AutomationAgentOsReplays", "executionId", {
      type: DataTypes.STRING(128),
      allowNull: true
    });

    const addIdx = async (table: string, name: string, fields: string[]) => {
      try {
        await qi.addIndex(table, fields, { name });
      } catch {
        /* already exists */
      }
    };

    await addIdx("AutomationAgentOsEvents", "AutomationAgentOsEvents_company_trace_idx", [
      "companyId",
      "traceId"
    ]);
    await addIdx(
      "AutomationAgentOsEvents",
      "AutomationAgentOsEvents_company_corr_idx",
      ["companyId", "correlationId"]
    );
    await addIdx(
      "AutomationAgentOsEvents",
      "AutomationAgentOsEvents_company_session_idx",
      ["companyId", "sessionId"]
    );
    await addIdx("AutomationAgentOsAudits", "AutomationAgentOsAudits_company_trace_idx", [
      "companyId",
      "traceId"
    ]);
    await addIdx("AutomationAgentOsReplays", "AutomationAgentOsReplays_company_trace_idx", [
      "companyId",
      "traceId"
    ]);
    await addIdx(
      "AutomationAgentOsIdempotency",
      "AutomationAgentOsIdempotency_company_expires_idx",
      ["companyId", "expiresAt"]
    );
  },

  down: async (queryInterface: QueryInterface) => {
    const dropIdx = async (table: string, name: string) => {
      try {
        await queryInterface.removeIndex(table, name);
      } catch {
        /* */
      }
    };
    await dropIdx("AutomationAgentOsEvents", "AutomationAgentOsEvents_company_trace_idx");
    await dropIdx("AutomationAgentOsEvents", "AutomationAgentOsEvents_company_corr_idx");
    await dropIdx("AutomationAgentOsEvents", "AutomationAgentOsEvents_company_session_idx");
    await dropIdx("AutomationAgentOsAudits", "AutomationAgentOsAudits_company_trace_idx");
    await dropIdx("AutomationAgentOsReplays", "AutomationAgentOsReplays_company_trace_idx");
    await dropIdx(
      "AutomationAgentOsIdempotency",
      "AutomationAgentOsIdempotency_company_expires_idx"
    );

    const dropCol = async (table: string, column: string) => {
      try {
        await queryInterface.removeColumn(table, column);
      } catch {
        /* */
      }
    };
    for (const col of [
      "traceId",
      "correlationId",
      "sessionId",
      "executionId",
      "severity",
      "origin"
    ]) {
      await dropCol("AutomationAgentOsEvents", col);
    }
    await dropCol("AutomationAgentOsAudits", "traceId");
    await dropCol("AutomationAgentOsAudits", "correlationId");
    await dropCol("AutomationAgentOsReplays", "traceId");
    await dropCol("AutomationAgentOsReplays", "executionId");
  }
};
