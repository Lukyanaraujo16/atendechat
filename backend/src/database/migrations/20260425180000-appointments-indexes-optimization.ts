import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.sequelize.transaction(async t => {
      await queryInterface.addIndex("Appointments", ["companyId", "startAt"], {
        name: "Appointments_companyId_startAt_idx",
        transaction: t
      });
      await queryInterface.addIndex("Appointments", ["companyId", "createdBy"], {
        name: "Appointments_companyId_createdBy_idx",
        transaction: t
      });
      await queryInterface.addIndex("AppointmentParticipants", ["userId", "status"], {
        name: "AppointmentParticipants_userId_status_idx",
        transaction: t
      });
    }),

  down: (queryInterface: QueryInterface) =>
    queryInterface.sequelize.transaction(async t => {
      await queryInterface.removeIndex("AppointmentParticipants", "AppointmentParticipants_userId_status_idx", {
        transaction: t
      });
      await queryInterface.removeIndex("Appointments", "Appointments_companyId_createdBy_idx", {
        transaction: t
      });
      await queryInterface.removeIndex("Appointments", "Appointments_companyId_startAt_idx", {
        transaction: t
      });
    })
};
