import React from "react";
import { Redirect } from "react-router-dom";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import PlanFeatureBlocked from "../PlanFeatureBlocked";
import { KNOWLEDGE_BASE_FEATURE_KEY } from "../../config/knowledgeBaseFeature";
import { canUseKnowledgeBase } from "../../utils/canUseKnowledgeBase";

function routePlanAllows(planFlags) {
  const pf = planFlags?.planTierEffectiveFeatures || {};
  return pf[KNOWLEDGE_BASE_FEATURE_KEY] === true;
}

export default function KnowledgeBaseRouteGuard({
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

  if (!canUseKnowledgeBase(user, planFlags)) {
    const planOk = routePlanAllows(planFlags);
    const userBlocked =
      user?.effectiveUserFeatures?.[KNOWLEDGE_BASE_FEATURE_KEY] === false;
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
