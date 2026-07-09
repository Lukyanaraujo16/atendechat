import { Op } from "sequelize";
import AiProviderCredential from "../../models/AiProviderCredential";

export async function clearOtherDefaultCredentials(
  companyId: number,
  exceptId?: number
): Promise<void> {
  const where: Record<string, unknown> = { companyId, isDefault: true };
  if (exceptId != null) {
    where.id = { [Op.ne]: exceptId };
  }
  await AiProviderCredential.update(
    { isDefault: false },
    { where }
  );
}
