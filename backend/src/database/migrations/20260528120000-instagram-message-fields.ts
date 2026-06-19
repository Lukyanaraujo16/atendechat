import { QueryInterface, DataTypes, Op } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .addColumn("Messages", "channel", {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "whatsapp"
      })
      .then(() =>
        queryInterface.sequelize.query(
          `UPDATE "Messages" SET channel = 'whatsapp' WHERE channel IS NULL`
        )
      )
      .then(() =>
        queryInterface.addColumn("Messages", "externalMessageId", {
          type: DataTypes.STRING(255),
          allowNull: true
        })
      )
      .then(() =>
        queryInterface.addColumn("Messages", "metaPayload", {
          type: DataTypes.JSONB,
          allowNull: true
        })
      )
      .then(() =>
        queryInterface.addIndex("Messages", ["externalMessageId"], {
          name: "messages_external_message_id_idx",
          unique: true,
          where: { externalMessageId: { [Op.ne]: null } }
        })
      )
      .then(() =>
        queryInterface.addIndex("Contacts", ["companyId", "instagramScopedId"], {
          name: "contacts_company_instagram_scoped_id_idx"
        })
      );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface
      .removeIndex("Contacts", "contacts_company_instagram_scoped_id_idx")
      .then(() =>
        queryInterface.removeIndex("Messages", "messages_external_message_id_idx")
      )
      .then(() => queryInterface.removeColumn("Messages", "metaPayload"))
      .then(() => queryInterface.removeColumn("Messages", "externalMessageId"))
      .then(() => queryInterface.removeColumn("Messages", "channel"));
  }
};
