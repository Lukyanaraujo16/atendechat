import Queue from "../models/Queue";
import Company from "../models/Company";
import User from "../models/User";
import { getCompanyFinanceFlags, CompanyFinanceFlags } from "./companyFinanceStatus";
import { loadCompanyPlanContextByCompanyId } from "../middleware/loadCompanyEffectiveFeatures";
import { computeEffectiveUserFeatureMapForUserId } from "../services/UserFeaturePermission/UserFeaturePermissionService";
import { logger } from "../utils/logger";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  companyId: number | null;
  company: Company | null;
  super: boolean;
  queues: Queue[];
  allTicket: string;
  finance: CompanyFinanceFlags;
  /** Mapa final: plano da empresa ∧ permissões individuais (admin/super ignora granularidade). */
  effectiveUserFeatures: Record<string, boolean>;
  /** Primeiro acesso: o frontend deve pedir alteração de palavra-passe. */
  mustChangePassword?: boolean;
  /** Modo suporte: sessão atua no tenant `companyId`; casa em `supportHomeCompanyId`. */
  supportMode?: boolean;
  supportHomeCompanyId?: number | null;
}

type SerializeUserOptions = {
  /** Empresa cujo plano deve calibrar `effectiveUserFeatures` (modo suporte = tenant visitado). */
  effectiveCompanyIdForPlan?: number | null;
};

async function resolveEffectiveUserFeatures(
  user: User,
  companyId: number | null
): Promise<Record<string, boolean>> {
  if (!companyId) return {};
  const ctx = await loadCompanyPlanContextByCompanyId(companyId);
  if (!ctx) return {};
  return computeEffectiveUserFeatureMapForUserId(user.id, ctx.featureMap);
}

export const SerializeUser = async (
  user: User,
  opts?: SerializeUserOptions
): Promise<SerializedUser> => {
  const planCompanyId =
    opts?.effectiveCompanyIdForPlan !== undefined
      ? opts.effectiveCompanyIdForPlan
      : user.companyId ?? null;

  const effectiveUserFeatures = await resolveEffectiveUserFeatures(user, planCompanyId);

  const attendanceInbox = effectiveUserFeatures["attendance.inbox"] === true;
  const attendanceKanban = effectiveUserFeatures["attendance.kanban"] === true;
  logger.info(
    {
      tag: "[DiagAttendanceAuth]",
      event: "effective_features",
      userId: user.id,
      companyId: planCompanyId,
      profile: user.profile,
      hasAttendanceInbox: attendanceInbox,
      attendanceInbox,
      hasAttendanceKanban: attendanceKanban,
      attendanceKanban,
      keysCount: Object.keys(effectiveUserFeatures).length
    },
    "[DiagAttendanceAuth] effective_features"
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company: user.company,
    super: user.super,
    queues: user.queues,
    allTicket: user.allTicket,
    mustChangePassword: user.mustChangePassword === true,
    finance: user.company
      ? getCompanyFinanceFlags(user.company)
      : {
          overdue: false,
          delinquent: false,
          dueDate: null,
          daysPastDue: null
        },
    effectiveUserFeatures
  };
};

/**
 * Serialização quando o JWT usa empresa efetiva diferente da do utilizador (modo suporte).
 */
export const serializeUserForSession = async (
  user: User,
  effectiveCompanyId: number | null
): Promise<SerializedUser> => {
  const planCid =
    effectiveCompanyId != null ? effectiveCompanyId : user.companyId ?? null;
  const base = await SerializeUser(user, { effectiveCompanyIdForPlan: planCid });
  if (
    effectiveCompanyId == null ||
    effectiveCompanyId === user.companyId
  ) {
    return base;
  }
  const target = await Company.findByPk(effectiveCompanyId, {
    attributes: [
      "id",
      "name",
      "dueDate",
      "timezone",
      "businessSegment",
      "crmVisibilityMode"
    ]
  });
  if (!target) {
    return base;
  }
  return {
    ...base,
    companyId: effectiveCompanyId,
    company: target,
    finance: getCompanyFinanceFlags(target),
    supportMode: true,
    supportHomeCompanyId: user.companyId ?? null
  };
};
