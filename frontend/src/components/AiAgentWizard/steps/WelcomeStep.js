import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import AndroidOutlinedIcon from "@material-ui/icons/AndroidOutlined";
import { i18n } from "../../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  hero: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: theme.spacing(3, 1),
    gap: theme.spacing(2),
  },
  icon: {
    fontSize: 56,
    color: theme.palette.primary.main,
  },
  list: {
    textAlign: "left",
    color: theme.palette.text.secondary,
    paddingLeft: theme.spacing(2.5),
    margin: 0,
  },
}));

export default function WelcomeStep() {
  const classes = useStyles();

  return (
    <Box className={classes.hero}>
      <AndroidOutlinedIcon className={classes.icon} />
      <Typography variant="h5">
        {i18n.t("aiAgent.wizard.steps.welcome.title")}
      </Typography>
      <Typography variant="body1" color="textSecondary">
        {i18n.t("aiAgent.wizard.steps.welcome.description")}
      </Typography>
      <ul className={classes.list}>
        <li>{i18n.t("aiAgent.wizard.steps.welcome.bullet1")}</li>
        <li>{i18n.t("aiAgent.wizard.steps.welcome.bullet2")}</li>
        <li>{i18n.t("aiAgent.wizard.steps.welcome.bullet3")}</li>
        <li>{i18n.t("aiAgent.wizard.steps.welcome.bullet4")}</li>
      </ul>
    </Box>
  );
}
