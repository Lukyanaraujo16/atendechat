/**
 * Fase 8.4-F (F2) — Linha do tempo da empresa (contrato C4). SOMENTE LEITURA.
 *
 * Mescla três fontes, sempre filtradas por `companyId` (isolamento):
 *  - ledger `SaaSFinancialEvents` (fonte principal);
 *  - `CompanyLogs` de bloqueio/desbloqueio, renovação, vencimento, cadastro e usuários — logs de
 *    renovação que JÁ têm evento correspondente no ledger são omitidos (sem duplicar);
 *  - `Invoices.createdAt` apenas para faturas SEM evento `invoice_created*` (faturas legadas).
 * Nunca inventa eventos: cada item corresponde a uma linha real. Paginação por cursor `before`
 * (exclusivo, ISO) ordenada do mais recente para o mais antigo; `limit` ≤ 100.
 */
import { Op, literal } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import CompanyLog from "../../models/CompanyLog";
import Invoices from "../../models/Invoices";
import SaaSFinancialEvent from "../../models/SaaSFinancialEvent";
import User from "../../models/User";
import { toDomainDate } from "../../helpers/saasDueDate";

export type TimelineKind =
  | "invoice_created"
  | "invoice_updated"
  | "invoice_cancelled"
  | "payment_manual"
  | "payment_gateway"
  | "payment_historical"
  | "courtesy"
  | "courtesy_historical"
  | "renewal_payment"
  | "renewal_admin"
  | "renewal_skipped"
  | "due_date_adjusted"
  | "due_date_manual_edit"
  | "block_manual"
  | "block_auto"
  | "unblock"
  | "unblock_after_renew"
  | "historical_review"
  | "registration_update"
  | "user_admin"
  | "other";

export type TimelineItem = {
  id: string;
  occurredAt: string;
  kind: TimelineKind;
  title: string;
  amount: number | null;
  actor: { id: number; name: string } | null;
  invoiceId: number | null;
  source: "ledger" | "company_log" | "invoice";
  details: Record<string, unknown>;
};

export type TimelinePage = {
  items: TimelineItem[];
  nextBefore: string | null;
  historyStartsAt: string | null;
};

export const TIMELINE_DEFAULT_LIMIT = 30;
export const TIMELINE_MAX_LIMIT = 100;

/** Ações de CompanyLog exibidas (além de `renew*` e `user_*`). */
export const TIMELINE_LOG_ACTIONS = [
  "block",
  "unblock",
  "auto_block",
  "auto_unblock_after_renew",
  "due_date_manual_edit",
  "registration_update"
];

/** Janela para casar um log `renew*` com o evento de renovação do ledger (efeitos pós-commit). */
const RENEW_LOG_MATCH_WINDOW_MS = 10 * 60 * 1000;

type Internal = TimelineItem & { _ms: number; _order: number; _actorId: number | null };

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function invLabel(invoiceId: number | null | undefined): string {
  return invoiceId ? ` (fatura #${invoiceId})` : "";
}

