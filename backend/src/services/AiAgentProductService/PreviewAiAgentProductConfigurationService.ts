import { Request } from "express";
import { buildAiAgentPromptFromProfile } from "../AiAgentService/buildAiAgentPromptFromProfile";
import { buildAiAgentAdminPromptPreview } from "../AiAgentService/aiAgentHandoffPolicy";
import { validateAiAgentProfileInput } from "../AiAgentService/aiAgentProfileValidation";
import {
  assertAiAgentProductConfigurationAccess,
  pickProfileFieldsFromBody,
  rejectForbiddenConfigurationFields
} from "./aiAgentProductConfigurationHelpers";
import { serializeAiAgentProductConfigurationPreview } from "./serializeAiAgentProduct";
import { AiAgentProductConfigurationPreview } from "../../types/aiAgentProduct";

export default async function PreviewAiAgentProductConfigurationService(input: {
  companyId: number;
  req?: Request;
  availability?: { enabledByPlan: boolean; accessibleByUser: boolean };
  body: Record<string, unknown>;
}): Promise<AiAgentProductConfigurationPreview> {
  const companyId = Number(input.companyId);
  await assertAiAgentProductConfigurationAccess({
    companyId,
    req: input.req,
    availability: input.availability
  });

  rejectForbiddenConfigurationFields(input.body);
  const profile = validateAiAgentProfileInput(
    pickProfileFieldsFromBody(input.body)
  );
  const preview = buildAiAgentAdminPromptPreview(
    buildAiAgentPromptFromProfile(profile)
  );

  return serializeAiAgentProductConfigurationPreview({ preview });
}
