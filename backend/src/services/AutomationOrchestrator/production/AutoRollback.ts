import { loadRolloutConfig, saveRolloutConfig } from "./RolloutStateMachine";
import { setKillSwitch } from "./KillSwitchService";
import { openIncident } from "./IncidentService";
import { emitAgentOsEvent } from "../observability/AgentOsEventBus";
import { createTraceContext } from "../observability/types";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";

/**
 * Auto rollback — desabilitado por padrão (flags.autoRollbackEnabled=false).
 */
export async function triggerAutoRollback(input: {
  companyId: number;
  reasonCodes: string[];
  source: string;
  userId?: number | null;
}) {
  const cfg = await loadRolloutConfig(input.companyId);
  if (!cfg.autoRollbackEnabled || !cfg.flags.autoRollbackEnabled) {
    return { triggered: false, reason: "AUTO_ROLLBACK_DISABLED" };
  }

  const previous = cfg.rolloutState;
  cfg.previousRolloutState = previous;
  cfg.rolloutState = "ROLLBACK";
  cfg.flags.liveEnabled = false;
  cfg.flags.toolWriteEnabled = false;
  cfg.flags.mcpWriteEnabled = false;
  cfg.flags.multiAgentLiveEnabled = false;
  cfg.flags.coordinatorLiveEnabled = false;
  cfg.suspendedAt = new Date().toISOString();
  cfg.suspendedReason = `auto_rollback:${input.reasonCodes.join(",")}`;
  cfg.version += 1;
  await saveRolloutConfig(cfg, input.userId ?? null);

  await setKillSwitch({
    companyId: input.companyId,
    scope: "tenant",
    resourceId: String(input.companyId),
    enabled: true,
    reason: `auto_rollback:${input.source}`,
    userId: input.userId || 0,
    confirm: true
  });

  await openIncident({
    companyId: input.companyId,
    severity: "critical",
    type: "AUTO_ROLLBACK",
    title: "Auto rollback AgentOS",
    description: `source=${input.source} codes=${input.reasonCodes.join(",")}`,
    rolloutState: "ROLLBACK"
  });

  const ctx = createTraceContext({ companyId: input.companyId });
  emitAgentOsEvent({
    ctx,
    type: "AUTO_ROLLBACK_TRIGGERED",
    origin: "ops",
    severity: "critical",
    payload: { from: previous, reasonCodes: input.reasonCodes }
  });
  observabilityRepository.writeAuditFireAndForget({
    companyId: input.companyId,
    moduleKey: "agentos.rollout",
    action: "AUTO_ROLLBACK_TRIGGERED",
    previousState: previous,
    newState: "ROLLBACK",
    reasonCodes: input.reasonCodes
  });

  return { triggered: true, previous, state: "ROLLBACK" };
}
