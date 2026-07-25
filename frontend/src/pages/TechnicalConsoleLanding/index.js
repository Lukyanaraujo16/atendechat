import React from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { i18n } from "../../translate/i18n";

/**
 * Landing mínima do Console Técnico — não consulta AgentOS.
 */
export default function TechnicalConsoleLanding() {
  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="flex-start"
      minHeight={280}
      width="100%"
      px={3}
      py={4}
      data-testid="technical-console-landing"
    >
      <Typography variant="h5" gutterBottom>
        {i18n.t("technicalConsole.landing.title")}
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        {i18n.t("technicalConsole.landing.authorized")}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {i18n.t("technicalConsole.landing.nextSteps")}
      </Typography>
    </Box>
  );
}
