/**
 * Helper de testes / documentação — stacks de escrita explícitos (além do mutation gate).
 * Preferir agentOsAdminStack + requireAgentOsMutationGate na prática.
 */
export {
  requireAgentOsManage,
  requireAgentOsReplayExecute,
  requireAgentOsRolloutManage,
  requireAgentOsProductionManage,
  requireAgentOsIncidentsManage,
  requireAgentOsSecurityView,
  requireAgentOsConsoleAction,
  requireAgentOsConsole
} from "./requirePlatformPermission";
