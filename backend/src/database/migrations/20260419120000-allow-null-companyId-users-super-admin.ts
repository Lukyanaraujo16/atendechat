import { QueryInterface, DataTypes } from "sequelize";

/**
 * Permite Super Admin sem empresa operacional (companyId nulo).
 * Sintaxe SQL difere entre PostgreSQL e MySQL/MariaDB.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        'ALTER TABLE "Users" ALTER COLUMN "companyId" DROP NOT NULL'
      );
      return;
    }

    if (dialect === "mysql" || dialect === "mariadb") {
      await queryInterface.sequelize.query(
        "ALTER TABLE `Users` MODIFY `companyId` INT NULL"
      );
      return;
    }

    await queryInterface.changeColumn("Users", "companyId", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        'ALTER TABLE "Users" ALTER COLUMN "companyId" SET NOT NULL'
      );
      return;
    }

    if (dialect === "mysql" || dialect === "mariadb") {
      await queryInterface.sequelize.query(
        "ALTER TABLE `Users` MODIFY `companyId` INT NOT NULL"
      );
      return;
    }

    await queryInterface.changeColumn("Users", "companyId", {
      type: DataTypes.INTEGER,
      allowNull: false
    });
  }
};
