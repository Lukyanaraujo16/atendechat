import { Transaction } from "sequelize";
import * as Yup from "yup";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import CompanySignupRequest from "../../models/CompanySignupRequest";

const rejectSchema = Yup.object().shape({
  reason: Yup.string().max(2000).nullable()
});

const RejectCompanySignupRequestService = async (
  requestId: number,
  reviewerUserId: number,
  body: { reason?: string | null }
): Promise<CompanySignupRequest> => {
  const { reason } = await rejectSchema.validate(body, { abortEarly: false });

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

    req.status = "rejected";
    req.rejectReason =
      reason === undefined || reason === null
        ? null
        : String(reason).trim() || null;
    const decidedAt = new Date();
    req.reviewedByUserId = reviewerUserId;
    req.reviewedAt = decidedAt;
    req.rejectedAt = decidedAt;
    await req.save({ transaction });
  });

  const updated = await CompanySignupRequest.findByPk(requestId);
  if (!updated) {
    throw new AppError("ERR_SIGNUP_REQUEST_NOT_FOUND", 404);
  }
  return updated;
};

export default RejectCompanySignupRequestService;
