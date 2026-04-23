import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CompanySignupRequests", "firstInvitationSentAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("CompanySignupRequests", "invitationResentCount", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
    await queryInterface.addColumn("CompanySignupRequests", "invitationResentHistory", {
      type: DataTypes.JSON,
      allowNull: true
    });

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "CompanySignupRequests"
        SET "firstInvitationSentAt" = "invitationSentAt"
        WHERE "invitationSentAt" IS NOT NULL AND "firstInvitationSentAt" IS NULL;
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE CompanySignupRequests
        SET firstInvitationSentAt = invitationSentAt
        WHERE invitationSentAt IS NOT NULL AND firstInvitationSentAt IS NULL;
      `);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CompanySignupRequests", "invitationResentHistory");
    await queryInterface.removeColumn("CompanySignupRequests", "invitationResentCount");
    await queryInterface.removeColumn("CompanySignupRequests", "firstInvitationSentAt");
  }
};
