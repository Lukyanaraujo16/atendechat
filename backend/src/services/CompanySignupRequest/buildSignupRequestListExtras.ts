import CompanySignupRequest from "../../models/CompanySignupRequest";
import {
  PRIMARY_ADMIN_INVITE_TTL_MS,
  SIGNUP_INVITE_STALE_DAYS,
  SIGNUP_NEW_BADGE_HOURS,
  SIGNUP_PENDING_STALE_DAYS
} from "../../constants/onboarding";

export type SignupRequestAlertCode =
  | "NEW_SIGNUP"
  | "PENDING_STALE"
  | "APPROVED_INVITE_PENDING"
  | "AWAITING_ACTIVATION"
  | "INVITE_STALE"
  | "INVITE_LIKELY_EXPIRED";

export type SignupRequestAlert = {
  code: SignupRequestAlertCode;
  severity: "info" | "warning" | "error";
};

/** Campos mínimos para calcular alertas (evita duplicar regras em SQL vs JS). */
export type SignupRequestAlertInput = {
  status: string;
  createdAt?: Date | string | null;
  invitationSentAt?: Date | string | null;
};

function hoursBetween(a: number, b: number): number {
  return (b - a) / (3600 * 1000);
}

function daysBetween(a: number, b: number): number {
  return (b - a) / (86400000);
}

/**
 * Regras de alerta (fonte única). Usado na listagem e como referência para contadores SQL.
 */
export function computeSignupRequestAlerts(
  row: SignupRequestAlertInput
): SignupRequestAlert[] {
  const now = Date.now();
  const createdAt = row.createdAt ? new Date(row.createdAt).getTime() : now;
  const alerts: SignupRequestAlert[] = [];

  if (row.status === "pending") {
    if (hoursBetween(createdAt, now) <= SIGNUP_NEW_BADGE_HOURS) {
      alerts.push({ code: "NEW_SIGNUP", severity: "info" });
    }
    if (daysBetween(createdAt, now) >= SIGNUP_PENDING_STALE_DAYS) {
      alerts.push({ code: "PENDING_STALE", severity: "warning" });
    }
  }

  if (row.status === "approved" && !row.invitationSentAt) {
    alerts.push({ code: "APPROVED_INVITE_PENDING", severity: "warning" });
  }

  if (
    row.invitationSentAt &&
    (row.status === "invited" || row.status === "approved")
  ) {
    const sent = new Date(row.invitationSentAt).getTime();
    const expiredByTtl = now - sent >= PRIMARY_ADMIN_INVITE_TTL_MS;

    if (expiredByTtl) {
      alerts.push({ code: "INVITE_LIKELY_EXPIRED", severity: "error" });
    } else if (daysBetween(sent, now) >= SIGNUP_INVITE_STALE_DAYS) {
      alerts.push({ code: "INVITE_STALE", severity: "warning" });
    } else if (row.status === "invited") {
      alerts.push({ code: "AWAITING_ACTIVATION", severity: "info" });
    }
  } else if (row.status === "invited") {
    alerts.push({ code: "AWAITING_ACTIVATION", severity: "info" });
  }

  return alerts;
}

export function signupAlertsIncludeCritical(alerts: SignupRequestAlert[]): boolean {
  return alerts.some(
    a => a.code === "INVITE_LIKELY_EXPIRED" || a.code === "PENDING_STALE"
  );
}

export function buildSignupRequestListExtras(row: CompanySignupRequest): {
  alerts: SignupRequestAlert[];
  isNewPendingHighlight: boolean;
  pendingDays: number | null;
  daysSinceInvite: number | null;
} {
  const alerts = computeSignupRequestAlerts(row);
  const now = Date.now();
  const createdAt = row.createdAt ? new Date(row.createdAt).getTime() : now;

  const isNewPendingHighlight = alerts.some(a => a.code === "NEW_SIGNUP");

  let pendingDays: number | null = null;
  if (row.status === "pending") {
    pendingDays = Math.floor(daysBetween(createdAt, now));
  }

  let daysSinceInvite: number | null = null;
  if (
    row.invitationSentAt &&
    (row.status === "invited" || row.status === "approved")
  ) {
    const sent = new Date(row.invitationSentAt).getTime();
    daysSinceInvite = Math.floor(daysBetween(sent, now));
  }

  return {
    alerts,
    isNewPendingHighlight,
    pendingDays,
    daysSinceInvite
  };
}
