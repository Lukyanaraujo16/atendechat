import { QueryInterface } from "sequelize";

/**
 * Hardening 1.5.2D: índices + unique de idempotência em AiKnowledgeRetrievals.
 * Não ativa RAG. Safe se índices já existirem.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const qi = queryInterface.sequelize;

    const tryIndex = async (sql: string) => {
      try {
        await qi.query(sql);
      } catch {
        // índice/coluna pode já existir
      }
    };

    await tryIndex(`
      CREATE INDEX IF NOT EXISTS "AiAgentKnowledgeBases_knowledgeBaseId_idx"
      ON "AiAgentKnowledgeBases" ("knowledgeBaseId")
    `);
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS "AiAgentKnowledgeBases_aiAgentId_idx"
      ON "AiAgentKnowledgeBases" ("aiAgentId")
    `);
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS "AiAgentKnowledgeBases_companyId_idx"
      ON "AiAgentKnowledgeBases" ("companyId")
    `);

    await tryIndex(`
      CREATE INDEX IF NOT EXISTS "AiAgentKnowledgeSettings_companyId_idx"
      ON "AiAgentKnowledgeSettings" ("companyId")
    `);
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS "AiAgentKnowledgeSettings_aiAgentId_idx"
      ON "AiAgentKnowledgeSettings" ("aiAgentId")
    `);

    await tryIndex(`
      CREATE INDEX IF NOT EXISTS "AiKnowledgeRetrievals_ticketId_idx"
      ON "AiKnowledgeRetrievals" ("ticketId")
    `);
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS "AiKnowledgeRetrievals_messageId_idx"
      ON "AiKnowledgeRetrievals" ("messageId")
    `);
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS "AiKnowledgeRetrievals_simulationSessionId_idx"
      ON "AiKnowledgeRetrievals" ("simulationSessionId")
    `);
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS "AiKnowledgeRetrievals_shadowSuggestionId_idx"
      ON "AiKnowledgeRetrievals" ("shadowSuggestionId")
    `);
    await tryIndex(`
      CREATE INDEX IF NOT EXISTS "AiKnowledgeRetrievals_createdAt_idx"
      ON "AiKnowledgeRetrievals" ("createdAt")
    `);

    // Unique parcial / composto para idempotência (company + channel + requestId)
    // MySQL não tem IF NOT EXISTS em unique da mesma forma — try/catch.
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await tryIndex(`
        CREATE UNIQUE INDEX IF NOT EXISTS "AiKnowledgeRetrievals_company_channel_requestId_uq"
        ON "AiKnowledgeRetrievals" ("companyId", "channel", "requestId")
        WHERE "requestId" IS NOT NULL
      `);
    } else {
      await tryIndex(`
        CREATE UNIQUE INDEX AiKnowledgeRetrievals_company_channel_requestId_uq
        ON AiKnowledgeRetrievals (companyId, channel, requestId)
      `);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const drop = async (name: string) => {
      try {
        await queryInterface.removeIndex("AiKnowledgeRetrievals", name);
      } catch {
        try {
          await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${name}"`);
        } catch {
          // ignore
        }
      }
    };
    await drop("AiKnowledgeRetrievals_company_channel_requestId_uq");
    await drop("AiKnowledgeRetrievals_ticketId_idx");
    await drop("AiKnowledgeRetrievals_messageId_idx");
    await drop("AiKnowledgeRetrievals_simulationSessionId_idx");
    await drop("AiKnowledgeRetrievals_shadowSuggestionId_idx");
    await drop("AiKnowledgeRetrievals_createdAt_idx");
    try {
      await queryInterface.removeIndex(
        "AiAgentKnowledgeBases",
        "AiAgentKnowledgeBases_knowledgeBaseId_idx"
      );
    } catch {
      // ignore
    }
  }
};
