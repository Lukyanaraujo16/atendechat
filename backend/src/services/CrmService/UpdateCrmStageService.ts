import { Op, Transaction } from "sequelize";
import sequelize from "../../database";
import CrmDeal from "../../models/CrmDeal";
import CrmStage from "../../models/CrmStage";
import AppError from "../../errors/AppError";
import { normalizeStageColor } from "./crmStageColor";
import type { StageKindInput } from "./CreateCrmStageService";

function kindToFlags(kind: StageKindInput): { isWon: boolean; isLost: boolean } {
  if (kind === "won") return { isWon: true, isLost: false };
  if (kind === "lost") return { isWon: false, isLost: true };
  return { isWon: false, isLost: false };
}

export default async function UpdateCrmStageService(input: {
  companyId: number;
  stageId: number;
  name?: string;
  color?: string;
  kind?: StageKindInput;
}): Promise<CrmStage> {
  const stage = await CrmStage.findOne({
    where: { id: input.stageId, companyId: input.companyId }
  });
  if (!stage) {
    throw new AppError("ERR_NO_CRM_STAGE", 404);
  }

  const hasPatch =
    input.name !== undefined || input.color !== undefined || input.kind !== undefined;
  if (!hasPatch) {
    throw new AppError("ERR_VALIDATION", 400);
  }

  let name = stage.name;
  if (input.name !== undefined) {
    name = String(input.name || "").trim();
    if (!name) {
      throw new AppError("ERR_VALIDATION", 400);
    }
  }

  let color = String(stage.color || "#90caf9");
  if (input.color !== undefined) {
    color = normalizeStageColor(input.color, color);
  }

  let isWon = stage.isWon;
  let isLost = stage.isLost;
  if (input.kind !== undefined) {
    const f = kindToFlags(input.kind);
    isWon = f.isWon;
    isLost = f.isLost;
  }
  if (isWon && isLost) {
    throw new AppError("ERR_CRM_STAGE_WON_LOST", 400);
  }

  return sequelize.transaction(async (t: Transaction) => {
    if (isWon) {
      await CrmStage.update(
        { isWon: false },
        {
          where: {
            pipelineId: stage.pipelineId,
            companyId: input.companyId,
            id: { [Op.ne]: stage.id }
          },
          transaction: t
        }
      );
    }
    if (isLost) {
      await CrmStage.update(
        { isLost: false },
        {
          where: {
            pipelineId: stage.pipelineId,
            companyId: input.companyId,
            id: { [Op.ne]: stage.id }
          },
          transaction: t
        }
      );
    }

    await stage.update(
      { name, color, isWon, isLost },
      { transaction: t }
    );
    return stage.reload({ transaction: t });
  });
}
