import { Op } from "sequelize";
import CompanySignupRequest from "../../models/CompanySignupRequest";
import {
  signupQueryInviteExpiredBefore,
  signupQueryNewPendingFrom,
  signupQueryPendingStaleBefore
} from "../../constants/onboarding";

export type SignupRequestSummaryCounts = {
  newCount: number;
  pendingCount: number;
  awaitingActivationCount: number;
  criticalCount: number;
  rejectedCount: number;
};

/**
 * Contadores globais (sem filtro de pesquisa). Mesmos limiares que `computeSignupRequestAlerts`.
 */
const SignupRequestSummaryCountsService =
  async (): Promise<SignupRequestSummaryCounts> => {
    const newFrom = signupQueryNewPendingFrom();
    const staleBefore = signupQueryPendingStaleBefore();
    const inviteExpiredBefore = signupQueryInviteExpiredBefore();

    const [
      newCount,
      pendingCount,
      awaitingActivationCount,
      rejectedCount,
      criticalCount
    ] = await Promise.all([
      CompanySignupRequest.count({
        where: { status: "pending", createdAt: { [Op.gte]: newFrom } }
      }),
      CompanySignupRequest.count({ where: { status: "pending" } }),
      CompanySignupRequest.count({
        where: { status: { [Op.in]: ["approved", "invited"] } }
      }),
      CompanySignupRequest.count({ where: { status: "rejected" } }),
      CompanySignupRequest.count({
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
        }
      })
    ]);

    return {
      newCount,
      pendingCount,
      awaitingActivationCount,
      criticalCount,
      rejectedCount
    };
  };

export default SignupRequestSummaryCountsService;
