import { decrementCompanyStorageUsage } from "../CompanyService/adjustCompanyStorageUsage";
import { formatBytesPtBr } from "../../helpers/companyStorage";
import {
  deleteCompanyMediaItemWithOptions,
  DeleteCompanyMediaSource
} from "./DeleteCompanyMediaItemService";

const ALLOWED: DeleteCompanyMediaSource[] = [
  "message",
  "quickMessage",
  "schedule",
  "campaign",
  "announcement",
  "fileListOption",
  "chatMessage",
  "flowImage",
  "flowAudio"
];

export type BatchDeleteCompanyMediaInputItem = {
  source: string;
  sourceId: string | number;
};

const BatchDeleteCompanyMediaService = async (
  companyId: number,
  rawItems: BatchDeleteCompanyMediaInputItem[]
): Promise<{
  deletedCount: number;
  failedCount: number;
  freedBytes: number;
  freedFormatted: string;
}> => {
  const seen = new Set<string>();
  const queue: { source: DeleteCompanyMediaSource; sourceId: string }[] = [];

  for (const it of rawItems) {
    if (!it || typeof it !== "object") continue;
    const source = String((it as BatchDeleteCompanyMediaInputItem).source || "") as DeleteCompanyMediaSource;
    const sid = (it as BatchDeleteCompanyMediaInputItem).sourceId;
    if (sid === "" || sid === undefined || sid === null) continue;
    if (!ALLOWED.includes(source)) continue;
    const sourceId = String(sid);
    const key = `${source}:${sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push({ source, sourceId });
  }

  let deletedCount = 0;
  let failedCount = 0;
  let totalFreed = 0;

  for (const it of queue) {
    try {
      const freed = await deleteCompanyMediaItemWithOptions(companyId, it.source, it.sourceId, {
        deferStorageDecrement: true
      });
      totalFreed += freed;
      deletedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  if (totalFreed > 0) {
    await decrementCompanyStorageUsage(companyId, totalFreed);
  }

  return {
    deletedCount,
    failedCount,
    freedBytes: totalFreed,
    freedFormatted: formatBytesPtBr(totalFreed)
  };
};

export default BatchDeleteCompanyMediaService;
