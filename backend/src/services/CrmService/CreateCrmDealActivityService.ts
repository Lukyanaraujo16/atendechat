import CrmDealActivity, { CrmDealActivityType } from "../../models/CrmDealActivity";

export type CreateCrmDealActivityInput = {
  companyId: number;
  dealId: number;
  userId: number | null;
  type: CrmDealActivityType | string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export default async function CreateCrmDealActivityService(
  input: CreateCrmDealActivityInput
): Promise<CrmDealActivity> {
  return CrmDealActivity.create({
    companyId: input.companyId,
    dealId: input.dealId,
    userId: input.userId,
    type: input.type,
    title: input.title.slice(0, 255),
    description: input.description ?? null,
    metadata: input.metadata ?? null
  });
}
