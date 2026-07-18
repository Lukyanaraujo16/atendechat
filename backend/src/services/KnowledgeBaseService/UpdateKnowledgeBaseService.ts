import AiKnowledgeBase from "../../models/AiKnowledgeBase";
import {
  findKnowledgeBaseOrThrow,
  normalizeOptionalString,
  parseBooleanField,
  parseRequiredName
} from "./knowledgeBaseTenant";

type UpdateBody = {
  name?: unknown;
  description?: unknown;
  enabled?: unknown;
};

export default async function UpdateKnowledgeBaseService(input: {
  companyId: number;
  id: number;
  userId: number | null;
  body: UpdateBody;
}): Promise<AiKnowledgeBase> {
  const row = await findKnowledgeBaseOrThrow(input.companyId, input.id);
  const patch: Partial<AiKnowledgeBase> = {
    updatedBy: input.userId
  };

  if (input.body.name !== undefined) {
    patch.name = parseRequiredName(input.body.name);
  }
  if (input.body.description !== undefined) {
    patch.description = normalizeOptionalString(input.body.description);
  }
  if (input.body.enabled !== undefined) {
    patch.enabled = parseBooleanField(input.body.enabled, row.enabled);
  }

  await row.update(patch);
  return row.reload();
}
