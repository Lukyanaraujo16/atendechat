import {
  AgentDelegationPolicy,
  AgentHandoffPolicy,
  AgentLearningPolicy,
  AgentMemoryPolicy
} from "../types";
import { AgentRole, AgentSpecialization } from "../../../../config/automationMultiAgentConstants";

export function defaultMemoryPolicy(): AgentMemoryPolicy {
  return {
    workingMemoryEnabled: true,
    episodicMemoryEnabled: true,
    semanticMemoryEnabled: true,
    proceduralMemoryEnabled: true,
    reflectionMemoryEnabled: true,
    readOwnMemory: true,
    writeOwnMemory: true,
    readSharedTenantMemory: false,
    writeSharedTenantMemory: false,
    readContactMemory: true,
    writeContactMemory: false,
    readTicketMemory: true,
    writeTicketMemory: false,
    allowedMemoryTypes: [
      "WORKING",
      "EPISODIC",
      "SEMANTIC",
      "PROCEDURAL",
      "REFLECTION"
    ],
    blockedTags: [],
    retentionOverride: null,
    minimumConfidence: 0.4,
    minimumImportance: 0.3,
    metadata: {}
  };
}

export function defaultLearningPolicy(): AgentLearningPolicy {
  return {
    learningEnabled: true,
    observeExecutions: true,
    generateCandidates: true,
    allowShadowArtifacts: true,
    allowProceduralKnowledge: true,
    allowReflectionKnowledge: true,
    shareLearningWithinAgent: true,
    shareLearningWithinTenant: false,
    requireHumanApproval: true,
    minimumDataQuality: 0.4,
    minimumConfidence: 0.5,
    metadata: { autoPromotion: false }
  };
}

export function defaultDelegationPolicy(): AgentDelegationPolicy {
  return {
    enabled: true,
    maxDepth: 2,
    maxPerSession: 5,
    requireConfirmation: true,
    allowedTargetRoles: ["SPECIALIST", "COORDINATOR", "HUMAN_PROXY"],
    allowedSpecializations: [
      "GENERAL",
      "SALES",
      "SUPPORT",
      "FINANCE",
      "BILLING",
      "SCHEDULING",
      "ADMINISTRATIVE",
      "RETENTION",
      "ONBOARDING",
      "CUSTOM"
    ] as AgentSpecialization[],
    defaultContextSharingLevel: "TASK_ONLY",
    metadata: {}
  };
}

export function defaultHandoffPolicy(): AgentHandoffPolicy {
  return {
    enabled: true,
    maxPerSession: 3,
    requireHumanApproval: true,
    preserveStickyAssignment: true,
    allowedHandoffTypes: [
      "FULL_HANDOFF",
      "CONTEXTUAL_HANDOFF",
      "ESCALATION",
      "RETURN_TO_PREVIOUS_AGENT",
      "HUMAN_HANDOFF"
    ],
    metadata: {}
  };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "agent";
}

export function isSelectableStatus(status: string, enabled: boolean): boolean {
  return enabled && status === "ACTIVE";
}

export function roleAllowed(role: AgentRole, target: AgentRole): boolean {
  return role === target || true;
}
