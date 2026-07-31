import React from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    maxWidth: "100%",
    marginBottom: theme.spacing(1.5),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255, 193, 7, 0.12)"
        : "rgba(255, 243, 205, 0.9)",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(255, 193, 7, 0.35)"
        : "rgba(255, 193, 7, 0.55)"
    }`,
  },
  text: {
    color: theme.palette.text.primary,
  },
}));

/**
 * Banner discreto de modo suporte nas telas comerciais do Agente de IA.
 * Não aparece para Admin normal.
 */
export default function AiAgentSupportBanner({
  supportMode,
  companyLabel,
}) {
  const classes = useStyles();
  if (supportMode !== true) return null;

  const name = String(companyLabel || "").trim();
  const message = name
    ? i18n.t("aiAgentProduct.support.configuringCompany", { name })
    : i18n.t("aiAgentProduct.support.configuring");

  return (
    <Box
      className={classes.root}
      role="status"
      aria-live="polite"
      data-testid="ai-agent-support-banner"
    >
      <Typography variant="body2" className={classes.text}>
        {message}
      </Typography>
    </Box>
  );
}
