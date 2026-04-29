import Plan from "../models/Plan";
import { getAllFeatureKeys } from "./features";

const asBool = (v: unknown): boolean => v === true || v === "true";

/**
 * Valor efetivo vindo só das colunas legadas do Plan (quando não há linha em PlanFeatures).
 */
export function legacyPlanFeatureValue(
  plan: Plan | null | undefined,
  featureKey: string
): boolean {
  if (!plan) return false;
  switch (featureKey) {
    case "dashboard.main":
    case "dashboard.reports":
    case "attendance.inbox":
    case "contacts.crm":
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
    case "attendance.kanban":
      return asBool(plan.getDataValue("useKanban"));
    case "attendance.internal_chat":
      return asBool(plan.getDataValue("useInternalChat"));
    case "automation.openai":
      return asBool(plan.getDataValue("useOpenAi"));
    case "automation.integrations":
      return asBool(plan.getDataValue("useIntegrations"));
    case "agenda.appointments":
    case "attendance.schedules":
      return asBool(plan.getDataValue("useSchedules"));
    case "settings.api":
      return asBool(plan.getDataValue("useExternalApi"));
    case "campaigns.sends":
    case "campaigns.lists":
    case "automation.chatbot":
    case "automation.keywords":
    case "automation.quick_replies":
      return asBool(plan.getDataValue("useCampaigns"));
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
  plan: Plan | null | undefined
): Record<string, boolean> {
  const keys = getAllFeatureKeys();
  const out: Record<string, boolean> = {};
  for (const k of keys) {
    out[k] = legacyPlanFeatureValue(plan, k);
  }
  return out;
}
