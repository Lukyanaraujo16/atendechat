/**
 * Helpers de integração da Fase 8.4-F (Postgres real descartável).
 *
 * Os módulos novos da 8.4-F (routers/serviços de outros agentes) são carregados com
 * `optionalRequire`: se o arquivo ainda não existir, o teste falha com a mensagem
 * "FUNCIONALIDADE INEXISTENTE: <módulo>" em vez de derrubar a suíte inteira na importação.
 */
import { Router } from "express";
import sequelize from "../../database";
import Invoices from "../../models/Invoices";
import CompanyLog from "../../models/CompanyLog";
import { daysFromToday } from "./fixtures";

export type Optional<T> = { mod: T | null; missing: string | null };

export function optionalRequire<T = any>(path: string): Optional<T> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require, import/no-dynamic-require
    const mod = require(path);
    return { mod: mod as T, missing: null };
  } catch (err: any) {
    const msg = String(err?.message || err);
    // Só tratamos como "inexistente" o módulo pedido; outros erros de carga são relatados como estão.
    if (err?.code === "MODULE_NOT_FOUND" && msg.includes(path.replace(/^\.\.\//, "").split("/").pop() as string)) {
      return { mod: null, missing: `${path} (arquivo não encontrado)` };
    }
    return { mod: null, missing: `${path} (erro ao carregar: ${msg.split("\n")[0]})` };
  }
}

/** Falha o teste de forma legível quando a funcionalidade ainda não existe. */
export function requireFeature(...opts: Array<Optional<any>>): void {
  const missing = opts.filter(o => o.missing).map(o => o.missing);
  if (missing.length) {
    throw new Error(`FUNCIONALIDADE INEXISTENTE: ${missing.join("; ")}`);
  }
}

export function routerOf(opt: Optional<any>): Router | null {
  if (!opt.mod) return null;
  return (opt.mod.default ?? opt.mod) as Router;
}

/** Fatura aberta legada (sem cycleKey) — candidata à regularização histórica. */
export async function createLegacyInvoice(
  companyId: number,
  opts: {
    value?: number;
    dueDate?: string;
    cycleKey?: string | null;
    legacyUnknown?: boolean;
    createdAt?: string | null; // ISO; null = agora
    externalTxid?: string | null;
    externalChargeId?: string | null;
    gatewayStatus?: string | null;
  } = {}
): Promise<Invoices> {
  const dueDate = opts.dueDate ?? daysFromToday(-60);
  const inv = await Invoices.create({
    companyId,
    detail: "Fatura legada IT",
    status: "open",
    value: opts.value ?? 100,
    dueDate,
    competence: null,
    cycleKey: opts.cycleKey === undefined ? null : opts.cycleKey,
    externalTxid: opts.externalTxid ?? null,
    externalChargeId: opts.externalChargeId ?? null,
    gatewayProvider: opts.externalTxid || opts.externalChargeId ? "efi" : null,
    gatewayStatus: opts.gatewayStatus ?? null,
    legacyUnknown: opts.legacyUnknown ?? false
  } as any);
  if (opts.createdAt) {
    await sequelize.query(`update "Invoices" set "createdAt" = :c where id = :id`, {
      replacements: { c: opts.createdAt, id: inv.id }
    });
  }
  return (await Invoices.findByPk(inv.id)) as Invoices;
}

export async function addCompanyLog(
  companyId: number,
  action: string,
  createdAt?: string,
  userId: number | null = null
): Promise<number> {
  const row = await CompanyLog.create({ companyId, action, userId, metadata: { it: true } } as any);
  if (createdAt) {
    await sequelize.query(`update "CompanyLogs" set "createdAt" = :c where id = :id`, {
      replacements: { c: createdAt, id: row.id }
    });
  }
  return row.id;
}

async function scalar(sql: string, replacements: Record<string, unknown> = {}): Promise<number> {
  const [rows] = await sequelize.query(sql, { replacements });
  return Number((rows as any[])[0].n);
}

/** Contagens globais para provar "zero escrita". */
export async function globalWriteSnapshot(): Promise<Record<string, unknown>> {
  const [statusRows] = await sequelize.query(
    `select coalesce(string_agg(id || ':' || status || ':' || coalesce("dueDate"::text,'-'), ',' order by id), '') as s from "Companies"`
  );
  return {
    companies: (statusRows as any[])[0].s,
    companyLogs: await scalar(`select count(*)::int as n from "CompanyLogs"`),
    userNotifications: await scalar(`select count(*)::int as n from "UserNotifications"`),
    events: await scalar(`select count(*)::int as n from "SaaSFinancialEvents"`),
    payments: await scalar(`select count(*)::int as n from "SaaSPayments"`),
    renewals: await scalar(`select count(*)::int as n from "SaaSSubscriptionRenewals"`),
    reconciliation: await scalar(`select count(*)::int as n from "SaaSReconciliationItems"`),
    invoices: await scalar(
      `select count(*)::int as n from "Invoices"`
    ),
    invoicesState: (
      (await sequelize.query(
        `select coalesce(string_agg(id || ':' || status || ':' || value, ',' order by id), '') as s from "Invoices"`
      ))[0] as any[]
    )[0].s
  };
}

export async function historicalReviewCount(invoiceId?: number): Promise<number> {
  return scalar(
    `select count(*)::int as n from "SaaSInvoiceHistoricalReviews"${invoiceId ? ` where "invoiceId" = :id` : ""}`,
    { id: invoiceId }
  );
}

/** SaaSPayments crus (paidAt sem passar por getters). */
export async function rawPayments(invoiceId: number): Promise<any[]> {
  const [rows] = await sequelize.query(
    `select id, amount::float as amount, source, "countsAsRevenue", "paidAt", metadata, "externalTxid"
       from "SaaSPayments" where "invoiceId" = :id order by id`,
    { replacements: { id: invoiceId } }
  );
  return rows as any[];
}

export async function revenueOfInvoice(invoiceId: number): Promise<number> {
  return scalar(
    `select coalesce(sum(amount),0)::float as n from "SaaSPayments" where "invoiceId" = :id and "countsAsRevenue" = true`,
    { id: invoiceId }
  );
}

export async function reconciliationItems(invoiceId: number, kind?: string): Promise<any[]> {
  const [rows] = await sequelize.query(
    `select id, kind, status, "paymentId", metadata from "SaaSReconciliationItems"
      where "invoiceId" = :id ${kind ? `and kind = :kind` : ""} order by id`,
    { replacements: { id: invoiceId, kind } }
  );
  return rows as any[];
}

export async function rawDueDate(companyId: number): Promise<string | null> {
  const [rows] = await sequelize.query(
    `select "dueDate"::text as d, status from "Companies" where id = :id`,
    { replacements: { id: companyId } }
  );
  return (rows as any[])[0]?.d ?? null;
}

export function codesOf(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((e: any) => String(e?.code ?? e));
}
