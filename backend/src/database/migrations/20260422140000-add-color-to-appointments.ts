import { QueryInterface, DataTypes } from "sequelize";
import {
  addColumnIfMissing,
  removeColumnIfExists
} from "./helpers/migrationTableHelpers";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await addColumnIfMissing(queryInterface, "Appointments", "color", {
      type: DataTypes.STRING(16),
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await removeColumnIfExists(queryInterface, "Appointments", "color");
  }
};
