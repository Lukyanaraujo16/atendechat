import { QueryInterface } from "sequelize";

/**
 * Hardening pgvector multidimensão.
 *
 * Substitui a coluna única `embeddingVector vector(1536)` (incompatível com
 * Gemini 768 e OpenAI large 3072) por colunas tipadas:
 *   embeddingVector768  vector(768)
 *   embeddingVector1536 vector(1536)
 *   embeddingVector3072 vector(3072)
 *
 * BYTEA `embedding` permanece a fonte canónica portátil.
 * Não chama providers externos. Seguro se pgvector não existir.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== "postgres") {
      return;
    }

    let pgvectorReady = false;
    try {
      await queryInterface.sequelize.query(
        'CREATE EXTENSION IF NOT EXISTS "vector"'
      );
      pgvectorReady = true;
    } catch {
      pgvectorReady = false;
    }

    if (!pgvectorReady) {
      return;
    }

    // Remover índice/coluna legado vector(1536) universal
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "AiKnowledgeDocumentChunks_embeddingVector_ivfflat_idx"
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "AiKnowledgeDocumentChunks"
      DROP COLUMN IF EXISTS "embeddingVector"
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "AiKnowledgeDocumentChunks"
      ADD COLUMN IF NOT EXISTS "embeddingVector768" vector(768)
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "AiKnowledgeDocumentChunks"
      ADD COLUMN IF NOT EXISTS "embeddingVector1536" vector(1536)
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "AiKnowledgeDocumentChunks"
      ADD COLUMN IF NOT EXISTS "embeddingVector3072" vector(3072)
    `);

    // Índices IVFFlat parciais — podem falhar sem dados suficientes; não bloqueiam.
    const indexes: Array<{ name: string; column: string }> = [
      {
        name: "AiKnowledgeDocumentChunks_embeddingVector768_ivfflat_idx",
        column: "embeddingVector768"
      },
      {
        name: "AiKnowledgeDocumentChunks_embeddingVector1536_ivfflat_idx",
        column: "embeddingVector1536"
      },
      {
        name: "AiKnowledgeDocumentChunks_embeddingVector3072_ivfflat_idx",
        column: "embeddingVector3072"
      }
    ];

    for (const idx of indexes) {
      try {
        await queryInterface.sequelize.query(`
          CREATE INDEX IF NOT EXISTS "${idx.name}"
          ON "AiKnowledgeDocumentChunks"
          USING ivfflat ("${idx.column}" vector_cosine_ops)
          WITH (lists = 100)
          WHERE "${idx.column}" IS NOT NULL AND enabled = true
        `);
      } catch {
        // IVFFlat exige dados / listas — BYTEA continua funcional
      }
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect !== "postgres") {
      return;
    }

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "AiKnowledgeDocumentChunks_embeddingVector768_ivfflat_idx"
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "AiKnowledgeDocumentChunks_embeddingVector1536_ivfflat_idx"
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "AiKnowledgeDocumentChunks_embeddingVector3072_ivfflat_idx"
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "AiKnowledgeDocumentChunks"
      DROP COLUMN IF EXISTS "embeddingVector768"
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "AiKnowledgeDocumentChunks"
      DROP COLUMN IF EXISTS "embeddingVector1536"
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "AiKnowledgeDocumentChunks"
      DROP COLUMN IF EXISTS "embeddingVector3072"
    `);

    // Restaurar coluna legada 1536 (best-effort)
    try {
      await queryInterface.sequelize.query(
        'CREATE EXTENSION IF NOT EXISTS "vector"'
      );
      await queryInterface.sequelize.query(`
        ALTER TABLE "AiKnowledgeDocumentChunks"
        ADD COLUMN IF NOT EXISTS "embeddingVector" vector(1536)
      `);
    } catch {
      // ambiente sem pgvector
    }
  }
};
