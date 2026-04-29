import React from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import LockOutlinedIcon from "@material-ui/icons/LockOutlined";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 280,
    padding: theme.spacing(4),
    textAlign: "center",
    maxWidth: 480,
    margin: "0 auto",
  },
  icon: {
    fontSize: 48,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  title: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
}));

export default function PlanFeatureBlocked() {
  const classes = useStyles();
  return (
    <Box className={classes.root}>
      <LockOutlinedIcon className={classes.icon} aria-hidden />
      <Typography variant="h6" component="h1" className={classes.title}>
        {i18n.t("planFeature.blockedTitle")}
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {i18n.t("planFeature.blockedBody")}
      </Typography>
    </Box>
  );
}
