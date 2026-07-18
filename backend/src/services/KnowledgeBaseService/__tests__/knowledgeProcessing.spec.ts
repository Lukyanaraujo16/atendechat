jest.mock("../../../libs/knowledgeDocumentQueue", () => ({
  knowledgeDocumentQueue: {
    add: jest.fn().mockResolvedValue({ id: "job-1" })
  }
}));

jest.mock("../../../models/AiKnowledgeDocument", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    findAll: jest.fn()
  }
}));

jest.mock("../../../models/AiKnowledgeDocumentProcessing", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn()
  }
}));

jest.mock("../../../models/AiKnowledgeBase", () => ({
  __esModule: true,
  default: {
    count: jest.fn()
  }
}));

jest.mock("../../../models/AiKnowledgeDocumentChunk", () => ({
  __esModule: true,
  default: {
    count: jest.fn()
  }
}));

jest.mock("../../../models/AiKnowledgeEmbeddingSettings", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn()
  }
}));

import AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentProcessing from "../../../models/AiKnowledgeDocumentProcessing";
import AiKnowledgeBase from "../../../models/AiKnowledgeBase";
import AiKnowledgeDocumentChunk from "../../../models/AiKnowledgeDocumentChunk";
import AiKnowledgeEmbeddingSettings from "../../../models/AiKnowledgeEmbeddingSettings";
import { knowledgeDocumentQueue } from "../../../libs/knowledgeDocumentQueue";
import EnqueueKnowledgeDocumentProcessingService from "../EnqueueKnowledgeDocumentProcessingService";
import ReprocessKnowledgeDocumentService from "../ReprocessKnowledgeDocumentService";
import ListKnowledgeDocumentProcessingsService from "../ListKnowledgeDocumentProcessingsService";
import GetKnowledgeBaseDashboardService from "../GetKnowledgeBaseDashboardService";
describe("Knowledge processing pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enqueues processing and creates history record", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const reload = jest.fn().mockResolvedValue(undefined);
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 7,
      companyId: 1,
      sourceType: "upload",
      fileName: "a.txt",
      mimeType: "text/plain",
      processingStatus: "pending",
      status: "draft",
      checksum: "abc",
      lastProcessedChecksum: null,
      update,
      reload
    });
    (AiKnowledgeDocumentProcessing.count as jest.Mock).mockResolvedValue(0);
    (AiKnowledgeDocumentProcessing.create as jest.Mock).mockResolvedValue({
      id: 99,
      status: "queued",
      processor: "txt"
    });

    const result = await EnqueueKnowledgeDocumentProcessingService({
      companyId: 1,
      knowledgeDocumentId: 7
    });

    expect(result.enqueued).toBe(true);
    expect(AiKnowledgeDocumentProcessing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 1,
        knowledgeDocumentId: 7,
        status: "queued",
        attempt: 1
      })
    );
    expect(knowledgeDocumentQueue.add).toHaveBeenCalledWith(
      "ProcessKnowledgeDocument",
      expect.objectContaining({
        companyId: 1,
        knowledgeDocumentId: 7,
        processingId: 99
      }),
      expect.any(Object)
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ processingStatus: "queued" })
    );
  });

  it("skips auto reprocess when checksum unchanged", async () => {
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 7,
      companyId: 1,
      sourceType: "upload",
      fileName: "a.txt",
      processingStatus: "completed",
      checksum: "same",
      lastProcessedChecksum: "same",
      status: "ready",
      update: jest.fn(),
      reload: jest.fn()
    });

    const result = await EnqueueKnowledgeDocumentProcessingService({
      companyId: 1,
      knowledgeDocumentId: 7,
      force: false
    });

    expect(result.enqueued).toBe(false);
    expect(result.skippedReason).toBe("checksum_unchanged");
    expect(knowledgeDocumentQueue.add).not.toHaveBeenCalled();
  });

  it("reprocess forces new history even with same checksum", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 7,
      companyId: 1,
      sourceType: "upload",
      fileName: "a.txt",
      mimeType: "text/plain",
      processingStatus: "completed",
      checksum: "same",
      lastProcessedChecksum: "same",
      status: "ready",
      update,
      reload: jest.fn()
    });
    (AiKnowledgeDocumentProcessing.count as jest.Mock).mockResolvedValue(2);
    (AiKnowledgeDocumentProcessing.create as jest.Mock).mockResolvedValue({
      id: 100,
      status: "queued"
    });

    const result = await ReprocessKnowledgeDocumentService({
      companyId: 1,
      knowledgeDocumentId: 7
    });

    expect(result.enqueued).toBe(true);
    expect(AiKnowledgeDocumentProcessing.create).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 3 })
    );
  });

  it("lists processing history with tenant isolation", async () => {
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 7,
      companyId: 1
    });
    (AiKnowledgeDocumentProcessing.findAll as jest.Mock).mockResolvedValue([
      { id: 2 },
      { id: 1 }
    ]);

    const result = await ListKnowledgeDocumentProcessingsService({
      companyId: 1,
      knowledgeDocumentId: 7
    });

    expect(result.count).toBe(2);
    expect(AiKnowledgeDocument.findOne).toHaveBeenCalledWith({
      where: { id: 7, companyId: 1 }
    });
  });

  it("dashboard includes processing metrics", async () => {
    (AiKnowledgeBase.count as jest.Mock).mockResolvedValue(1);
    (AiKnowledgeDocument.count as jest.Mock).mockResolvedValue(5);
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      lastProcessedAt: new Date("2026-07-18T10:00:00Z")
    });
    (AiKnowledgeDocumentChunk.count as jest.Mock).mockResolvedValue(12);
    (AiKnowledgeEmbeddingSettings.findOne as jest.Mock).mockResolvedValue({
      provider: "openai",
      model: "text-embedding-3-small",
      enabled: true
    });

    const dash = await GetKnowledgeBaseDashboardService({ companyId: 1 });
    expect(dash).toHaveProperty("documentsProcessed");
    expect(dash).toHaveProperty("documentsPending");
    expect(dash).toHaveProperty("documentsProcessing");
    expect(dash).toHaveProperty("documentsError");
    expect(dash).toHaveProperty("lastProcessingAt");
    expect(dash).toHaveProperty("indexPending");
    expect(dash).toHaveProperty("chunksTotal");
    expect(dash.chunksTotal).toBe(12);
  });

  it("blocks enqueue when already processing", async () => {
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 7,
      companyId: 1,
      processingStatus: "processing",
      status: "processing",
      fileName: "a.txt",
      sourceType: "upload"
    });

    await expect(
      EnqueueKnowledgeDocumentProcessingService({
        companyId: 1,
        knowledgeDocumentId: 7
      })
    ).rejects.toMatchObject({ message: "ERR_KNOWLEDGE_PROCESSING_IN_PROGRESS" });
  });
});
