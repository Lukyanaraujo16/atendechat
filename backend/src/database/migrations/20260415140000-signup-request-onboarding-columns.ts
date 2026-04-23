import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CompanySignupRequests", "invitationSentAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("CompanySignupRequests", "activatedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "CompanySignupRequests"
        SET
          "invitationSentAt" = "reviewedAt",
          "status" = 'invited'
        WHERE "status" = 'approved'
          AND "reviewedAt" IS NOT NULL;
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE CompanySignupRequests
        SET
          invitationSentAt = reviewedAt,
          status = 'invited'
        WHERE status = 'approved'
          AND reviewedAt IS NOT NULL;
      `);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "CompanySignupRequests"
        SET "status" = 'approved', "invitationSentAt" = NULL
        WHERE "status" = 'invited' AND "activatedAt" IS NULL;
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE CompanySignupRequests
        SET status = 'approved', invitationSentAt = NULL
        WHERE status = 'invited' AND activatedAt IS NULL;
      `);
    }

    await queryInterface.removeColumn("CompanySignupRequests", "activatedAt");
    await queryInterface.removeColumn("CompanySignupRequests", "invitationSentAt");
  }
};
