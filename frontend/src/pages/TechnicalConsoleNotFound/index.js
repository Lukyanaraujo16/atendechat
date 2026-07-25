import React from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import { Link } from "react-router-dom";
import { i18n } from "../../translate/i18n";
import { TECHNICAL_CONSOLE_ROOT_PATH } from "../../config/agentOsConsoleRoutes";

export default function TechnicalConsoleNotFound() {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="flex-start"
      px={3}
      py={4}
      data-testid="agentos-console-not-found"
    >
      <Typography variant="h6" gutterBottom>
        {i18n.t("technicalConsole.notFound.title")}
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        {i18n.t("technicalConsole.notFound.description")}
      </Typography>
      <Button
        variant="outlined"
        color="primary"
        component={Link}
        to={TECHNICAL_CONSOLE_ROOT_PATH}
      >
        {i18n.t("technicalConsole.shell.home")}
      </Button>
    </Box>
  );
}
