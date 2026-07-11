import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import LinearProgress from "@material-ui/core/LinearProgress";
import Typography from "@material-ui/core/Typography";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    marginBottom: theme.spacing(2),
  },
  meta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(0.75),
    gap: theme.spacing(1),
  },
  stepLabel: {
    color: theme.palette.text.secondary,
    fontSize: "0.8125rem",
  },
  title: {
    fontWeight: 600,
    marginBottom: theme.spacing(0.5),
  },
  description: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
}));

export default function AiAgentWizardProgress({
  currentIndex,
  totalSteps,
  stepTitle,
  stepDescription,
}) {
  const classes = useStyles();
  const progress = totalSteps > 1 ? ((currentIndex + 1) / totalSteps) * 100 : 100;

  return (
    <Box className={classes.root}>
      <div className={classes.meta}>
        <Typography variant="caption" className={classes.stepLabel}>
          {i18n.t("aiAgent.wizard.progress", {
            current: currentIndex + 1,
            total: totalSteps,
          })}
        </Typography>
        <Typography variant="caption" className={classes.stepLabel}>
          {Math.round(progress)}%
        </Typography>
      </div>
      <LinearProgress variant="determinate" value={progress} />
      {stepTitle ? (
        <Typography variant="h6" className={classes.title}>
          {stepTitle}
        </Typography>
      ) : null}
      {stepDescription ? (
        <Typography variant="body2" className={classes.description}>
          {stepDescription}
        </Typography>
      ) : null}
    </Box>
  );
}
