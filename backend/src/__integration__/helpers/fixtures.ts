/**
 * Fixtures de integração (Fase 8.4) — gravam no Postgres descartável criado por
 * scripts/test-integration-f84.sh. Nunca usar contra databases compartilhados.
 */
import moment from "moment-timezone";
import sequelize from "../../database";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import User from "../../models/User";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSSubscriptionRenewal from "../../models/SaaSSubscriptionRenewal";
import SaaSFinancialEvent from "../../models/SaaSFinancialEvent";

export const TZ = "America/Sao_Paulo";
export const DOMAIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Garante que nunca rodamos contra um database que não seja descartável. */
export async function assertDisposableDatabase(): Promise<void> {
  const [rows] = await sequelize.query("select current_database() as db");
  const db = String((rows as any[])[0].db);
  if (!db.startsWith("f84_it_")) {
    throw new Error(
      `Database "${db}" não é descartável (esperado prefixo f84_it_). Rode via scripts/test-integration-f84.sh`
    );
  }
}

export function today(): string {
  return moment.tz(TZ).format("YYYY-MM-DD");
}

export function daysFromToday(days: number): string {
  return moment.tz(TZ).startOf("day").add(days, "days").format("YYYY-MM-DD");
}

export function addMonths(date: string, months: number): string {
  return moment.tz(date, "YYYY-MM-DD", TZ).add(months, "months").format("YYYY-MM-DD");
}

/** Converte o valor cru de Companies.dueDate (Date|string|null) para YYYY-MM-DD no fuso SP. */
export function domainDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return moment(value).tz(TZ).format("YYYY-MM-DD");
  const raw = String(value);
  if (DOMAIN_DATE_RE.test(raw)) return raw;
  return moment.tz(raw, moment.ISO_8601, TZ).tz(TZ).format("YYYY-MM-DD");
}

let seq = 0;
function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

export async function createPlan(value = 100): Promise<Plan> {
  return Plan.create({
    name: uniq("Plano IT"),
    users: 5,
    connections: 1,
    queues: 1,
    value
  } as any);
}

export type CompanyOpts = {
  dueDate?: string | null; // YYYY-MM-DD (gravado no timestamptz como meia-noite SP)
  recurrence?: string | null;
  status?: boolean;
  planValue?: number;
};

/**
 * Cria empresa e a RECARREGA do banco: `dueDate` volta como `Date` (timestamptz),
 * reproduzindo a condição do incidente P0.
 */
export async function createCompany(opts: CompanyOpts = {}): Promise<Company> {
  const plan = await createPlan(opts.planValue ?? 100);
  const dueDate =
    opts.dueDate === undefined ? daysFromToday(-10) : opts.dueDate;
  const company = await Company.create({
    name: uniq("Empresa IT"),
    email: `${uniq("it")}@example.test`,
    phone: "11999999999",
    status: opts.status ?? true,
    dueDate: dueDate === null ? null : `${dueDate}T00:00:00-03:00`,
    recurrence: opts.recurrence === undefined ? "MENSAL" : opts.recurrence,
    timezone: TZ,
    planId: plan.id
  } as any);
  const fresh = await Company.findByPk(company.id);
  if (!fresh) throw new Error("company not reloaded");
  return fresh;
}

export async function reloadCompany(id: number): Promise<Company> {
  const c = await Company.findByPk(id);
  if (!c) throw new Error(`company ${id} not found`);
  return c;
}

export async function createUser(opts: {
  companyId: number;
  superUser?: boolean;
  profile?: string;
}): Promise<User> {
  return User.create({
    name: uniq("Usuario IT"),
    email: `${uniq("user")}@example.test`,
    password: "senha-it-123456",
    profile: opts.profile ?? (opts.superUser ? "admin" : "user"),
    super: !!opts.superUser,
    companyId: opts.companyId
  } as any);
}

export async function createOpenInvoice(
  companyId: number,
  opts: { value?: number; dueDate?: string; externalTxid?: string | null } = {}
): Promise<Invoices> {
  const dueDate = opts.dueDate ?? daysFromToday(-10);
  return Invoices.create({
    companyId,
    detail: "Fatura IT",
    status: "open",
    value: opts.value ?? 100,
    dueDate,
    competence: dueDate.slice(0, 7),
    cycleKey: dueDate.slice(0, 7),
    externalTxid: opts.externalTxid ?? null,
    gatewayProvider: opts.externalTxid ? "efi" : null,
    legacyUnknown: false
  } as any);
}

export async function countState(companyId: number): Promise<{
  payments: number;
  renewals: number;
  events: number;
}> {
  const [payments, renewals, events] = await Promise.all([
    SaaSPayment.count({ where: { companyId } }),
    SaaSSubscriptionRenewal.count({ where: { companyId } }),
    SaaSFinancialEvent.count({ where: { companyId } })
  ]);
  return { payments, renewals, events };
}

/** Lê previousDueDate/newDueDate crus do banco (sem passar por getters do model). */
export async function rawRenewals(companyId: number): Promise<any[]> {
  const [rows] = await sequelize.query(
    `select "reason","previousDueDate","newDueDate","monthsAdded","recurrence","invoiceId","paymentId","idempotencyKey"
       from "SaaSSubscriptionRenewals" where "companyId" = :companyId order by id`,
    { replacements: { companyId } }
  );
  return rows as any[];
}

/** Captura o erro de uma promise (ou null se resolveu). */
export async function catchError(p: Promise<unknown>): Promise<any> {
  try {
    await p;
    return null;
  } catch (err) {
    return err;
  }
}

/** Resumo legível de erro (AppError ou Sequelize) para mensagens de expect. */
export function describeError(err: any): string {
  if (!err) return "sem erro";
  return `${err.name || "Error"}: ${err.message}${err.statusCode ? ` (${err.statusCode})` : ""}`;
}
