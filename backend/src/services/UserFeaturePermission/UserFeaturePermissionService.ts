import { Transaction } from "sequelize";
import { Request } from "express";
import User from "../../models/User";
import UserFeaturePermission from "../../models/UserFeaturePermission";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import AppError from "../../errors/AppError";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import { getAllFeatureKeys } from "../../config/features";
import {
  loadPersistedPlanFeatureMap,
  getEffectivePlanFeaturesMap
} from "../PlanService/GetEffectivePlanFeaturesService";
import { getPlanIdFromContext } from "../PlanService/planIdResolve";

export const USER_FEATURE_DISABLED_MSG =
  "Você não tem permissão para acessar este recurso.";

const CATALOG = new Set(getAllFeatureKeys());

const LOG_TAG = "[UserPermissions]" as const;

/**
 * Modo legado: sem linhas em `UserFeaturePermissions`, o utilizador não-admin herda
 * todas as features do plano até ser gravado explicitamente (ex.: primeiro save no modal).
 */
export function logUserPermissionsUpdated(meta: {
  companyId: number;
  actorUserId: number | null;
  targetUserId: number;
  before: Record<string, boolean>;
  after: Record<string, boolean>;
  source: string;
  legacyModeBefore?: boolean;
}): void {
  logger.info(
    {
      tag: LOG_TAG,
      event: "permissions_updated",
      companyId: meta.companyId,
      actorUserId: meta.actorUserId,
      targetUserId: meta.targetUserId,
      before: meta.before,
      after: meta.after,
      source: meta.source,
      legacyModeBefore: meta.legacyModeBefore
    },
    `${LOG_TAG} permissions updated`
  );
}

/**
 * Notifica o utilizador alvo. O cliente entra na sala `user-${id}` em `libs/socket.ts`;
 * `useAuth` escuta este evento e pede recarregamento — até refresh/relogin o JWT não reflete o novo mapa.
 */
export function emitUserPermissionsUpdated(
  targetUserId: number,
  companyId: number
): void {
  try {
    const io = getIO();
    io.to(`user-${targetUserId}`).emit("user-permissions-updated", { companyId });
  } catch {
    /* IO ainda não inicializado */
  }
}

export async function loadExplicitUserFeatureMap(
  userId: number
): Promise<Record<string, boolean> | null> {
  const count = await UserFeaturePermission.count({ where: { userId } });
  if (count === 0) return null;
  const rows = await UserFeaturePermission.findAll({ where: { userId } });
  const m: Record<string, boolean> = {};
  for (const r of rows) {
    m[r.featureKey] = r.enabled === true;
  }
  return m;
}

export function mergePlanWithUserFeatures(
  planMap: Record<string, boolean>,
  userRow: Pick<User, "super" | "profile">,
  jwt: { supportMode?: boolean },
  explicitMap: Record<string, boolean> | null
): Record<string, boolean> {
  const bypass =
    userRow.super === true ||
    userRow.profile === "superadmin" ||
    jwt.supportMode === true ||
    userRow.profile === "admin";
  const out: Record<string, boolean> = {};
  for (const [k, planOn] of Object.entries(planMap)) {
    if (!planOn) {
      out[k] = false;
      continue;
    }
    if (bypass) {
      out[k] = true;
      continue;
    }
    if (explicitMap === null) {
      out[k] = true;
    } else {
      out[k] = explicitMap[k] === true;
    }
  }
  return out;
}

export async function computeEffectiveUserFeatureMapForRequest(
  req: Request,
  planMap: Record<string, boolean>
): Promise<Record<string, boolean>> {
  const userRow = await User.findByPk(req.user.id, {
    attributes: ["id", "super", "profile"]
  });
  if (!userRow) {
    return Object.fromEntries(
      Object.entries(planMap).map(([k, v]) => [k, v === true])
    );
  }
  const explicit = await loadExplicitUserFeatureMap(userRow.id);
  return mergePlanWithUserFeatures(planMap, userRow, req.user as { supportMode?: boolean }, explicit);
}

