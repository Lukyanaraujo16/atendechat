import BullQueue from "bull";

const connection = process.env.REDIS_URI || "";

/** Fila Bull para extração textual da Base de Conhecimento (fase 1.5.2B). */
export const knowledgeDocumentQueue = new BullQueue(
  "KnowledgeDocumentProcessing",
  connection,
  {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 1
    }
  }
);

export type KnowledgeDocumentJobData = {
  companyId: number;
  knowledgeDocumentId: number;
  processingId: number;
  force?: boolean;
};
