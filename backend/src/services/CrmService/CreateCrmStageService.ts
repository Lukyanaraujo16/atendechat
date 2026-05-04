import { Transaction } from "sequelize";
import sequelize from "../../database";
import CrmPipeline from "../../models/CrmPipeline";
import CrmStage from "../../models/CrmStage";
import AppError from "../../errors/AppError";
import { normalizeStageColor } from "./crmStageColor";

export type StageKindInput = "normal" | "won" | "lost";

function kindToFlags(kind: StageKindInput): { isWon: boolean; isLost: boolean } {
  if (kind === "won") return { isWon: true, isLost: false };
  if (kind === "lost") return { isWon: false, isLost: true };
  return { isWon: false, isLost: false };
}

export default async function CreateCrmStageService(input: {
  companyId: number;
  pipelineId: number;
  name: string;
  color?: string;
  kind?: StageKindInput;
}): Promise<CrmStage> {
  const name = String(input.name || "").trim();
  if (!name) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const kind: StageKindInput = input.kind ?? "normal";
  const { isWon, isLost } = kindToFlags(kind);
  if (isWon && isLost) {
    throw new AppError("ERR_CRM_STAGE_WON_LOST", 400);
  }

  const maxRow = await CrmStage.findOne({
    where: { pipelineId: input.pipelineId, companyId: input.companyId },
    order: [["position", "DESC"]],
    attributes: ["position"]
  });
  const nextPos = (maxRow?.position ?? -1) + 1;

  const fallbackColor = "#90caf9";
  const color = normalizeStageColor(input.color, fallbackColor);

  return sequelize.transaction(async (t: Transaction) => {
    const pipeline = await CrmPipeline.findOne({
      where: { id: input.pipelineId, companyId: input.companyId },
      transaction: t
    });
    if (!pipeline) {
      throw new AppError("ERR_NO_CRM_PIPELINE", 404);
    }

    if (isWon) {
      await CrmStage.update(
        { isWon: false },
        { where: { pipelineId: input.pipelineId, companyId: input.companyId }, transaction: t }
      );
    }
    if (isLost) {
      await CrmStage.update(
        { isLost: false },
        { where: { pipelineId: input.pipelineId, companyId: input.companyId }, transaction: t }
      );
    }

    return CrmStage.create(
      {
        companyId: input.companyId,
        pipelineId: input.pipelineId,
        name,
        position: nextPos,
        color,
        isWon,
        isLost
      },
      { transaction: t }
    );
  });
}
