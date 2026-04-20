import Company from "../../models/Company";
import AppError from "../../errors/AppError";
import { createCompanyLog } from "./CreateCompanyLogService";

const DeleteCompanyService = async (
  id: string,
  userId?: number | string | null
): Promise<void> => {
  const company = await Company.findOne({
    where: { id }
  });

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  await createCompanyLog({
    companyId: company.id,
    action: "delete",
    userId: userId ?? null,
    metadata: { name: company.name }
  });

  await company.destroy();
};

export default DeleteCompanyService;
