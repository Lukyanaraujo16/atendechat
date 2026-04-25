import sequelize from "../database";

/**
 * Aspas de identificador alinhadas ao dialeto (MySQL/MariaDB usam `;` PostgreSQL usa ").
 * Literais estilo "PgStyle" em Sequelize.literal() falham no MySQL padrão (sem ANSI_QUOTES)
 * e geram 500 (syntax error) em GET /appointments.
 */
export const quoteSqlIdentifier = (name: string): string => {
  if (name == null) return '""';
  const dialect = sequelize.getDialect() as string;
  if (dialect === "mysql" || dialect === "mariadb" || dialect === "sqlite") {
    return `\`${String(name).replace(/`/g, "``")}\``;
  }
  if (dialect === "mssql") {
    return `[${String(name).replace(/\]/g, "]]")}]`;
  }
  return `"${String(name).replace(/"/g, '""')}"`;
};

export const qualifySql = (tableOrAlias: string, column: string): string =>
  `${quoteSqlIdentifier(tableOrAlias)}.${quoteSqlIdentifier(column)}`;

/**
 * Compara coluna "boolean" (TINYINT no MySQL vs boolean no PostgreSQL) com verdadeiro.
 */
const sqlIsCollectiveTrue = (col: string): string => {
  const dialect = sequelize.getDialect() as string;
  if (dialect === "postgres" || dialect === "cockroachdb") {
    return `${col} = TRUE`;
  }
  return `${col} = 1`;
};

/**
 * Cláusula de visibilidade usada no WHERE de listagem (acesso a compromissos do utilizador).
 * Deve acompanhar a lógica de `appointmentAccess.userCanViewAppointment` (team/privado/company).
 */
export const buildAppointmentListAccessSqlLiteral = (viewerId: number): string => {
  const v = Number(viewerId);
  const A = "Appointment";
  const uq = quoteSqlIdentifier("UserQueues");
  const apT = quoteSqlIdentifier("AppointmentParticipants");
  return `(
    ${qualifySql(A, "createdBy")} = ${v}
    OR ${qualifySql(A, "visibility")} = 'company'
    OR (
      ${qualifySql(A, "visibility")} = 'team'
      AND EXISTS (
        SELECT 1 FROM ${uq} uq1
        INNER JOIN ${uq} uq2 ON uq1.${quoteSqlIdentifier("queueId")} = uq2.${quoteSqlIdentifier("queueId")}
        WHERE uq1.${quoteSqlIdentifier("userId")} = ${v} AND uq2.${quoteSqlIdentifier("userId")} = ${qualifySql(
    A,
    "createdBy"
  )}
      )
    )
    OR (
      ${qualifySql(A, "visibility")} = 'private'
      AND ${sqlIsCollectiveTrue(qualifySql(A, "isCollective"))}
      AND EXISTS (
        SELECT 1 FROM ${apT} ap
        WHERE ap.${quoteSqlIdentifier("appointmentId")} = ${qualifySql(A, "id")} AND ap.${quoteSqlIdentifier(
    "userId"
  )} = ${v}
      )
    )
  )`;
};
