import CrmSavedView from "../../models/CrmSavedView";

export default async function ListCrmSavedViewsService(input: {
  companyId: number;
}): Promise<CrmSavedView[]> {
  return CrmSavedView.findAll({
    where: { companyId: input.companyId },
    order: [
      ["isDefault", "DESC"],
      ["name", "ASC"],
      ["id", "ASC"]
    ],
    attributes: [
      "id",
      "companyId",
      "name",
      "filters",
      "isDefault",
      "createdBy",
      "createdAt",
      "updatedAt"
    ]
  });
}
