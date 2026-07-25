import React from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    marginBottom: theme.spacing(1.5),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.03)",
  },
}));

/**
 * Banner curto de somente leitura — não autoriza escrita.
 */
export default function AgentOsReadOnlyBanner({ visible = true }) {
  const classes = useStyles();
  if (!visible) return null;
  return (
    <Box className={classes.root} data-testid="agentos-readonly-banner">
      <Typography variant="body2" color="textSecondary">
        {i18n.t("technicalConsole.readOnly.banner")}
      </Typography>
    </Box>
  );
}
