import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Plan from "../../models/Plan";
import { normalizePlanValueForCreate, normalizeNullableStorageLimitGb } from "../../utils/normalizeMonetaryInput";
import ReplacePlanFeaturesService from "./ReplacePlanFeaturesService";
import {
  normalizePlanFeaturesInput,
  planFeatureMapToEntries
} from "./PlanFeatureNormalize";
import {
  buildDefaultFeatureMapFromPlan,
  deriveLegacyPlanColumnsFromFeatures
} from "../../config/planFeatureLegacy";

interface PlanData {
  name: string;
  users: number;
  connections: number;
  queues: number;
  value: number;
  useCampaigns?: boolean;
  useSchedules?: boolean;
  useInternalChat?: boolean;
  useExternalApi?: boolean;
  useKanban?: boolean;
  useOpenAi?: boolean;
  useIntegrations?: boolean;
  planFeatures?: Record<string, boolean>;
  storageLimitGb?: unknown;
}

const CreatePlanService = async (planData: PlanData): Promise<Plan> => {
  const { name } = planData;

  const planSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_PLAN_INVALID_NAME")
      .required("ERR_PLAN_INVALID_NAME")
      .test(
        "Check-unique-name",
        "ERR_PLAN_NAME_ALREADY_EXISTS",
        async value => {
          if (value) {
            const planWithSameName = await Plan.findOne({
              where: { name: value }
            });

            return !planWithSameName;
          }
          return false;
        }
      )
  });

  try {
    await planSchema.validate({ name });
  } catch (err) {
    throw new AppError(err.message);
  }

  const { planFeatures: pfInput, ...restWithMaybeStorage } = planData as PlanData;
  const payload: Record<string, unknown> = {
    ...restWithMaybeStorage,
    value: normalizePlanValueForCreate(planData.value as unknown)
  };
  if (Object.prototype.hasOwnProperty.call(planData as object, "storageLimitGb")) {
    payload.storageLimitGb = normalizeNullableStorageLimitGb(
      (planData as { storageLimitGb?: unknown }).storageLimitGb
    );
  } else {
    delete payload.storageLimitGb;
  }

  const plan = await Plan.create(payload as any);

  const hasExplicitPlanFeatures =
    pfInput !== undefined &&
    pfInput !== null &&
    typeof pfInput === "object" &&
    Object.keys(pfInput).length > 0;

  const map = hasExplicitPlanFeatures
    ? normalizePlanFeaturesInput(pfInput, plan)
    : buildDefaultFeatureMapFromPlan(plan);

  await ReplacePlanFeaturesService(plan.id, planFeatureMapToEntries(map));
  await plan.update(deriveLegacyPlanColumnsFromFeatures(map));

  return plan.reload();
};

export default CreatePlanService;
