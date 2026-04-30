import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import CompanySignupRequest from "../../models/CompanySignupRequest";
import Plan from "../../models/Plan";
import CreateCompanyService from "../CompanyService/CreateCompanyService";

export type ApproveCompanySignupRequestResult = {
  signupRequest: CompanySignupRequest;
  /** Só quando o convite por e-mail não foi enviado — entregar uma vez ao operador. */
  primaryAdminCredentials?: { email: string; temporaryPassword: string };
};

const ApproveCompanySignupRequestService = async (
  requestId: number,
  reviewerUserId: number
): Promise<ApproveCompanySignupRequestResult> => {
  let primaryAdminCredentials:
    | { email: string; temporaryPassword: string }
    | undefined;

  await sequelize.transaction(async (transaction: Transaction) => {
    const req = await CompanySignupRequest.findByPk(requestId, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });
    if (!req) {
      throw new AppError("ERR_SIGNUP_REQUEST_NOT_FOUND", 404);
    }
    if (req.status !== "pending") {
      throw new AppError("ERR_SIGNUP_REQUEST_NOT_PENDING", 400);
    }

    const createResult = await CreateCompanyService(
      {
        name: req.companyName,
        email: req.email.trim().toLowerCase(),
        phone: req.phone || undefined,
        planId: req.planId || undefined,
        dueDate: req.dueDate || undefined,
        recurrence: req.recurrence || undefined,
        campaignsEnabled: req.campaignsEnabled,
        status: true,
        primaryAdminName: req.adminName,
        password: undefined
      },
      { transaction }
    );

    const { company, primaryAdmin } = createResult;

    req.reviewedByUserId = reviewerUserId;
    const decidedAt = new Date();
    req.reviewedAt = decidedAt;
    req.approvedAt = decidedAt;
    req.createdCompanyId = company.id;

    if (primaryAdmin.inviteEmailSent === true) {
      const sentAt = new Date();
      req.status = "invited";
      req.invitationSentAt = sentAt;
      req.firstInvitationSentAt = sentAt;
    } else {
      req.status = "approved";
      if (primaryAdmin.temporaryPassword) {
        primaryAdminCredentials = {
          email: primaryAdmin.email,
          temporaryPassword: primaryAdmin.temporaryPassword
        };
      }
    }

    await req.save({ transaction });
  });

  const updated = await CompanySignupRequest.findByPk(requestId, {
    include: [{ model: Plan, required: false }]
  });
  if (!updated) {
    throw new AppError("ERR_SIGNUP_REQUEST_NOT_FOUND", 404);
  }
  return { signupRequest: updated, primaryAdminCredentials };
};

export default ApproveCompanySignupRequestService;
