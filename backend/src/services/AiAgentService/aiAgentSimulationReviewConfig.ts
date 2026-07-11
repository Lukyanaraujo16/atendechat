export const AI_AGENT_SIMULATION_REVIEW_RATINGS = ["good", "bad", "neutral"] as const;
export type AiAgentSimulationReviewRating =
  (typeof AI_AGENT_SIMULATION_REVIEW_RATINGS)[number];

export const AI_AGENT_SIMULATION_REVIEW_TAGS = [
  "invented_information",
  "too_long",
  "too_short",
  "wrong_tone",
  "should_call_human",
  "unnecessary_handoff",
  "useful",
  "other"
] as const;

export type AiAgentSimulationReviewTag =
  (typeof AI_AGENT_SIMULATION_REVIEW_TAGS)[number];

export const AI_AGENT_SIMULATION_REVIEW_NOTE_MAX_LENGTH = 500;
