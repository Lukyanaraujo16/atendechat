import { QueryInterface, DataTypes } from "sequelize";

/**
 * URLs de profile_pic do Instagram CDN excedem VARCHAR(255).
 * TEXT preserva URLs longas sem truncar dados existentes.
 */
module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.changeColumn("Contacts", "profilePicUrl", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: ""
    });
  },

  down: (queryInterface: QueryInterface) => {
    // Reverter para STRING(255) pode falhar se houver URLs > 255 caracteres.
    return queryInterface.changeColumn("Contacts", "profilePicUrl", {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: ""
    });
  }
};
