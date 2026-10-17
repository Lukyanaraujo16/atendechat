import { QueryInterface, DataTypes } from "sequelize";

/**
 * Corrige o âmbito "plataforma" (companyId NULL) das notificações do Super Admin.
 *
 * As migrations 20260424100000-notification-center-phase6 e
 * 20260428120000-user-notification-preferences-nullable-company usaram
 * `changeColumn(..., { allowNull: true, references })`. No Postgres, o Sequelize 5 gera para isso
 * apenas `ADD FOREIGN KEY` e descarta o `DROP NOT NULL`: as colunas continuaram NOT NULL (e uma FK
 * duplicada foi criada, inofensiva). Resultado: notificações financeiras do Super Admin
 * (companyId NULL) falhavam silenciosamente e preferências de âmbito plataforma não podiam ser gravadas.
 *
 * Idempotente: DROP NOT NULL em coluna já nullable não faz nada.
 */
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        'ALTER TABLE "UserNotifications" ALTER COLUMN "companyId" DROP NOT NULL;'
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE "UserNotificationPreferences" ALTER COLUMN "companyId" DROP NOT NULL;'
      );
      return;
    }

    // Outros dialetos: sem `references`, para não recriar a FK.
    for (const table of ["UserNotifications", "UserNotificationPreferences"]) {
      await queryInterface.changeColumn(table, "companyId", {
        type: DataTypes.INTEGER,
        allowNull: true
      });
    }
  },

  // Sem reversão: voltar a NOT NULL reintroduziria o defeito e falharia com as notificações de
  // plataforma já gravadas. O estado pretendido pelas migrations originais é nullable.
  down: async () => {
    /* no-op intencional */
  }
};
