import AiKnowledgeBase from "../../models/AiKnowledgeBase";
import {
  normalizeOptionalString,
  parseBooleanField,
  parseRequiredName
} from "./knowledgeBaseTenant";

type CreateBody = {
  name?: unknown;
  description?: unknown;
  enabled?: unknown;
};

export default async function CreateKnowledgeBaseService(input: {
  companyId: number;
  userId: number | null;
  body: CreateBody;
}): Promise<AiKnowledgeBase> {
  const name = parseRequiredName(input.body.name);
  const description = normalizeOptionalString(input.body.description);
  const enabled = parseBooleanField(input.body.enabled, true);

  return AiKnowledgeBase.create({
    companyId: input.companyId,
    name,
    description,
    enabled,
    createdBy: input.userId,
    updatedBy: input.userId
  });
}
