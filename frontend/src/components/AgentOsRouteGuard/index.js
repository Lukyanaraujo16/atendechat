import React from "react";
import { Redirect, useLocation } from "react-router-dom";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import Typography from "@material-ui/core/Typography";
import { i18n } from "../../translate/i18n";
import useTechnicalConsoleAccess from "../../hooks/useTechnicalConsoleAccess";

function TechnicalConsoleLoading() {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight={240}
      width="100%"
      data-testid="agentos-console-loading"
    >
      <CircularProgress size={32} />
    </Box>
  );
}

export function TechnicalConsoleDenied() {
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight={280}
      width="100%"
      px={2}
      data-testid="agentos-console-denied"
    >
      <Typography variant="h6" gutterBottom>
        {i18n.t("technicalConsole.accessDenied.title")}
      </Typography>
      <Typography variant="body2" color="textSecondary" align="center">
        {i18n.t("technicalConsole.accessDenied.description")}
      </Typography>
    </Box>
  );
}

/**
 * Gate frontend do Console Técnico / páginas AgentOS.
 * Não usa features comerciais, supportMode, admin tenant ou URL como autorização.
 */
export default function AgentOsRouteGuard({
  children,
  redirectToCanonical = null,
}) {
  const accessState = useTechnicalConsoleAccess();
  const location = useLocation();

  if (accessState === "loading") {
    return <TechnicalConsoleLoading />;
  }

  if (accessState === "denied" || accessState === "error") {
    return <TechnicalConsoleDenied />;
  }

  if (redirectToCanonical) {
    return (
      <Redirect
        to={{
          pathname: redirectToCanonical,
          search: location.search,
          hash: location.hash,
        }}
      />
    );
  }

  return children || null;
}