export async function computeEffectiveUserFeatureMapForUserId(
  userId: number,
  planMap: Record<string, boolean>
): Promise<Record<string, boolean>> {
  const userRow = await User.findByPk(userId, {
    attributes: ["id", "super", "profile"]
  });
  if (!userRow) {
    return Object.fromEntries(
      Object.entries(planMap).map(([k, v]) => [k, v === true])
    );
  }
  const explicit = await loadExplicitUserFeatureMap(userId);
  return mergePlanWithUserFeatures(planMap, userRow, {}, explicit);
}

function buildDefaultPermissionState(
  planMap: Record<string, boolean>,
  profile: string
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const setIfPlan = (key: string, v: boolean) => {
    if (planMap[key] === true) out[key] = v;
  };

  for (const k of getAllFeatureKeys()) {
    if (planMap[k] === true) out[k] = false;
  }

  setIfPlan("dashboard.main", true);
  setIfPlan("dashboard.reports", false);
  setIfPlan("attendance.inbox", true);
  setIfPlan("attendance.internal_chat", true);

  if (profile === "supervisor") {
    setIfPlan("dashboard.reports", true);
    setIfPlan("attendance.kanban", true);
    setIfPlan("contacts.tags", true);
    setIfPlan("contacts.files", true);
    setIfPlan("team.groups", true);
    setIfPlan("team.queues", true);
    setIfPlan("agenda.calendar", true);
    setIfPlan("crm.pipeline", true);
    setIfPlan("agenda.appointments", false);
    setIfPlan("attendance.schedules", false);
    setIfPlan("team.users", false);
    setIfPlan("campaigns.sends", false);
    setIfPlan("campaigns.lists", false);
    setIfPlan("automation.chatbot", false);
    setIfPlan("automation.keywords", false);
    setIfPlan("automation.quick_replies", false);
    setIfPlan("automation.openai", false);
    setIfPlan("automation.integrations", false);
    setIfPlan("settings.api", false);
    setIfPlan("settings.connections", false);
    setIfPlan("settings.instagram_integration", false);
    setIfPlan("finance.subscription", false);
    setIfPlan("finance.invoices", false);
    setIfPlan("team.ratings", false);
  }

  return out;
}

export async function replaceUserFeaturePermissions(
  userId: number,
  companyId: number,
  state: Record<string, boolean>,
  transaction?: Transaction
): Promise<void> {
  await UserFeaturePermission.destroy({
    where: { userId },
    transaction
  });
  const rows = Object.entries(state).map(([featureKey, enabled]) => ({
    companyId,
    userId,
    featureKey,
    enabled: enabled === true
  }));
  if (rows.length) {
    await UserFeaturePermission.bulkCreate(rows, { transaction });
  }
}

export async function seedDefaultUserFeaturePermissions(
  userId: number,
  companyId: number,
  profile: string,
  planMap: Record<string, boolean>,
  opts?: { actorUserId?: number | null }
): Promise<void> {
  if (profile !== "user" && profile !== "supervisor") return;
  const keysInPlan = getAllFeatureKeys().filter((k) => planMap[k] === true);
  const beforeExplicit = await loadExplicitUserFeatureMap(userId);
  const beforeForLog: Record<string, boolean> = {};
  for (const k of keysInPlan) {
    beforeForLog[k] =
      beforeExplicit === null ? true : beforeExplicit[k] === true;
  }
  const state = buildDefaultPermissionState(planMap, profile);
  await replaceUserFeaturePermissions(userId, companyId, state);
  logUserPermissionsUpdated({
    companyId,
    actorUserId: opts?.actorUserId ?? null,
    targetUserId: userId,
    before: beforeForLog,
    after: { ...state },
    source: "seedDefaultUserFeaturePermissions",
    legacyModeBefore: beforeExplicit === null
  });
  emitUserPermissionsUpdated(userId, companyId);
}

