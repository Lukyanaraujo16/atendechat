import { Op } from "sequelize";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { listWhatsappBehaviorRows } from "../../helpers/whatsappBehaviorSettings";
import {
  buildWhatsappBehaviorPatch,
  BehaviorSettingsPayload
} from "../../helpers/buildWhatsappBehaviorPatch";

export type { BehaviorSettingsPayload };

type Input = {
  companyId: number;
  whatsappIds: number[];
  settings: BehaviorSettingsPayload;
};

const BulkUpdateWhatsappBehaviorSettingsService = async (
  input: Input
): Promise<{ updated: number }> => {
  const ids = [...new Set(input.whatsappIds.map((id) => Number(id)).filter((id) => id > 0))];
  if (ids.length === 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400);
  }

  const owned = await Whatsapp.findAll({
    where: { companyId: input.companyId, id: { [Op.in]: ids } },
    attributes: ["id"]
  });
  if (owned.length !== ids.length) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const patch = buildWhatsappBehaviorPatch(input.settings);

  const [updated] = await Whatsapp.update(patch, {
    where: { companyId: input.companyId, id: { [Op.in]: ids } }
  });

  return { updated };
};

export default BulkUpdateWhatsappBehaviorSettingsService;

export async function listWhatsappBehaviorSettingsForCompany(
  companyId: number
) {
  return listWhatsappBehaviorRows(companyId);
}
