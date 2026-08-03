import React, { useContext } from "react";
import { AuthContext } from "../../context/Auth/AuthContext";
import MainContainer from "../../components/MainContainer";
import AiAgentHubPage from "../../components/AiAgentHubPage";
import useAiAgentProductAgents from "../../hooks/useAiAgentProductAgents";
import { canManageAiAgentProduct } from "../../utils/canManageAiAgentProduct";

/**
 * Hub comercial /ai-agent — listagem multiagente (Fase 2.9B / 2.11).
 */
const AiAgent = () => {
  const { user } = useContext(AuthContext);
  const { loading, error, accessDenied, agents, reload } =
    useAiAgentProductAgents({ enabled: true });

  const companyLabel =
    user?.company?.name ||
    user?.companyName ||
    (user?.companyId != null ? String(user.companyId) : "");

  const canManage = canManageAiAgentProduct(user);

  return (
    <MainContainer>
      <AiAgentHubPage
        loading={loading}
        error={error}
        accessDenied={accessDenied}
        agents={agents}
        onRetry={reload}
        canCreate={canManage}
        canMutate={canManage}
        supportMode={user?.supportMode === true}
        companyLabel={companyLabel}
      />
    </MainContainer>
  );
};

export default AiAgent;
