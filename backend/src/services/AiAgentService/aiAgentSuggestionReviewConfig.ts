export const AI_AGENT_REVIEW_RATINGS = ["good", "bad", "neutral"] as const;
export type AiAgentReviewRating = (typeof AI_AGENT_REVIEW_RATINGS)[number];

export const AI_AGENT_REVIEW_TAGS = [
  "invented_information",
  "too_long",
  "too_short",
  "needs_human",
  "wrong_tone",
  "incomplete",
  "useful",
  "other"
] as const;

export type AiAgentReviewTag = (typeof AI_AGENT_REVIEW_TAGS)[number];

export const AI_AGENT_REVIEW_NOTE_MAX_LENGTH = 500;
