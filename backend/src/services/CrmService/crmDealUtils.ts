import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import type { CrmDealStatus } from "../../models/CrmDeal";
import CrmStage from "../../models/CrmStage";

export function dealStatusFromStage(stage: {
  isWon: boolean;
  isLost: boolean;
}): CrmDealStatus {
  if (stage.isWon) return "won";
  if (stage.isLost) return "lost";
  return "open";
}

export function assertStageBelongsToPipeline(
  stage: CrmStage | null,
  pipelineId: number,
  companyId: number
): void {
  if (
    !stage ||
    stage.companyId !== companyId ||
    stage.pipelineId !== pipelineId
  ) {
    throw new AppError("ERR_INVALID_CRM_STAGE", 400);
  }
}

export function mergeDealWhereWithSearch(
  base: Record<string, unknown>,
  term: string
): Record<string, unknown> {
  const t = `%${String(term).trim()}%`;
  return {
    ...base,
    [Op.or]: [
      { title: { [Op.iLike]: t } },
      { "$contact.name$": { [Op.iLike]: t } }
    ]
  };
}
