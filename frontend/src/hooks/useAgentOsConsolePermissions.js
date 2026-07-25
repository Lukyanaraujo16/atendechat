import { useContext, useMemo } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import { getAgentOsConsoleActionGrants } from "../config/agentOsPlatformPermissions";

/**
 * Grants AgentOS da sessão — não autoriza sozinho (probe + backend).
 */
export default function useAgentOsConsolePermissions() {
  const { user } = useContext(AuthContext);
  return useMemo(() => getAgentOsConsoleActionGrants(user), [user]);
}
