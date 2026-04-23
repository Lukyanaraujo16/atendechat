import { getIO } from "./socket";
import { logger } from "../utils/logger";
import SignupRequestSummaryCountsService, {
  type SignupRequestSummaryCounts
} from "../services/CompanySignupRequest/SignupRequestSummaryCountsService";

export type PlatformSignupSocketAction =
  | "new_request"
  | "critical_escalation"
  | "signup_updated";

export type PlatformSignupSocketPayload = {
  action: PlatformSignupSocketAction;
  requestId?: number;
  requestIds?: number[];
  companyName?: string;
  summary: SignupRequestSummaryCounts;
  ts: number;
};

type EmitInput = {
  action: PlatformSignupSocketAction;
  requestId?: number;
  requestIds?: number[];
  companyName?: string;
  summary?: SignupRequestSummaryCounts;
};

/**
 * Notifica Super Admins inscritos na sala `platform-super-admins` (socket.io).
 */
export async function emitPlatformSignupToSuperAdmins(
  input: EmitInput
): Promise<void> {
  try {
    const io = getIO();
    const summary =
      input.summary ?? (await SignupRequestSummaryCountsService());
    const payload: PlatformSignupSocketPayload = {
      action: input.action,
      requestId: input.requestId,
      requestIds: input.requestIds,
      companyName: input.companyName,
      summary,
      ts: Date.now()
    };
    io.to("platform-super-admins").emit("platformSignupRequest", payload);
  } catch (err) {
    logger.warn(
      `[platformSignupRealtime] emit falhou: ${err instanceof Error ? err.message : err}`
    );
  }
}