/** Mapeia um evento do ledger para kind/título pt-BR. */
export function mapLedgerEvent(
  eventType: string,
  invoiceId: number | null,
  payload: Record<string, unknown> | null
): { kind: TimelineKind; title: string; amount: number | null } {
  const p = payload || {};
  const inv = invLabel(invoiceId);
  switch (eventType) {
    case "invoice_created":
      return { kind: "invoice_created", title: `Fatura gerada${inv}`, amount: num(p.value ?? p.amount) };
    case "invoice_created_manual":
      return { kind: "invoice_created", title: `Fatura criada manualmente${inv}`, amount: num(p.value ?? p.amount) };
    case "invoice_updated":
      return { kind: "invoice_updated", title: `Fatura alterada${inv}`, amount: num((p.after as any)?.value) };
    case "invoice_cancelled":
      return { kind: "invoice_cancelled", title: `Fatura cancelada${inv}`, amount: null };
    case "manual_payment_recorded":
      return { kind: "payment_manual", title: `Pagamento manual registrado${inv}`, amount: num(p.amount) };
    case "payment_confirmed_gateway":
      return { kind: "payment_gateway", title: `Pagamento confirmado pela Efí${inv}`, amount: num(p.amount) };
    case "courtesy_granted":
      return { kind: "courtesy", title: `Cortesia concedida${inv}`, amount: num(p.amount) };
    case "historical_payment_recorded":
      return { kind: "payment_historical", title: `Pagamento histórico regularizado${inv}`, amount: num(p.amount) };
    case "historical_courtesy_recorded":
      return { kind: "courtesy_historical", title: `Cortesia histórica registrada${inv}`, amount: num(p.amount) };
    case "historical_invoice_cancelled":
      return { kind: "historical_review", title: `Fatura cancelada na regularização histórica (cobrança indevida)${inv}`, amount: null };
    case "historical_review_kept_pending":
      return { kind: "historical_review", title: `Fatura mantida pendente na regularização histórica${inv}`, amount: null };
    case "renewal_payment_confirmed":
      return { kind: "renewal_payment", title: "Assinatura renovada por pagamento", amount: null };
    case "renewal_courtesy":
      return { kind: "renewal_payment", title: "Assinatura renovada por cortesia", amount: null };
    case "renewal_manual_renew":
      return { kind: "renewal_admin", title: "Renovação administrativa", amount: null };
    case "renewal_due_date_adjustment":
      return { kind: "due_date_adjusted", title: "Vencimento ajustado", amount: null };
    case "renewal_skipped_period_already_covered":
      return { kind: "renewal_skipped", title: `Renovação não aplicada: período já coberto${inv}`, amount: null };
    case "gateway_payment_on_settled_invoice":
      return { kind: "other", title: `Pagamento Efí em fatura já quitada — possível duplicidade${inv}`, amount: num(p.amount) };
    case "gateway_settle_retry_success":
      return { kind: "other", title: `Baixa sincronizada com a Efí${inv}`, amount: null };
    default:
      if (eventType.startsWith("renewal_skipped_")) {
        return { kind: "renewal_skipped", title: `Renovação não aplicada${inv}`, amount: null };
      }
      if (eventType.startsWith("historical_")) {
        return { kind: "historical_review", title: `Regularização histórica${inv}`, amount: num(p.amount) };
      }
      return { kind: "other", title: `Evento financeiro: ${eventType}${inv}`, amount: num(p.amount) };
  }
}

/** Mapeia uma ação de CompanyLog para kind/título pt-BR. */
export function mapCompanyLog(action: string): { kind: TimelineKind; title: string } {
  switch (action) {
    case "block":
      return { kind: "block_manual", title: "Empresa bloqueada manualmente" };
    case "auto_block":
      return { kind: "block_auto", title: "Empresa bloqueada automaticamente por atraso" };
    case "unblock":
      return { kind: "unblock", title: "Empresa desbloqueada" };
    case "auto_unblock_after_renew":
      return { kind: "unblock_after_renew", title: "Empresa reativada após renovação" };
    case "renew":
      return { kind: "renewal_admin", title: "Renovação administrativa" };
    case "renew_payment_confirmed":
      return { kind: "renewal_payment", title: "Assinatura renovada por pagamento" };
    case "renew_courtesy":
      return { kind: "renewal_payment", title: "Assinatura renovada por cortesia" };
    case "renew_due_date_adjustment":
      return { kind: "due_date_adjusted", title: "Vencimento ajustado" };
    case "due_date_manual_edit":
      return { kind: "due_date_manual_edit", title: "Vencimento editado no cadastro" };
    case "registration_update":
      return { kind: "registration_update", title: "Cadastro atualizado" };
    case "user_create":
      return { kind: "user_admin", title: "Usuário criado" };
    case "user_update":
      return { kind: "user_admin", title: "Usuário alterado" };
    case "user_password_reset":
      return { kind: "user_admin", title: "Senha de usuário redefinida" };
    case "user_activate":
      return { kind: "user_admin", title: "Usuário reativado" };
    case "user_deactivate":
      return { kind: "user_admin", title: "Usuário desativado" };
    default:
      if (action.startsWith("user_")) return { kind: "user_admin", title: "Usuário alterado" };
      if (action.startsWith("renew")) return { kind: "renewal_admin", title: "Renovação" };
      return { kind: "other", title: action };
  }
}

