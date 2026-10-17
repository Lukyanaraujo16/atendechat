/**
 * Fase 8.4-F — Contrato C2: simulação da automação de cobrança e status em lote.
 *
 * SOMENTE LEITURA: apenas SELECTs (configurações, empresas, último log de bloqueio).
 * Nunca cria/atualiza registros, nunca grava CompanyLog, nunca notifica nem envia WhatsApp,
 * nunca enfileira nada e NÃO importa/chama o BillingAutomationJob.
 */
import { Op } from "sequelize";
import Company from "../../models/Company";
import GetSystemBillingSettingsService from "../SystemSettingService/GetSystemBillingSettingsService";
import { DEFAULT_SAAS_TIMEZONE, todayDomainDate } from "../../helpers/saasDueDate";
import {
  BillingEvaluation,
  BillingJobMode,
  BillingSettingsInput,
  evaluateCompanyBilling,
  loadLastBlockActions,
  resolveBillingJobMode
} from "./billingEvaluation";

const DOMAIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SimulatedCompany = BillingEvaluation & {
  name: string;
  /**
   * true quando o job em modo "legacy" pularia esta empresa (dueDate não é string `YYYY-MM-DD`,
   * p.ex. `Date` vindo do timestamptz) — ver DECISOES.md D10/D15.
   */
  legacyJobWouldSkip: boolean;
};

export type BillingSimulationSummary = {
  total: number;
  wouldBlock: number;
  inGrace: number;
  active: number;
  wouldWarnBeforeDue: number;
  wouldWarnAfterDue: number;
  noDueDate: number;
  blockedManual: number;
  blockedFinancial: number;
  blockedUnknown: number;
  /** Extensão: empresas que o job legado ignoraria. */
  legacyJobWouldSkip: number;
};

export type BillingSimulationResult = {
  generatedAt: string;
  today: string;
  readOnly: true;
  settings: BillingSettingsInput;
  jobMode: BillingJobMode;
  summary: BillingSimulationSummary;
  companies: SimulatedCompany[];
};

export type CompanyBillingStatusItem = Pick<
  BillingEvaluation,
  | "companyId"
  | "dueDate"
  | "financialStatus"
  | "operationalStatus"
  | "blockKind"
  | "daysLate"
>;

type CompanyRow = {
  id: number;
  name: string;
  dueDate: Date | string | null;
  status: boolean;
  timezone: string | null;
};

/** Reproduz a condição de entrada do job legado (BillingAutomationJob, modo legacy). */
function legacyWouldSkip(dueDate: unknown): boolean {
  if (!dueDate || typeof dueDate !== "string") return true;
  return !DOMAIN_DATE_RE.test(dueDate.trim());
}

async function loadSettingsInput(): Promise<BillingSettingsInput> {
  const s = await GetSystemBillingSettingsService();
  return {
    daysBeforeDueWarning: s.daysBeforeDueWarning,
    daysAfterDueWarning: s.daysAfterDueWarning,
    daysAfterDueBlock: s.daysAfterDueBlock,
    enableAutoBlock: s.enableAutoBlock,
    enableAutoWarning: s.enableAutoWarning
  };
}

async function loadCompanies(companyIds?: number[]): Promise<CompanyRow[]> {
  const where =
    companyIds && companyIds.length > 0
      ? { id: { [Op.in]: companyIds } }
      : undefined;
  const rows = await Company.findAll({
    ...(where ? { where } : {}),
    attributes: ["id", "name", "dueDate", "status", "timezone"],
    order: [["id", "ASC"]],
    raw: true
  });
  return rows as unknown as CompanyRow[];
}

async function evaluateAll(
  companies: CompanyRow[],
  settings: BillingSettingsInput,
  today?: string
): Promise<Array<{ row: CompanyRow; evaluation: BillingEvaluation }>> {
  const blockedIds = companies.filter(c => c.status !== true).map(c => c.id);
  const lastActions = await loadLastBlockActions(blockedIds);
  return companies.map(row => ({
    row,
    evaluation: evaluateCompanyBilling({
      company: {
        id: row.id,
        dueDate: row.dueDate,
        status: row.status === true,
        timezone: row.timezone
      },
      lastBlockAction: lastActions.get(row.id) ?? null,
      settings,
      ...(today ? { today } : {})
    })
  }));
}

export async function simulateBillingAutomation(
  opts: { today?: string } = {}
): Promise<BillingSimulationResult> {
  const settings = await loadSettingsInput();
  const companies = await loadCompanies();
  const evaluated = await evaluateAll(companies, settings, opts.today);

  const summary: BillingSimulationSummary = {
    total: 0,
    wouldBlock: 0,
    inGrace: 0,
    active: 0,
    wouldWarnBeforeDue: 0,
    wouldWarnAfterDue: 0,
    noDueDate: 0,
    blockedManual: 0,
    blockedFinancial: 0,
    blockedUnknown: 0,
    legacyJobWouldSkip: 0
  };

  const list: SimulatedCompany[] = evaluated.map(({ row, evaluation }) => {
    const skip = legacyWouldSkip(row.dueDate);
    summary.total += 1;
    if (evaluation.wouldBlock) summary.wouldBlock += 1;
    if (evaluation.financialStatus === "carencia") summary.inGrace += 1;
    if (evaluation.operationalStatus === "ativa") summary.active += 1;
    if (evaluation.wouldWarnBeforeDue) summary.wouldWarnBeforeDue += 1;
    if (evaluation.wouldWarnAfterDue) summary.wouldWarnAfterDue += 1;
    if (evaluation.financialStatus === "sem_vencimento") summary.noDueDate += 1;
    if (evaluation.blockKind === "manual") summary.blockedManual += 1;
    if (evaluation.blockKind === "financial") summary.blockedFinancial += 1;
    if (evaluation.blockKind === "unknown") summary.blockedUnknown += 1;
    if (skip && evaluation.operationalStatus === "ativa")
      summary.legacyJobWouldSkip += 1;
    return { ...evaluation, name: row.name, legacyJobWouldSkip: skip };
  });

  return {
    generatedAt: new Date().toISOString(),
    today: opts.today ?? todayDomainDate(DEFAULT_SAAS_TIMEZONE),
    readOnly: true,
    settings,
    jobMode: resolveBillingJobMode(),
    summary,
    companies: list
  };
}

export async function listCompaniesBillingStatus(
  opts: { companyIds?: number[] } = {}
): Promise<{ companies: CompanyBillingStatusItem[] }> {
  const settings = await loadSettingsInput();
  const companies = await loadCompanies(opts.companyIds);
  const evaluated = await evaluateAll(companies, settings);
  return {
    companies: evaluated.map(({ evaluation: e }) => ({
      companyId: e.companyId,
      dueDate: e.dueDate,
      financialStatus: e.financialStatus,
      operationalStatus: e.operationalStatus,
      blockKind: e.blockKind,
      daysLate: e.daysLate
    }))
  };
}
