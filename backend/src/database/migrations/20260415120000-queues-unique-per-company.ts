import { QueryInterface } from "sequelize";

/**
 * Queues tinham UNIQUE só em `name` e `color` (globais), o que impede duas empresas
 * usarem o mesmo nome de setor. Passa a unicidade composta (companyId, name) e
 * (companyId, color). Antes, deduplica linhas na mesma empresa com mesmo nome/cor.
 *
 * Sem transação única: em PostgreSQL, um erro (ex.: DROP CONSTRAINT inexistente) aborta
 * toda a transação; usar DROP IF EXISTS em SQL cru evita isso.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;

    // 1) Mesmo nome na mesma empresa (case-insensitive): mantém o menor id, renomeia os outros
    await sequelize.query(`
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
    `);

    // 2) Mesma cor na mesma empresa
    await sequelize.query(`
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
    `);

    // 3) Remove unicidades globais — IF EXISTS não aborta a sessão
    await sequelize.query(
      `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_name_key";`
    );
    await sequelize.query(
      `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_color_key";`
    );

    // Nomes alternativos que o Sequelize/Postgres podem ter gerado
    await sequelize.query(
      `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_name_key1";`
    );
    await sequelize.query(
      `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_color_key1";`
    );

    // 4) Unicidade por empresa (sem { transaction } — commit imediato por comando)
    await queryInterface.addConstraint("Queues", ["companyId", "name"], {
      type: "unique",
      name: "Queues_companyId_name_key"
    });

    await queryInterface.addConstraint("Queues", ["companyId", "color"], {
      type: "unique",
      name: "Queues_companyId_color_key"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;

    await sequelize.query(
      `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_companyId_name_key";`
    );
    await sequelize.query(
      `ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_companyId_color_key";`
    );

    await queryInterface.addConstraint("Queues", ["name"], {
      type: "unique",
      name: "Queues_name_key"
    });
    await queryInterface.addConstraint("Queues", ["color"], {
      type: "unique",
      name: "Queues_color_key"
    });
  }
};
