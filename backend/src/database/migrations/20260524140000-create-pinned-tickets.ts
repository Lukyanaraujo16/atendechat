import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface
      .createTable("PinnedTickets", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        ticketId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Tickets", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false
        }
      })
      .then(() =>
        queryInterface.addConstraint(
          "PinnedTickets",
          ["userId", "companyId", "ticketId"],
          {
            type: "unique",
            name: "pinned_tickets_user_company_ticket_unique"
          }
        )
      )
      .then(() =>
        queryInterface.addIndex("PinnedTickets", ["userId", "companyId"], {
          name: "pinned_tickets_user_company_idx"
        })
      );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("PinnedTickets");
  }
};
