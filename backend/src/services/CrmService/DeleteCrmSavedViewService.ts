import CrmSavedView from "../../models/CrmSavedView";
import AppError from "../../errors/AppError";

export default async function DeleteCrmSavedViewService(input: {
  companyId: number;
  id: number;
  requesterId: number | null;
  requesterProfile?: string;
  requesterSupportMode?: boolean;
}): Promise<void> {
  const row = await CrmSavedView.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!row) {
    throw new AppError("ERR_CRM_SAVED_VIEW_NOT_FOUND", 404);
  }

  const isAdmin =
    input.requesterProfile === "admin" || input.requesterSupportMode === true;
  const isCreator =
    input.requesterId != null &&
    row.createdBy != null &&
    Number(row.createdBy) === Number(input.requesterId);

  if (!isAdmin && !isCreator) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await row.destroy();
}
