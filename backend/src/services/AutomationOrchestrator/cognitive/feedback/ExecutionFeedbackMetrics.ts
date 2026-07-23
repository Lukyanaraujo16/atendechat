import {
  FeedbackEvent,
  FeedbackProcessRecord
} from "./feedbackTypes";

export type ExecutionFeedbackMetricsSnapshot = {
  feedbacksGenerated: number;
  goalCompletionRate: number;
  recoveryRate: number;
  replanRate: number;
  humanInterventionRate: number;
  averageProgress: number;
};

const records: FeedbackProcessRecord[] = [];
const events: FeedbackEvent[] = [];
const MAX = 500;

export function recordFeedbackProcess(record: FeedbackProcessRecord): void {
  records.push(record);
  if (records.length > MAX) records.shift();
}

export function recordFeedbackEvent(event: FeedbackEvent): void {
  events.push(event);
  if (events.length > MAX) events.shift();
}

export function getExecutionFeedbackMetrics(): ExecutionFeedbackMetricsSnapshot {
  const total = records.length;
  if (!total) {
    return {
      feedbacksGenerated: 0,
      goalCompletionRate: 0,
      recoveryRate: 0,
      replanRate: 0,
      humanInterventionRate: 0,
      averageProgress: 0
    };
  }

  let completedGoals = 0;
  let recoveries = 0;
  let replans = 0;
  let human = 0;
  let progressSum = 0;

  for (const r of records) {
    progressSum += r.feedback.goalProgress.completionPercentage;
    if (r.feedback.goalProgress.goalAchieved) completedGoals += 1;
    if (r.feedback.recoveryDecision !== "NONE") recoveries += 1;
    if (r.feedback.replanRequired) replans += 1;
    if (r.feedback.humanIntervention.required) human += 1;
  }

  return {
    feedbacksGenerated: total,
    goalCompletionRate: completedGoals / total,
    recoveryRate: recoveries / total,
    replanRate: replans / total,
    humanInterventionRate: human / total,
    averageProgress: progressSum / total
  };
}

export function listFeedbackRecords(limit = 50): FeedbackProcessRecord[] {
  return records.slice(-limit).reverse();
}

export function findFeedbackRecord(id: string): FeedbackProcessRecord | null {
  return records.find(r => r.id === id || r.feedback.feedbackId === id) || null;
}

export function __resetExecutionFeedbackMetricsForTests(): void {
  records.length = 0;
  events.length = 0;
}

export default {
  getExecutionFeedbackMetrics,
  listFeedbackRecords,
  findFeedbackRecord
};
