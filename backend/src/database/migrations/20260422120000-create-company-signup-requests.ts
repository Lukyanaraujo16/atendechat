import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.createTable("CompanySignupRequests", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      adminName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true
      },
      planId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Plans", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      recurrence: {
        type: DataTypes.STRING,
        allowNull: true
      },
      dueDate: {
        type: DataTypes.STRING,
        allowNull: true
      },
      campaignsEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending"
      },
      rejectReason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      reviewedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdCompanyId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Companies", key: "id" },
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
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("CompanySignupRequests");
  }
};
