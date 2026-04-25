import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.sequelize.transaction(async t => {
      await queryInterface.createTable(
        "Appointments",
        {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
          },
          title: {
            type: DataTypes.STRING,
            allowNull: false
          },
          description: {
            type: DataTypes.TEXT,
            allowNull: true
          },
          startAt: {
            type: DataTypes.DATE,
            allowNull: false
          },
          endAt: {
            type: DataTypes.DATE,
            allowNull: false
          },
          allDay: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          },
          companyId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Companies", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          createdBy: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          isCollective: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
          },
          visibility: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: "private"
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
          }
        },
        { transaction: t }
      );

      await queryInterface.addIndex("Appointments", ["companyId"], { transaction: t });
      await queryInterface.addIndex("Appointments", ["createdBy"], { transaction: t });
      await queryInterface.addIndex("Appointments", ["startAt", "endAt"], { transaction: t });

      await queryInterface.createTable(
        "AppointmentParticipants",
        {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
          },
          appointmentId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Appointments", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Users", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE"
          },
          status: {
            type: DataTypes.STRING(16),
            allowNull: false,
            defaultValue: "pending"
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false
          }
        },
        { transaction: t }
      );

      await queryInterface.addIndex("AppointmentParticipants", ["appointmentId"], {
        transaction: t
      });
      await queryInterface.addIndex("AppointmentParticipants", ["userId"], { transaction: t });
      await queryInterface.addIndex(
        "AppointmentParticipants",
        ["appointmentId", "userId"],
        { unique: true, transaction: t }
      );
    }),

  down: (queryInterface: QueryInterface) =>
    queryInterface.sequelize.transaction(async t => {
      await queryInterface.dropTable("AppointmentParticipants", { transaction: t });
      await queryInterface.dropTable("Appointments", { transaction: t });
    })
};
