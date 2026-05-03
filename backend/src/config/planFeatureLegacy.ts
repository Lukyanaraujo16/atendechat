import Plan from "../models/Plan";
import { getAllFeatureKeys } from "./features";

const asBool = (v: unknown): boolean => v === true || v === "true";

/** Lê coluna do plano (instância Sequelize ou objeto plain vindo de `toJSON()`). */
export function readPlanColumn(plan: Plan | Record<string, unknown> | null | undefined, key: string): unknown {
  if (!plan || typeof plan !== "object") return undefined;
  const anyPlan = plan as Plan & Record<string, unknown>;
  if (typeof anyPlan.getDataValue === "function") {
    try {
      return anyPlan.getDataValue(key as keyof Plan);
    } catch {
      return undefined;
    }
  }
  return anyPlan[key];
}

/**
 * Valor efetivo vindo só das colunas legadas do Plan (quando não há linha em PlanFeatures).
 */
export function legacyPlanFeatureValue(
  plan: Plan | Record<string, unknown> | null | undefined,
  featureKey: string
): boolean {
  if (!plan) return false;
  switch (featureKey) {
    case "dashboard.main":
    case "dashboard.reports":
    case "attendance.inbox":
    case "contacts.tags":
    case "contacts.files":
    case "settings.connections":
    case "agenda.calendar":
    case "team.users":
    case "team.queues":
    case "team.ratings":
    case "team.groups":
    case "finance.subscription":
    case "finance.invoices":
      return true;
    case "crm.pipeline":
      return false;
    case "attendance.kanban":
      return asBool(readPlanColumn(plan, "useKanban"));
    case "attendance.internal_chat":
      return asBool(readPlanColumn(plan, "useInternalChat"));
    case "automation.openai":
      return asBool(readPlanColumn(plan, "useOpenAi"));
    case "automation.integrations":
      return asBool(readPlanColumn(plan, "useIntegrations"));
    case "agenda.appointments":
    case "attendance.schedules":
      return asBool(readPlanColumn(plan, "useSchedules"));
    case "settings.api":
      return asBool(readPlanColumn(plan, "useExternalApi"));
    case "campaigns.sends":
    case "campaigns.lists":
    case "automation.chatbot":
    case "automation.keywords":
    case "automation.quick_replies":
      return asBool(readPlanColumn(plan, "useCampaigns"));
    default:
      return true;
  }
}

/**
 * Deriva colunas legadas do Plan a partir do mapa de features (para compatibilidade com código existente).
 */
export function deriveLegacyPlanColumnsFromFeatures(
  featureMap: Record<string, boolean>
): Record<string, boolean> {
  const on = (k: string) => featureMap[k] === true;
  const campaigns =
    on("campaigns.sends") ||
    on("campaigns.lists") ||
    on("automation.chatbot") ||
    on("automation.keywords") ||
    on("automation.quick_replies");

  return {
    useKanban: on("attendance.kanban"),
    useInternalChat: on("attendance.internal_chat"),
    useOpenAi: on("automation.openai"),
    useIntegrations: on("automation.integrations"),
    useSchedules: on("agenda.appointments") || on("attendance.schedules"),
    useExternalApi: on("settings.api"),
    useCampaigns: campaigns
  };
}

/** Mapa inicial (todos os keys) a partir do plano legado — usado ao migrar UI / resposta API. */
export function buildDefaultFeatureMapFromPlan(
  plan: Plan | Record<string, unknown> | null | undefined
): Record<string, boolean> {
  const keys = getAllFeatureKeys();
  const out: Record<string, boolean> = {};
  for (const k of keys) {
    out[k] = legacyPlanFeatureValue(plan, k);
  }
  return out;
}

/**
 * Indica plano “completo” ao nível das colunas legadas — usado para detetar
 * tabela PlanFeatures inconsistente (ex.: chaves omitidas no payload gravadas como false).
 */
export function planLegacyColumnsIndicateFullAccess(
  plan: Plan | Record<string, unknown> | null | undefined
): boolean {
  if (!plan) return false;
  return (
    asBool(readPlanColumn(plan, "useKanban")) &&
    asBool(readPlanColumn(plan, "useCampaigns")) &&
    asBool(readPlanColumn(plan, "useSchedules")) &&
    asBool(readPlanColumn(plan, "useInternalChat")) &&
    asBool(readPlanColumn(plan, "useExternalApi")) &&
    asBool(readPlanColumn(plan, "useOpenAi")) &&
    asBool(readPlanColumn(plan, "useIntegrations"))
  );
}
