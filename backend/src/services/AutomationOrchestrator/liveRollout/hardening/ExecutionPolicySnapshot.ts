import {
  EligibilityDecision
} from "../AutomationEligibilityEngine";
import { LiveRolloutConfig } from "../../../../config/automationLiveRolloutConstants";
import { AUTOMATION_LIVE_HARDENING_VERSION } from "../../../../config/automationLiveHardeningConstants";

/**
 * Snapshot imutável de política — gerado uma vez por execução.
 * O restante da execução NÃO deve reler configurações.
 */
export type ExecutionPolicySnapshot = {
  readonly version: string;
  readonly executionId: string;
  readonly companyId: number;
  readonly ticketId: number;
  readonly connectionId: number;
  readonly agentId: number;
  readonly messageId: string | null;
  readonly provider: string | null;
  readonly stage: string;
  readonly rolloutPercent: number;
  readonly effectivePercent: number;
  readonly canaryBucket: number;
  readonly eligibility: Readonly<EligibilityDecision>;
  readonly readinessLevel: string | null;
  readonly readinessScore: number | null;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly availableTools: ReadonlyArray<string>;
  readonly allowedRisk: string;
  readonly allowWriteToolsLive: false;
  readonly killSwitchState: Readonly<{
    active: boolean;
    scope?: string;
    reason?: string;
  }>;
  readonly messagePolicy: Readonly<LiveRolloutConfig["messagePolicy"]>;
  readonly generatedAt: string;
};

export function buildExecutionPolicySnapshot(input: {
  executionId: string;
  companyId: number;
  ticketId: number;
  connectionId: number;
  agentId: number;
  messageId?: string | null;
  provider?: string | null;
  eligibility: EligibilityDecision;
  config: LiveRolloutConfig;
  featureFlags?: Record<string, boolean>;
  availableTools?: string[];
}): ExecutionPolicySnapshot {
  // Congela objetos (imutabilidade estrutural)
  const eligibility = Object.freeze({
    ...input.eligibility,
    reasons: Object.freeze([...input.eligibility.reasons]),
    blockers: Object.freeze([...input.eligibility.blockers]),
    gates: Object.freeze({ ...input.eligibility.gates }),
    killSwitch: Object.freeze({ ...input.eligibility.killSwitch })
  }) as EligibilityDecision;

  return Object.freeze({
    version: AUTOMATION_LIVE_HARDENING_VERSION,
    executionId: input.executionId,
    companyId: input.companyId,
    ticketId: input.ticketId,
    connectionId: input.connectionId,
    agentId: input.agentId,
    messageId: input.messageId ?? null,
    provider: input.provider ?? null,
    stage: input.eligibility.stage,
    rolloutPercent: input.eligibility.percent,
    effectivePercent: input.eligibility.effectivePercent,
    canaryBucket: input.eligibility.canaryBucket,
    eligibility,
    readinessLevel: input.eligibility.readinessLevel ?? null,
    readinessScore: input.eligibility.readinessScore ?? null,
    featureFlags: Object.freeze({ ...(input.featureFlags || {}) }),
    availableTools: Object.freeze([...(input.availableTools || [])]),
    allowedRisk: "read_only",
    allowWriteToolsLive: false as const,
    killSwitchState: Object.freeze({
      ...input.eligibility.killSwitch
    }),
    messagePolicy: Object.freeze({ ...input.config.messagePolicy }),
    generatedAt: new Date().toISOString()
  });
}

export default { buildExecutionPolicySnapshot };
