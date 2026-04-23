import cron from "node-cron";
import { Op } from "sequelize";
import CompanySignupRequest from "../models/CompanySignupRequest";
import {
  signupQueryInviteExpiredBefore,
  signupQueryPendingStaleBefore
} from "../constants/onboarding";
import { emitPlatformSignupToSuperAdmins } from "../libs/platformSignupRealtime";
import { logger } from "../utils/logger";

let previousCriticalIdSet: Set<number> | null = null;
let baselineDone = false;

async function fetchCriticalSignupIds(): Promise<number[]> {
  const staleBefore = signupQueryPendingStaleBefore();
  const inviteExpiredBefore = signupQueryInviteExpiredBefore();
  const rows = await CompanySignupRequest.findAll({
    attributes: ["id"],
    where: {
      [Op.or]: [
        { status: "pending", createdAt: { [Op.lte]: staleBefore } },
        {
          [Op.and]: [
            { status: { [Op.in]: ["invited", "approved"] } },
            { invitationSentAt: { [Op.not]: null } },
            { invitationSentAt: { [Op.lte]: inviteExpiredBefore } }
          ]
        }
      ]
    },
    order: [["id", "ASC"]]
  });
  return rows.map(r => r.id);
}

/**
 * Deteta pedidos que **entraram** no conjunto crítico desde a última execução.
 * Primeira execução só calibra baseline (sem toast no cliente).
 * Intervalo 15 min: equilíbrio entre tempo de reação e carga.
 */
async function runSignupCriticalCheck(): Promise<void> {
  try {
    const currentIds = await fetchCriticalSignupIds();
    const currentSet = new Set(currentIds);

    if (!baselineDone) {
      previousCriticalIdSet = currentSet;
      baselineDone = true;
      return;
    }

    const prev = previousCriticalIdSet ?? new Set<number>();
    const newlyCritical = currentIds.filter(id => !prev.has(id));
    previousCriticalIdSet = currentSet;

    if (newlyCritical.length === 0) {
      return;
    }

    await emitPlatformSignupToSuperAdmins({
      action: "critical_escalation",
      requestIds: newlyCritical
    });

    logger.info(
      `[SignupCriticalSocket] newlyCritical count=${newlyCritical.length} ids=${newlyCritical.join(",")}`
    );
  } catch (err) {
    logger.warn(
      `[SignupCriticalSocket] job error: ${err instanceof Error ? err.message : err}`
    );
  }
}

export function startSignupCriticalSocketScheduler(): void {
  cron.schedule("*/15 * * * *", runSignupCriticalCheck);
  logger.info("[SignupCriticalSocket] scheduler every 15 minutes");
}
