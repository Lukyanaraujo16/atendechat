import { QueryInterface } from "sequelize";

/**
 * Queues tinham UNIQUE só em `name` e `color` (globais). Passa a unicidade
 * composta (companyId, name) e (companyId, color). Deduplica antes.
 *
 * Usa CREATE UNIQUE INDEX em SQL cru (evita falhas do addConstraint do Sequelize 5
 * em alguns Postgres) e DROP INDEX/CONSTRAINT IF EXISTS para reexecução segura.
 *
 * PostgreSQL: DROP/ALTER em constraints exige ser **dono da tabela**. O utilizador
 * em DB_USER tem de ser owner de `Queues` (ou migrar como superuser). Se aparecer
 * "must be owner of table Queues", ver DEPLOY-UBUNTU.md (migrações / ownership).
 */
async function runStep(
  label: string,
  fn: () => PromiseLike<unknown>
): Promise<void> {
  try {
    await fn();
  } catch (err: unknown) {
    const e = err as Error;
    let hint = "";
    if (/must be owner of table/i.test(e.message)) {
      hint =
        " [PostgreSQL: o utilizador do .env (DB_USER) precisa ser dono da tabela. Como postgres: ALTER TABLE \"Queues\" OWNER TO \"SEU_DB_USER\"; — ver DEPLOY-UBUNTU.md]";
    }
    e.message = `[20260415120000-queues-unique-per-company: ${label}] ${e.message}${hint}`;
    throw e;
  }
}

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;

    // 1) Mesmo nome na mesma empresa (case-insensitive)
    await runStep("dedupe-names", () =>
      sequelize.query(`
      UPDATE "Queues" q
      SET name = LEFT(COALESCE(TRIM(q.name), '') || ' (' || q.id::text || ')', 255)
      FROM (
        SELECT id
        FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY "companyId", LOWER(TRIM(COALESCE(name, '')))
              ORDER BY id
            ) AS rn
          FROM "Queues"
          WHERE "companyId" IS NOT NULL
        ) t
        WHERE t.rn > 1
      ) d
      WHERE q.id = d.id
    `)
    );

    // 2) Mesma cor na mesma empresa
    await runStep("dedupe-colors", () =>
      sequelize.query(`
      UPDATE "Queues" q
      SET color = '#' || SUBSTRING(MD5(q.id::text || COALESCE(q.color, '')) FROM 1 FOR 6)
      FROM (
        SELECT id
        FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY "companyId", color
              ORDER BY id
            ) AS rn
          FROM "Queues"
          WHERE "companyId" IS NOT NULL
        ) t
        WHERE t.rn > 1
      ) d
      WHERE q.id = d.id
    `)
    );

    // 3) Remove unicidades globais e índices/constraints compostos antigos (re-run seguro)
    await runStep("drop-old-globals", async () => {
      for (const sql of [
        `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_name_key";`,
        `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_color_key";`,
        `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_name_key1";`,
        `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_color_key1";`
      ]) {
        await sequelize.query(sql);
      }
    });

    await runStep("drop-composite-if-any", async () => {
      for (const sql of [
        `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_companyId_name_key";`,
        `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_companyId_color_key";`,
        `DROP INDEX IF EXISTS "Queues_companyId_name_key";`,
        `DROP INDEX IF EXISTS "Queues_companyId_color_key";`
      ]) {
        await sequelize.query(sql);
      }
    });

    // 4) Unicidade por empresa (índice único explícito — mesmo nome do modelo Sequelize)
    await runStep("create-unique-companyId-name", () =>
      sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Queues_companyId_name_key"
        ON "Queues" ("companyId", "name");
    `)
    );

    await runStep("create-unique-companyId-color", () =>
      sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Queues_companyId_color_key"
        ON "Queues" ("companyId", "color");
    `)
    );
  },

  down: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;

    await runStep("down-drop-composite-indexes", async () => {
      for (const sql of [
        `DROP INDEX IF EXISTS "Queues_companyId_name_key";`,
        `DROP INDEX IF EXISTS "Queues_companyId_color_key";`,
        `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_companyId_name_key";`,
        `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_companyId_color_key";`
      ]) {
        await sequelize.query(sql);
      }
    });

    await runStep("down-add-global-uniques", () =>
      Promise.all([
        queryInterface.addConstraint("Queues", ["name"], {
          type: "unique",
          name: "Queues_name_key"
        }),
        queryInterface.addConstraint("Queues", ["color"], {
          type: "unique",
          name: "Queues_color_key"
        })
      ])
    );
  }
};
