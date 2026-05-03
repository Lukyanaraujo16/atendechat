import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import CrmPipeline from "../../models/CrmPipeline";
import CrmStage from "../../models/CrmStage";
import {
  normalizeBusinessSegment,
  type BusinessSegment
} from "../../config/businessSegment";
import { crmPipelineTemplates } from "../../config/crmPipelineTemplates";

const STAGE_COLORS = [
  "#5c6bc0",
  "#7e57c2",
  "#26a69a",
  "#42a5f5",
  "#66bb6a",
  "#ef5350",
  "#ffa726",
  "#8d6e63"
];

export function stageWinLostFromName(name: string): {
  isWon: boolean;
  isLost: boolean;
} {
  const n = String(name).trim();
  if (n === "Perdido") return { isWon: false, isLost: true };
  if (
    n === "Fechado" ||
    n === "Matriculado" ||
    n === "Pedido fechado"
  ) {
    return { isWon: true, isLost: false };
  }
  return { isWon: false, isLost: false };
}

export type BootstrapCrmResult = {
  bootstrapped: boolean;
  pipeline: CrmPipeline;
  reason?: string;
};

/**
 * Cria pipeline padrão + estágios se ainda não existir (idempotente).
 */
const BootstrapCrmForCompanyService = async (
  companyId: number,
  options?: { transaction?: Transaction; segmentOverride?: BusinessSegment }
): Promise<BootstrapCrmResult> => {
  const company = await Company.findByPk(companyId, {
    transaction: options?.transaction
  });
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const existing = await CrmPipeline.findOne({
    where: { companyId, isDefault: true },
    transaction: options?.transaction
  });
  if (existing) {
    return { bootstrapped: false, pipeline: existing, reason: "already_exists" };
  }

  const segment =
    options?.segmentOverride ??
    normalizeBusinessSegment(company.businessSegment);
  const stageNames = crmPipelineTemplates[segment] ?? crmPipelineTemplates.general;

  const pipeline = await CrmPipeline.create(
    {
      companyId,
      name: "Pipeline principal",
      segment,
      isDefault: true
    },
    { transaction: options?.transaction }
  );

  await Promise.all(
    stageNames.map((stageName, index) => {
      const { isWon, isLost } = stageWinLostFromName(stageName);
      return CrmStage.create(
        {
          pipelineId: pipeline.id,
          companyId,
          name: stageName,
          position: index,
          color: STAGE_COLORS[index % STAGE_COLORS.length],
          isWon,
          isLost
        },
        { transaction: options?.transaction }
      );
    })
  );

  return { bootstrapped: true, pipeline };
};

export default BootstrapCrmForCompanyService;
