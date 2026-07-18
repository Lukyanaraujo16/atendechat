import BullQueue from "bull";

const connection = process.env.REDIS_URI || "";

/** Fila separada da extração textual — indexação vetorial (1.5.2C). */
export const knowledgeDocumentIndexQueue = new BullQueue(
  "KnowledgeDocumentIndexing",
  connection,
  {
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 }
    }
  }
);

export type KnowledgeDocumentIndexJobData = {
  companyId: number;
  knowledgeDocumentId: number;
  indexingId: number;
  force?: boolean;
};
