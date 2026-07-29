import React, { useContext } from "react";
import { AuthContext } from "../../context/Auth/AuthContext";
import MainContainer from "../../components/MainContainer";
import AiAgentExperiencePage from "../../components/AiAgentExperiencePage";
import useAiAgentProductSummary from "../../hooks/useAiAgentProductSummary";

/**
 * Hub comercial /ai-agent — Experience Layer (Fase 2.1).
 * Estado e readiness vêm exclusivamente de GET /product/ai-agent/summary.
 * Sem mutações legadas inseguras; Wizard/Simulator via navegação secundária.
 */
const AiAgent = () => {
  const { user } = useContext(AuthContext);
  const { loading, error, accessDenied, data, reload } =
    useAiAgentProductSummary({ enabled: true });

  const companyLabel =
    user?.company?.name ||
    user?.companyName ||
    (user?.companyId != null ? String(user.companyId) : "");

  return (
    <MainContainer>
      <AiAgentExperiencePage
        loading={loading}
        error={error}
        accessDenied={accessDenied}
        summary={data}
        onRetry={reload}
        supportMode={user?.supportMode === true}
        companyLabel={companyLabel}
      />
    </MainContainer>
  );
};

export default AiAgent;
