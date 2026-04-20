import { flowMenuTimeoutQueue } from "../../libs/flowMenuTimeoutQueue";

const JOB_PREFIX = "flow-menu-timeout-";

export interface FlowMenuTimeoutJobData {
  ticketId: number;
  companyId: number;
  whatsappId: number;
  idFlowDb: number;
  menuNodeId: string;
}

export async function cancelFlowMenuTimeout(ticketId: number): Promise<void> {
  const jobId = `${JOB_PREFIX}${ticketId}`;
  try {
    const job = await flowMenuTimeoutQueue.getJob(jobId);
    if (job) await job.remove();
  } catch {
    /* ignore */
  }
}

export async function scheduleFlowMenuTimeout(
  data: FlowMenuTimeoutJobData,
  delayMs: number
): Promise<void> {
  await cancelFlowMenuTimeout(data.ticketId);
  if (delayMs <= 0) return;
  await flowMenuTimeoutQueue.add(data, {
    jobId: `${JOB_PREFIX}${data.ticketId}`,
    delay: delayMs,
    removeOnComplete: true,
    removeOnFail: true
  });
}
