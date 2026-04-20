import { QueryTypes } from "sequelize";
import sequelize from "../../database";

const DUE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Evita avisos duplicados para o mesmo ciclo de vencimento (`metadata.dueDate`).
 */
export async function hasCompanyBillingWarningLog(
  companyId: number,
  action: "warning_before_due" | "warning_after_due",
  dueDateStr: string
): Promise<boolean> {
  if (!DUE_DATE_RE.test(dueDateStr)) return true;

  const dialect = sequelize.getDialect();
  let sql: string;
  let replacements: Record<string, unknown>;

  if (dialect === "postgres") {
    sql = `
      SELECT id FROM "CompanyLogs"
      WHERE "companyId" = :companyId
        AND action = :action
        AND metadata->>'dueDate' = :dueDate
      LIMIT 1
    `;
    replacements = { companyId, action, dueDate: dueDateStr };
  } else {
    sql = `
      SELECT id FROM CompanyLogs
      WHERE companyId = :companyId
        AND action = :action
        AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.dueDate')) = :dueDate
      LIMIT 1
    `;
    replacements = { companyId, action, dueDate: dueDateStr };
  }

  const rows = await sequelize.query<{ id: number }>(sql, {
    replacements,
    type: QueryTypes.SELECT
  });

  return rows.length > 0;
}
