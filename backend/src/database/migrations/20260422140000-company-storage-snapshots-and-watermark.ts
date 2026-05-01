import { QueryInterface, DataTypes } from "sequelize";

function hasColumn(
  tableDescription: Record<string, unknown> | null | undefined,
  columnName: string
): boolean {
  if (!tableDescription) return false;
  const lower = columnName.toLowerCase();
  return Object.keys(tableDescription).some(k => k.toLowerCase() === lower);
}

function isAlreadyExistsError(err: unknown): boolean {
  const m = String((err as { message?: string })?.message ?? err);
  return /already exists/i.test(m) || /duplicate/i.test(m);
}

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    let snapshotsDesc: Record<string, unknown> | null = null;
    try {
      snapshotsDesc = (await queryInterface.describeTable(
        "CompanyStorageSnapshots"
      )) as Record<string, unknown>;
    } catch {
      snapshotsDesc = null;
    }

    if (!snapshotsDesc) {
      await queryInterface.createTable("CompanyStorageSnapshots", {
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
        usedBytes: {
          type: DataTypes.BIGINT,
          allowNull: false,
          defaultValue: 0
        },
        limitBytes: {
          type: DataTypes.BIGINT,
          allowNull: true
        },
        usagePercent: {
          type: DataTypes.DECIMAL(10, 1),
          allowNull: true
        },
        reason: {
          type: DataTypes.STRING(64),
          allowNull: false
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false
        }
      });
    }

    try {
      await queryInterface.addIndex(
        "CompanyStorageSnapshots",
        ["companyId", "createdAt"],
        { name: "CompanyStorageSnapshots_company_created" }
      );
    } catch (err) {
      if (!isAlreadyExistsError(err)) throw err;
    }

    const companiesDesc = (await queryInterface.describeTable(
      "Companies"
    )) as Record<string, unknown>;
    if (!hasColumn(companiesDesc, "storageAlertWatermark")) {
      await queryInterface.addColumn("Companies", "storageAlertWatermark", {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const companiesDesc = (await queryInterface.describeTable(
      "Companies"
    )) as Record<string, unknown>;
    if (hasColumn(companiesDesc, "storageAlertWatermark")) {
      await queryInterface.removeColumn("Companies", "storageAlertWatermark");
    }

    let snapshotsDescDown: Record<string, unknown> | null = null;
    try {
      snapshotsDescDown = (await queryInterface.describeTable(
        "CompanyStorageSnapshots"
      )) as Record<string, unknown>;
    } catch {
      snapshotsDescDown = null;
    }
    if (snapshotsDescDown) {
      await queryInterface.dropTable("CompanyStorageSnapshots");
    }
  }
};