export async function clearUserFeaturePermissions(
  userId: number,
  transaction?: Transaction
): Promise<void> {
  await UserFeaturePermission.destroy({ where: { userId }, transaction });
}

export async function setUserFeaturePermissionsFromAdminInput(params: {
  targetUserId: number;
  companyId: number;
  planMap: Record<string, boolean>;
  input: Record<string, unknown>;
  actor: Pick<User, "id" | "profile" | "super">;
}): Promise<void> {
  const { targetUserId, companyId, planMap, input, actor } = params;
  const target = await User.findByPk(targetUserId, {
    attributes: ["id", "profile", "companyId"]
  });
  if (!target || target.companyId !== companyId) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }
  if (target.profile === "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  for (const [k, raw] of Object.entries(input)) {
    if (!CATALOG.has(k)) {
      throw new AppError("ERR_INVALID_FEATURE_KEY", 400);
    }
    if (raw === true && planMap[k] !== true) {
      throw new AppError("ERR_PLAN_FEATURE_DISABLED", 403);
    }
  }

  const keysInPlan = getAllFeatureKeys().filter((k) => planMap[k] === true);
  const beforeExplicit = await loadExplicitUserFeatureMap(targetUserId);
  const beforeForLog: Record<string, boolean> = {};
  for (const k of keysInPlan) {
    beforeForLog[k] =
      beforeExplicit === null ? true : beforeExplicit[k] === true;
  }

  const next: Record<string, boolean> = {};
  for (const k of keysInPlan) {
    next[k] = input[k] === true;
  }

  if (actor.profile === "supervisor" && actor.super !== true) {
    const actorMerged = await computeEffectiveUserFeatureMapForUserId(
      actor.id,
      planMap
    );
    for (const k of keysInPlan) {
      if (next[k] === true && actorMerged[k] !== true) {
        throw new AppError(
          "ERR_NO_PERMISSION",
          403,
          "Não pode conceder uma permissão que não possui."
        );
      }
    }
  }

  await replaceUserFeaturePermissions(targetUserId, companyId, next);
  logUserPermissionsUpdated({
    companyId,
    actorUserId: actor.id,
    targetUserId,
    before: beforeForLog,
    after: { ...next },
    source: "setUserFeaturePermissionsFromAdminInput",
    legacyModeBefore: beforeExplicit === null
  });
  emitUserPermissionsUpdated(targetUserId, companyId);
}

export async function loadPlanFeatureMapForCompanyId(
  companyId: number
): Promise<Record<string, boolean>> {
  const company = await Company.findByPk(companyId, {
    include: [{ model: Plan, as: "plan" }]
  });
  if (!company?.plan) {
    return {};
  }
  const persisted = await loadPersistedPlanFeatureMap(getPlanIdFromContext(company));
  return getEffectivePlanFeaturesMap(company.plan, persisted, company.modulePermissions);
}

export async function assertActorCanManageUsers(
  actor: Pick<User, "id" | "profile" | "super">,
  planMap: Record<string, boolean>
): Promise<void> {
  if (actor.super === true) return;
  if (actor.profile === "superadmin") return;
  if (actor.profile === "admin") return;
  if (actor.profile === "supervisor") {
    const explicit = await loadExplicitUserFeatureMap(actor.id);
    const merged = mergePlanWithUserFeatures(planMap, actor, {}, explicit);
    if (merged["team.users"] === true) return;
  }
  throw new AppError("ERR_NO_PERMISSION", 403);
}

export async function assertSupervisorTargetRules(params: {
  actor: Pick<User, "profile">;
  targetProfile: string;
  nextProfile?: string;
}): Promise<void> {
  const { actor, targetProfile, nextProfile } = params;
  if (actor.profile !== "supervisor") return;
  if (targetProfile === "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const prof = nextProfile ?? targetProfile;
  if (prof === "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
}
