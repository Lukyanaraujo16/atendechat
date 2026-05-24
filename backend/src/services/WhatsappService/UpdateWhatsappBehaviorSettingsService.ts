import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import {
  buildWhatsappBehaviorPatch,
  BehaviorSettingsPayload
} from "../../helpers/buildWhatsappBehaviorPatch";
import { getWhatsappBehaviorRow } from "../../helpers/whatsappBehaviorSettings";
import { logBehaviorPatchApplied } from "../../helpers/whatsappBehaviorDebug";

type Input = {
  companyId: number;
  whatsappId: number;
  settings: BehaviorSettingsPayload;
};

const UpdateWhatsappBehaviorSettingsService = async (input: Input) => {
  const whatsappId = Number(input.whatsappId);
  if (!Number.isFinite(whatsappId) || whatsappId <= 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400);
  }

  const patch = buildWhatsappBehaviorPatch(input.settings);

  const wa = await Whatsapp.findOne({
    where: { id: whatsappId, companyId: input.companyId },
    attributes: ["id"]
  });
  if (!wa) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await wa.update(patch);

  logBehaviorPatchApplied({
    companyId: input.companyId,
    whatsappId,
    fields: Object.keys(patch)
  });

  const row = await getWhatsappBehaviorRow(input.companyId, whatsappId);
  if (!row) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return row;
};

export default UpdateWhatsappBehaviorSettingsService;