function parseBefore(before: unknown): Date | null {
  if (before === undefined || before === null || before === "") return null;
  const d = new Date(String(before));
  if (Number.isNaN(d.getTime())) {
    throw new AppError("ERR_INVALID_CURSOR", 400, "Parâmetro before inválido (use data ISO).");
  }
  return d;
}

export function clampTimelineLimit(limit: unknown): number {
  const n = parseInt(String(limit ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return TIMELINE_DEFAULT_LIMIT;
  return Math.min(TIMELINE_MAX_LIMIT, n);
}

/** Um log `renew*` já representado por um evento de renovação do ledger? */
function isRenewLogDuplicate(
  log: CompanyLog,
  ledgerRenewals: Array<{ ms: number; newDueDate: string | null }>
): boolean {
  const meta = (log.metadata || {}) as Record<string, unknown>;
  const logNew = toDomainDate(meta.newDueDate as any) || null;
  const ms = new Date(log.createdAt).getTime();
  return ledgerRenewals.some(
    r =>
      Math.abs(r.ms - ms) <= RENEW_LOG_MATCH_WINDOW_MS &&
      (!logNew || !r.newDueDate || r.newDueDate === logNew)
  );
}

export async function getCompanyTimeline(
  companyId: number,
  opts: { before?: unknown; limit?: unknown } = {}
): Promise<TimelinePage> {
  const company = await Company.findByPk(companyId, { attributes: ["id", "timezone"] });
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  const limit = clampTimelineLimit(opts.limit);
  const before = parseBefore(opts.before);
  const need = limit + 1;
  const createdBefore = before ? { createdAt: { [Op.lt]: before } } : {};

  // 1) Ledger.
  const events = await SaaSFinancialEvent.findAll({
    where: { companyId, ...createdBefore },
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    limit: need
  });

  // 2) CompanyLogs (filtrando renovações já presentes no ledger; busca em lotes até completar).
  const logWhere = {
    companyId,
    ...createdBefore,
    [Op.or]: [
      { action: { [Op.in]: TIMELINE_LOG_ACTIONS } },
      { action: { [Op.like]: "renew%" } },
      { action: { [Op.like]: "user\\_%" } }
    ]
  };
  const logs: CompanyLog[] = [];
  let offset = 0;
  const batch = Math.max(need, 50);
  for (;;) {
    const rows = await CompanyLog.findAll({
      where: logWhere as any,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"]
      ],
      limit: batch,
      offset
    });
    offset += rows.length;
    const renewLogs = rows.filter(r => String(r.action).startsWith("renew"));
    let ledgerRenewals: Array<{ ms: number; newDueDate: string | null }> = [];
    if (renewLogs.length) {
      const times = renewLogs.map(r => new Date(r.createdAt).getTime());
      const from = new Date(Math.min(...times) - RENEW_LOG_MATCH_WINDOW_MS);
      const to = new Date(Math.max(...times) + RENEW_LOG_MATCH_WINDOW_MS);
      const renewalEvents = await SaaSFinancialEvent.findAll({
        where: {
          companyId,
          eventType: { [Op.like]: "renewal\\_%" },
          createdAt: { [Op.gte]: from, [Op.lte]: to }
        },
        attributes: ["id", "eventType", "createdAt", "payload"]
      });
      ledgerRenewals = renewalEvents
        .filter(e => !String(e.eventType).startsWith("renewal_skipped"))
        .map(e => ({
          ms: new Date(e.createdAt).getTime(),
          newDueDate: toDomainDate(((e.payload || {}) as any).newDueDate) || null
        }));
    }
    for (const r of rows) {
      if (String(r.action).startsWith("renew") && isRenewLogDuplicate(r, ledgerRenewals)) continue;
      logs.push(r);
      if (logs.length >= need) break;
    }
    if (logs.length >= need || rows.length < batch) break;
  }

  // 3) Faturas sem evento de criação no ledger (legadas).
  const invoices = await Invoices.findAll({
    where: {
      companyId,
      ...createdBefore,
      [Op.and]: [
        literal(
          `NOT EXISTS (SELECT 1 FROM "SaaSFinancialEvents" e WHERE e."invoiceId" = "Invoices"."id" AND e."companyId" = "Invoices"."companyId" AND e."eventType" LIKE 'invoice\\_created%')`
        )
      ]
    } as any,
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    limit: need
  });

  const tz = company.timezone;
  const merged: Internal[] = [];
  for (const e of events) {
    const m = mapLedgerEvent(e.eventType, e.invoiceId ?? null, e.payload);
    merged.push({
      id: `evt:${e.id}`,
      occurredAt: new Date(e.createdAt).toISOString(),
      kind: m.kind,
      title: m.title,
      amount: m.amount,
      actor: null,
      invoiceId: e.invoiceId ?? null,
      source: "ledger",
      details: { type: e.eventType, paymentId: e.paymentId ?? null, ...(e.payload || {}) },
      _ms: new Date(e.createdAt).getTime(),
      _order: 0,
      _actorId: e.actorUserId ?? null
    });
  }
  for (const l of logs) {
    const m = mapCompanyLog(String(l.action));
    const meta = (l.metadata || {}) as Record<string, unknown>;
    merged.push({
      id: `log:${l.id}`,
      occurredAt: new Date(l.createdAt).toISOString(),
      kind: m.kind,
      title: m.title,
      amount: null,
      actor: null,
      invoiceId: num(meta.invoiceId) as number | null,
      source: "company_log",
      details: { type: l.action, ...meta },
      _ms: new Date(l.createdAt).getTime(),
      _order: 1,
      _actorId: l.userId ?? null
    });
  }
  for (const inv of invoices) {
    merged.push({
      id: `inv:${inv.id}`,
      occurredAt: new Date(inv.createdAt).toISOString(),
      kind: "invoice_created",
      title: `Fatura registrada (sem histórico detalhado) — fatura #${inv.id}`,
      amount: num(inv.value),
      actor: null,
      invoiceId: inv.id,
      source: "invoice",
      details: {
        type: "invoice_without_history",
        status: inv.status,
        dueDate: toDomainDate(inv.dueDate as any, tz),
        detail: inv.detail ?? null,
        legacyUnknown: inv.legacyUnknown ?? null
      },
      _ms: new Date(inv.createdAt).getTime(),
      _order: 2,
      _actorId: null
    });
  }

  merged.sort((a, b) => {
    if (b._ms !== a._ms) return b._ms - a._ms;
    if (a._order !== b._order) return a._order - b._order;
    return b.id.localeCompare(a.id, undefined, { numeric: true });
  });

  let page: Internal[];
  let nextBefore: string | null = null;
  if (merged.length <= limit) {
    page = merged;
  } else {
    page = merged.slice(0, limit);
    const boundary = merged[limit]._ms;
    if (page[page.length - 1]._ms === boundary) {
      // Itens no mesmo milissegundo não podem ser separados por um cursor exclusivo:
      // deixa todos para a próxima página (cursor = boundary + 1 ms).
      const trimmed = page.filter(i => i._ms !== boundary);
      if (trimmed.length) {
        page = trimmed;
        nextBefore = new Date(boundary + 1).toISOString();
      } else {
        // Caso extremo: a página inteira no mesmo ms → inclui todos os carregados desse ms.
        page = merged.filter(i => i._ms === boundary);
        nextBefore = new Date(boundary).toISOString();
      }
    } else {
      nextBefore = new Date(page[page.length - 1]._ms).toISOString();
    }
  }

  // Ator com nome (User).
  const actorIds = Array.from(
    new Set(page.map(i => i._actorId).filter((v): v is number => v != null))
  );
  const users = actorIds.length
    ? await User.findAll({ where: { id: { [Op.in]: actorIds } }, attributes: ["id", "name"] })
    : [];
  const names = new Map(users.map(u => [Number(u.id), u.name]));

  const first = await SaaSFinancialEvent.findOne({
    where: { companyId },
    order: [
      ["createdAt", "ASC"],
      ["id", "ASC"]
    ],
    attributes: ["id", "createdAt"]
  });

  return {
    items: page.map(({ _ms, _order, _actorId, ...item }) => ({
      ...item,
      actor:
        _actorId != null
          ? { id: _actorId, name: names.get(Number(_actorId)) ?? `Usuário #${_actorId}` }
          : null
    })),
    nextBefore,
    historyStartsAt: first ? new Date(first.createdAt).toISOString() : null
  };
}
