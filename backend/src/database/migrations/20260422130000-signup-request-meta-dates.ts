import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CompanySignupRequests", "approvedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("CompanySignupRequests", "rejectedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("CompanySignupRequests", "firstLoginAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "CompanySignupRequests"
        SET "approvedAt" = "reviewedAt"
        WHERE "status" IN ('approved', 'invited', 'activated')
          AND "reviewedAt" IS NOT NULL
          AND "approvedAt" IS NULL;
      `);
      await queryInterface.sequelize.query(`
        UPDATE "CompanySignupRequests"
        SET "rejectedAt" = "reviewedAt"
        WHERE "status" = 'rejected'
          AND "reviewedAt" IS NOT NULL
          AND "rejectedAt" IS NULL;
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE CompanySignupRequests
        SET approvedAt = reviewedAt
        WHERE status IN ('approved', 'invited', 'activated')
          AND reviewedAt IS NOT NULL
          AND approvedAt IS NULL;
      `);
      await queryInterface.sequelize.query(`
        UPDATE CompanySignupRequests
        SET rejectedAt = reviewedAt
        WHERE status = 'rejected'
          AND reviewedAt IS NOT NULL
          AND rejectedAt IS NULL;
      `);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CompanySignupRequests", "firstLoginAt");
    await queryInterface.removeColumn("CompanySignupRequests", "rejectedAt");
    await queryInterface.removeColumn("CompanySignupRequests", "approvedAt");
  }
};
