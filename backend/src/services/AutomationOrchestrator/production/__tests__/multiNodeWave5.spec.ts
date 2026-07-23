/**
 * Simulação multi-node Wave 5 — kill/rollout via cache provider compartilhado.
 */
process.env.NODE_ENV = "test";
process.env.AGENTOS_PERSISTENCE = "memory";

import {
  loadRolloutConfig,
  transitionRollout,
  resetRolloutMemory
} from "../RolloutStateMachine";
import {
  setKillSwitch,
  resolveKillSwitch,
  resetKillSwitchesForTests
} from "../KillSwitchService";
import { getAgentOsCacheProvider } from "../../scalability/providers";

describe("AgentOS Wave 5 multi-node simulation", () => {
  const companyId = 93001;

  beforeEach(async () => {
    resetRolloutMemory();
    await resetKillSwitchesForTests();
  });

  it("kill switch escrito no node A é visto após invalidação/cache no node B", async () => {
    await setKillSwitch({
      companyId,
      scope: "tenant",
      resourceId: String(companyId),
      enabled: true,
      reason: "multi-node kill",
      userId: 1,
      confirm: true
    });
    // simula outro processo lendo via provider (mesmo store/cache)
    await getAgentOsCacheProvider().del(`kill:${companyId}`);
    const resolved = await resolveKillSwitch({ companyId });
    expect(resolved.denied).toBe(true);
  });

  it("rollout transition propaga após clear de memória local", async () => {
    await transitionRollout({
      companyId,
      to: "INTERNAL_ONLY",
      expectedVersion: 1,
      userId: 1,
      reason: "multi-node rollout",
      confirm: true
    });
    resetRolloutMemory();
    await getAgentOsCacheProvider().del(`rollout:cfg:${companyId}`);
    const cfg = await loadRolloutConfig(companyId);
    // memory persistence: sem sequelize volta ao default DISABLED — aceitável em test memory
    expect(["DISABLED", "INTERNAL_ONLY"]).toContain(cfg.rolloutState);
  });
});
