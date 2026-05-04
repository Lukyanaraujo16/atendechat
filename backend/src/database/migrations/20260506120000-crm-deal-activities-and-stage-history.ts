import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CrmDealActivities", {
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
      dealId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "CrmDeals", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      type: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("CrmDealActivities", ["companyId", "dealId"], {
      name: "CrmDealActivities_company_deal"
    });

    await queryInterface.createTable("CrmDealStageHistory", {
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
      dealId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "CrmDeals", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      fromStageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "CrmStages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      toStageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "CrmStages", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      enteredAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      leftAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      durationMs: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      changedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("CrmDealStageHistory", ["companyId", "dealId"], {
      name: "CrmDealStageHistory_company_deal"
    });
    await queryInterface.addIndex("CrmDealStageHistory", ["dealId", "leftAt"], {
      name: "CrmDealStageHistory_deal_leftAt"
    });

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "mysql" || dialect === "mariadb") {
      await queryInterface.sequelize.query(`
      INSERT INTO \`CrmDealStageHistory\` (
        \`companyId\`, \`dealId\`, \`fromStageId\`, \`toStageId\`,
        \`enteredAt\`, \`leftAt\`, \`durationMs\`, \`changedBy\`,
        \`createdAt\`, \`updatedAt\`
      )
      SELECT
        d.\`companyId\`,
        d.\`id\`,
        NULL,
        d.\`stageId\`,
        COALESCE(d.\`createdAt\`, d.\`updatedAt\`),
        NULL,
        NULL,
        d.\`createdBy\`,
        NOW(),
        NOW()
      FROM \`CrmDeals\` d
      WHERE NOT EXISTS (
        SELECT 1 FROM \`CrmDealStageHistory\` h
        WHERE h.\`dealId\` = d.\`id\` AND h.\`leftAt\` IS NULL
      )
    `);
    } else {
      await queryInterface.sequelize.query(`
      INSERT INTO "CrmDealStageHistory" (
        "companyId", "dealId", "fromStageId", "toStageId",
        "enteredAt", "leftAt", "durationMs", "changedBy",
        "createdAt", "updatedAt"
      )
      SELECT
        d."companyId",
        d."id",
        NULL,
        d."stageId",
        COALESCE(d."createdAt", d."updatedAt"),
        NULL,
        NULL,
        d."createdBy",
        NOW(),
        NOW()
      FROM "CrmDeals" d
      WHERE NOT EXISTS (
        SELECT 1 FROM "CrmDealStageHistory" h
        WHERE h."dealId" = d."id" AND h."leftAt" IS NULL
      )
    `);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("CrmDealStageHistory");
    await queryInterface.dropTable("CrmDealActivities");
  }
};
