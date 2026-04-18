import { QueryInterface } from "sequelize";

/**
 * Queues tinham UNIQUE só em `name` e `color` (globais), o que impede duas empresas
 * usarem o mesmo nome de setor. Passa a unicidade composta (companyId, name) e
 * (companyId, color). Antes, deduplica linhas na mesma empresa com mesmo nome/cor.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;

    await sequelize.transaction(async (transaction) => {
      // 1) Mesmo nome na mesma empresa (case-insensitive): mantém o menor id, renomeia os outros
      await sequelize.query(
        `
        UPDATE "Queues" q
        SET name = LEFT(TRIM(q.name) || ' (' || q.id::text || ')', 255)
        FROM (
          SELECT id
          FROM (
            SELECT id,
              ROW_NUMBER() OVER (
                PARTITION BY "companyId", LOWER(TRIM(name))
                ORDER BY id
              ) AS rn
            FROM "Queues"
            WHERE "companyId" IS NOT NULL
          ) t
          WHERE t.rn > 1
        ) d
        WHERE q.id = d.id
        `,
        { transaction }
      );

      // 2) Mesma cor na mesma empresa: gera hex alternativo determinístico a partir do id
      await sequelize.query(
        `
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
        `,
        { transaction }
      );

      // 3) Remove unicidades globais (PostgreSQL: nomes típicos Queues_name_key / Queues_color_key)
      const dropUnique = async (constraintName: string) => {
        try {
          await queryInterface.removeConstraint("Queues", constraintName, {
            transaction
          });
        } catch {
          // ignore se já não existir ou nome variar
        }
      };

      await dropUnique("Queues_name_key");
      await dropUnique("Queues_color_key");

      // 4) Unicidade por empresa
      await queryInterface.addConstraint(
        "Queues",
        ["companyId", "name"],
        {
          type: "unique",
          name: "Queues_companyId_name_key",
          transaction
        }
      );

      await queryInterface.addConstraint(
        "Queues",
        ["companyId", "color"],
        {
          type: "unique",
          name: "Queues_companyId_color_key",
          transaction
        }
      );
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const sequelize = queryInterface.sequelize;
    await sequelize.transaction(async (transaction) => {
      try {
        await queryInterface.removeConstraint("Queues", "Queues_companyId_name_key", {
          transaction
        });
      } catch {
        /* empty */
      }
      try {
        await queryInterface.removeConstraint("Queues", "Queues_companyId_color_key", {
          transaction
        });
      } catch {
        /* empty */
      }

      // Restaura comportamento antigo (pode falhar se já existir nome/cor repetido entre empresas)
      await queryInterface.addConstraint(
        "Queues",
        ["name"],
        {
          type: "unique",
          name: "Queues_name_key",
          transaction
        }
      );
      await queryInterface.addConstraint(
        "Queues",
        ["color"],
        {
          type: "unique",
          name: "Queues_color_key",
          transaction
        }
      );
    });
  }
};
