/**
 * Namespace /technical-console/agentos + aliases (Fase 1.5 — shell).
 */
import React, { Suspense } from "react";
import { Switch, Route } from "react-router-dom";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import AgentOsRouteGuard from "../components/AgentOsRouteGuard";
import AgentOsConsoleLayout from "../components/AgentOsConsoleLayout";
import TechnicalConsoleLanding from "../pages/TechnicalConsoleLanding";
import TechnicalConsoleNotFound from "../pages/TechnicalConsoleNotFound";
import {
  AGENTOS_TECHNICAL_ROUTE_ENTRIES,
  TECHNICAL_CONSOLE_ROOT_PATH,
} from "../config/agentOsConsoleRoutes";

const pageLoaders = {
  monitor: () => import("../pages/AutomationMonitor"),
  observability: () => import("../pages/AutomationObservability"),
  planning: () => import("../pages/AutomationPlanning"),
  evaluation: () => import("../pages/AutomationPlanEvaluation"),
  "execution-sessions": () => import("../pages/AutomationExecutionSessions"),
  runtime: () => import("../pages/AutomationRuntimeIntegration"),
  actions: () => import("../pages/AutomationActionExecution"),
  feedback: () => import("../pages/AutomationExecutionFeedback"),
  memory: () => import("../pages/AutomationCognitiveMemory"),
  mcp: () => import("../pages/AutomationMcpRuntime"),
  learning: () => import("../pages/AutomationLearningEngine"),
  "multi-agent": () => import("../pages/AutomationMultiAgent"),
  evidence: () => import("../pages/AutomationEvidence"),
  rollout: () => import("../pages/AutomationLiveRollout"),
  production: () => import("../pages/AutomationProduction"),
  tools: () => import("../pages/AutomationTools"),
  analytics: () => import("../pages/AiAgentAnalytics"),
  "shadow-fc": () => import("../pages/AiAgentShadowFc"),
};

const lazyPages = Object.keys(pageLoaders).reduce((acc, key) => {
  acc[key] = React.lazy(pageLoaders[key]);
  return acc;
}, {});

function RouteLoading() {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight={240}
      width="100%"
    >
      <CircularProgress size={32} />
    </Box>
  );
}

function ConsoleShellRoutes() {
  return (
    <AgentOsRouteGuard>
      <AgentOsConsoleLayout>
        <Suspense fallback={<RouteLoading />}>
          <Switch>
            <Route
              exact
              path={TECHNICAL_CONSOLE_ROOT_PATH}
              component={TechnicalConsoleLanding}
            />
            {AGENTOS_TECHNICAL_ROUTE_ENTRIES.map((entry) => {
              const Page = lazyPages[entry.pageKey];
              return (
                <Route
                  key={`canonical-${entry.pageKey}`}
                  exact
                  path={entry.canonicalPath}
                  component={Page}
                />
              );
            })}
            <Route path={TECHNICAL_CONSOLE_ROOT_PATH} component={TechnicalConsoleNotFound} />
          </Switch>
        </Suspense>
      </AgentOsConsoleLayout>
    </AgentOsRouteGuard>
  );
}

/**
 * Aliases legados fora do shell; canônicos dentro do AgentOsConsoleLayout.
 */
export default function TechnicalAgentOsRoutes() {
  return (
    <Switch>
      {AGENTOS_TECHNICAL_ROUTE_ENTRIES.map((entry) => (
        <Route
          key={`legacy-${entry.pageKey}`}
          exact
          path={entry.legacyPath}
          render={() => (
            <AgentOsRouteGuard redirectToCanonical={entry.canonicalPath} />
          )}
        />
      ))}
      <Route path={TECHNICAL_CONSOLE_ROOT_PATH} component={ConsoleShellRoutes} />
    </Switch>
  );
}
