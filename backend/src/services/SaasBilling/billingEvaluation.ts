/**
 * Fase 8.4-F — Contrato C1: motor PURO de avaliação de cobrança/bloqueio por empresa.
 *
 * - `evaluateCompanyBilling` não faz I/O: recebe empresa, configurações e (opcional) a data de hoje.
 * - Datas de domínio sempre `YYYY-MM-DD` no fuso da empresa (`toDomainDate`), aceitando o `Date`
 *   devolvido pelo `pg` para `Companies.dueDate` (timestamptz) — ver DECISOES.md D1/D10.
 * - `wouldBlock`/`wouldWarn*` espelham as regras do `BillingAutomationJob` (sem a deduplicação de avisos,
 *   que depende de CompanyLogs). A simulação usa este motor; o job só o usa com
 *   `BILLING_AUTOMATION_NORMALIZED_DATES` ligado.
 */
import { Op } from "sequelize";
import CompanyLog from "../../models/CompanyLog";
import {
  resolveSaasTimezone,
  toDomainDate,
  todayDomainDate
} from "../../helpers/saasDueDate";

export type BlockKind = "none" | "manual" | "financial" | "unknown";

export type FinancialStatus =
  | "sem_vencimento"
  | "em_dia"
  | "vence_hoje"
  | "carencia"
  | "vencido";

export type BillingSettingsInput = {
  daysBeforeDueWarning: number;
  daysAfterDueWarning: number;
  daysAfterDueBlock: number;
  enableAutoBlock: boolean;
  enableAutoWarning: boolean;
};

export type BillingEvaluationInput = {
  company: {
    id: number;
    dueDate: Date | string | null;
    status: boolean;
    timezone?: string | null;
  };
  lastBlockAction?: string | null;
  settings: BillingSettingsInput;
  /** YYYY-MM-DD; ausente → hoje no fuso da empresa. */
  today?: string;
};

export type BillingEvaluation = {
  companyId: number;
  dueDate: string | null;
  today: string;
  /** Dias até o vencimento (≥ 0); 0 quando vence hoje ou já venceu; null sem vencimento. */
  daysUntilDue: number | null;
  /** Dias de atraso (≥ 0); 0 quando em dia ou vence hoje; null sem vencimento. */
  daysLate: number | null;
  financialStatus: FinancialStatus;
  operationalStatus: "ativa" | "bloqueada";
  blockKind: BlockKind;
  wouldBlock: boolean;
  wouldWarnBeforeDue: boolean;
  wouldWarnAfterDue: boolean;
  reasons: string[];
};

/** Ações de CompanyLog que indicam o último estado de bloqueio. */
export const BLOCK_LOG_ACTIONS = [
  "block",
  "unblock",
  "auto_block",
  "auto_unblock_after_renew"
] as const;

const DOMAIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` válido de calendário (rejeita 2026-02-30, 2025-02-29). */
export function isValidDomainDate(value: unknown): value is string {
  if (typeof value !== "string" || !DOMAIN_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Diferença em dias de calendário (b − a) entre duas datas de domínio.
 * Calculada em UTC puro → imune a horário de verão do fuso da empresa.
 */
function diffDomainDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / MS_PER_DAY
  );
}

export function resolveBlockKind(
  status: boolean,
  lastBlockAction?: string | null
): BlockKind {
  if (status) return "none";
  if (lastBlockAction === "block") return "manual";
  if (lastBlockAction === "auto_block") return "financial";
  return "unknown";
}

export function evaluateCompanyBilling(
  input: BillingEvaluationInput
): BillingEvaluation {
  const { company, settings } = input;
  const tz = resolveSaasTimezone(company.timezone);
  const today = isValidDomainDate(input.today)
    ? input.today
    : todayDomainDate(tz);
  const dueDate = toDomainDate(company.dueDate, tz);
  const status = company.status === true;
  const operationalStatus = status ? "ativa" : "bloqueada";
  const blockKind = resolveBlockKind(status, input.lastBlockAction);
  const reasons: string[] = [];

  if (!status) {
    if (blockKind === "manual") reasons.push("Empresa bloqueada manualmente.");
    else if (blockKind === "financial")
      reasons.push("Empresa bloqueada automaticamente por atraso.");
    else reasons.push("Empresa bloqueada sem registro de bloqueio identificável.");
  }

  if (!dueDate) {
    reasons.push("Empresa sem vencimento definido: nenhuma ação automática.");
    return {
      companyId: company.id,
      dueDate: null,
      today,
      daysUntilDue: null,
      daysLate: null,
      financialStatus: "sem_vencimento",
      operationalStatus,
      blockKind,
      wouldBlock: false,
      wouldWarnBeforeDue: false,
      wouldWarnAfterDue: false,
      reasons
    };
  }

  // Valores com sinal, exatamente como no job (today − due / due − today).
  const rawLate = diffDomainDays(dueDate, today);
  const rawUntil = -rawLate;

  let financialStatus: FinancialStatus;
  if (rawLate < 0) financialStatus = "em_dia";
  else if (rawLate === 0) financialStatus = "vence_hoje";
  else if (rawLate < settings.daysAfterDueBlock) financialStatus = "carencia";
  else financialStatus = "vencido";

  const wouldBlock =
    settings.enableAutoBlock && status && rawLate >= settings.daysAfterDueBlock;
  const wouldWarnBeforeDue =
    settings.enableAutoWarning &&
    status &&
    rawUntil === settings.daysBeforeDueWarning;
  const wouldWarnAfterDue =
    settings.enableAutoWarning &&
    status &&
    rawLate === settings.daysAfterDueWarning;

  if (financialStatus === "em_dia")
    reasons.push(`Vence em ${rawUntil} dia(s).`);
  else if (financialStatus === "vence_hoje") reasons.push("Vence hoje.");
  else if (financialStatus === "carencia")
    reasons.push(
      `Em carência: ${rawLate} dia(s) de atraso (bloqueio a partir de ${settings.daysAfterDueBlock}).`
    );
  else reasons.push(`Vencida há ${rawLate} dia(s).`);

  if (wouldBlock) {
    reasons.push(
      `Seria bloqueada automaticamente (atraso ${rawLate} ≥ ${settings.daysAfterDueBlock}).`
    );
  } else if (rawLate >= settings.daysAfterDueBlock) {
    if (!settings.enableAutoBlock)
      reasons.push("Bloqueio automático desativado nas configurações.");
    else if (!status) reasons.push("Já está bloqueada.");
  }
  if (wouldWarnBeforeDue)
    reasons.push("Aviso antes do vencimento seria enviado hoje (se ainda não enviado).");
  if (wouldWarnAfterDue)
    reasons.push("Aviso após o vencimento seria enviado hoje (se ainda não enviado).");
  if (
    !settings.enableAutoWarning &&
    status &&
    (rawUntil === settings.daysBeforeDueWarning ||
      rawLate === settings.daysAfterDueWarning)
  ) {
    reasons.push("Avisos automáticos desativados nas configurações.");
  }

  return {
    companyId: company.id,
    dueDate,
    today,
    daysUntilDue: Math.max(0, rawUntil),
    daysLate: Math.max(0, rawLate),
    financialStatus,
    operationalStatus,
    blockKind,
    wouldBlock,
    wouldWarnBeforeDue,
    wouldWarnAfterDue,
    reasons
  };
}

/**
 * Última ação de bloqueio/desbloqueio por empresa, em UMA consulta (somente leitura).
 * Empresas sem registro ficam fora do Map.
 */
export async function loadLastBlockActions(
  companyIds: number[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const ids = Array.from(
    new Set(companyIds.filter(id => Number.isInteger(id) && id > 0))
  );
  if (ids.length === 0) return result;

  const rows = (await CompanyLog.findAll({
    where: {
      companyId: { [Op.in]: ids },
      action: { [Op.in]: [...BLOCK_LOG_ACTIONS] }
    },
    attributes: ["id", "companyId", "action", "createdAt"],
    order: [
      ["companyId", "ASC"],
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    raw: true
  })) as unknown as Array<{ companyId: number; action: string }>;

  for (const row of rows) {
    const cid = Number(row.companyId);
    if (!result.has(cid)) result.set(cid, row.action);
  }
  return result;
}

export type BillingJobMode = "legacy" | "normalized";

/**
 * Modo do BillingAutomationJob, lido do ambiente a cada chamada.
 * `BILLING_AUTOMATION_NORMALIZED_DATES` = "true" | "1" → normalized; qualquer outro valor → legacy (default).
 */
export function resolveBillingJobMode(
  env: NodeJS.ProcessEnv = process.env
): BillingJobMode {
  const raw = String(env.BILLING_AUTOMATION_NORMALIZED_DATES ?? "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1" ? "normalized" : "legacy";
}
