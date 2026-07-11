import { buildSegmentSpecificPromptInstructions as buildFromTemplate } from "../../config/aiAgentSegmentTemplates";
import { ValidatedAiAgentProfileInput } from "./aiAgentProfileValidation";
import AiAgentProfile from "../../models/AiAgentProfile";

type SegmentProfileInput = Pick<
  ValidatedAiAgentProfileInput | AiAgentProfile,
  "businessSegment" | "customBusinessSegment"
>;

export function buildSegmentSpecificPromptInstructions(
  profile: SegmentProfileInput
): string | null {
  const lines = buildFromTemplate({
    businessSegment: profile.businessSegment,
    customBusinessSegment: profile.customBusinessSegment
  });

  if (!lines.length) return null;

  return ["## Orientações específicas do segmento", ...lines.map((line) => `- ${line}`)].join(
    "\n"
  );
}
