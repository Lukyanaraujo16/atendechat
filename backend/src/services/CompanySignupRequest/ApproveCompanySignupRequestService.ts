import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import CompanySignupRequest from "../../models/CompanySignupRequest";
import Plan from "../../models/Plan";
import CreateCompanyService from "../CompanyService/CreateCompanyService";

const ApproveCompanySignupRequestService = async (
  requestId: number,
  reviewerUserId: number
): Promise<CompanySignupRequest> => {
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

    const { company, primaryAdminInviteEmailSent } = await CreateCompanyService(
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

    req.reviewedByUserId = reviewerUserId;
    const decidedAt = new Date();
    req.reviewedAt = decidedAt;
    req.approvedAt = decidedAt;
    req.createdCompanyId = company.id;

    if (primaryAdminInviteEmailSent === true) {
      const sentAt = new Date();
      req.status = "invited";
      req.invitationSentAt = sentAt;
      req.firstInvitationSentAt = sentAt;
    } else {
      req.status = "approved";
    }

    await req.save({ transaction });
  });

  const updated = await CompanySignupRequest.findByPk(requestId, {
    include: [{ model: Plan, required: false }]
  });
  if (!updated) {
    throw new AppError("ERR_SIGNUP_REQUEST_NOT_FOUND", 404);
  }
  return updated;
};

export default ApproveCompanySignupRequestService;
