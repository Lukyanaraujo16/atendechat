import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    textAlign: "center",
    padding: theme.spacing(4, 2),
    color: theme.palette.text.secondary,
  },
}));

export default function SimulatorEmptyState() {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <Typography variant="body1" gutterBottom>
        {i18n.t("aiAgent.simulator.empty.title")}
      </Typography>
      <Typography variant="body2">{i18n.t("aiAgent.simulator.empty.hint")}</Typography>
    </div>
  );
}
