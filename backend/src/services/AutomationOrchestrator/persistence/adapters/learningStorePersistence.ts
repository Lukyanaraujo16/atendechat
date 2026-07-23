/**
 * Wire LearningStore puts → DocumentRepository (write-through).
 * Keeps sync Map API for Learning Engine.
 */
import { documentRepository } from "../repositories/DocumentRepository";

export function persistLearningEntity(
  companyId: number,
  entityType: string,
  entityKey: string,
  payload: Record<string, unknown>,
  extras?: { status?: string; agentId?: string; sessionId?: string }
): void {
  documentRepository.upsertFireAndForget({
    companyId,
    entityType,
    entityKey,
    payload,
    status: extras?.status ?? null,
    agentId: extras?.agentId ?? null,
    sessionId: extras?.sessionId ?? null
  });
}
