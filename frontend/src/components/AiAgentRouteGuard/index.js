import React from "react";
import { Redirect } from "react-router-dom";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import PlanFeatureBlocked from "../PlanFeatureBlocked";
import { AI_AGENT_FEATURE_KEY } from "../../config/aiAgentFeature";
import { canUseAiAgent } from "../../utils/canUseAiAgent";

function routePlanAllows(planFlags) {
  const pf = planFlags?.planTierEffectiveFeatures || {};
  return pf[AI_AGENT_FEATURE_KEY] === true;
}

/**
 * Guarda rotas do Agente de IA por plano/permissão.
 * Sem `children`, redireciona (rota reservada até a página existir).
 */
export default function AiAgentRouteGuard({
  planFlags,
  user,
  children,
  fallbackPath = "/",
}) {
  if (!planFlags?.loaded) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={240}
        width="100%"
      >
        <CircularProgress size={36} />
      </Box>
    );
  }

  if (!canUseAiAgent(user, planFlags)) {
    const planOk = routePlanAllows(planFlags);
    const userBlocked =
      user?.effectiveUserFeatures?.[AI_AGENT_FEATURE_KEY] === false;
    if (planOk && userBlocked) {
      return <PlanFeatureBlocked variant="user" />;
    }
    return <PlanFeatureBlocked />;
  }

  if (children) {
    return children;
  }

  return <Redirect to={fallbackPath} />;
}
