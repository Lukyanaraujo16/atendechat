import CrmCustomField from "../../models/CrmCustomField";
import AppError from "../../errors/AppError";

export default async function DeleteOrDeactivateCrmCustomFieldService(input: {
  companyId: number;
  id: number;
}): Promise<CrmCustomField> {
  const row = await CrmCustomField.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!row) {
    throw new AppError("ERR_CRM_CUSTOM_FIELD_NOT_FOUND", 404);
  }
  await row.update({ active: false });
  return row;
}
