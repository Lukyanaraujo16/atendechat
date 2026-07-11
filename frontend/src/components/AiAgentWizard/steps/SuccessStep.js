import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import Alert from "@material-ui/lab/Alert";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import { i18n } from "../../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    textAlign: "center",
    padding: theme.spacing(3, 1),
  },
  icon: {
    fontSize: 56,
    color: theme.palette.success.main,
    marginBottom: theme.spacing(2),
  },
  summary: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    textAlign: "left",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    maxWidth: 360,
    marginLeft: "auto",
    marginRight: "auto",
  },
}));

export default function SuccessStep({
  formState,
  agentId,
  hasCredentials,
  onViewAgent,
  onConfigureCredential,
  onBackToList,
}) {
  const classes = useStyles();

  return (
    <Box className={classes.root}>
      <CheckCircleOutlineIcon className={classes.icon} />
      <Typography variant="h5" gutterBottom>
        {i18n.t("aiAgent.wizard.steps.success.title")}
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        {i18n.t("aiAgent.wizard.steps.success.description")}
      </Typography>

      <Box className={classes.summary}>
        <Typography variant="body2">
          <strong>{i18n.t("aiAgent.wizard.fields.attendantName")}:</strong>{" "}
          {formState.attendantName}
        </Typography>
        <Typography variant="body2">
          <strong>{i18n.t("aiAgent.wizard.fields.companyName")}:</strong>{" "}
          {formState.companyName}
        </Typography>
        <Typography variant="body2">
          <strong>{i18n.t("aiAgent.wizard.fields.attendantRole")}:</strong>{" "}
          {formState.attendantRole || i18n.t("aiAgent.wizard.labels.virtualAttendant")}
        </Typography>
        <Box mt={1} display="flex" flexWrap="wrap" gridGap={8}>
          <Chip
            size="small"
            label={i18n.t("aiAgent.status.inactive")}
            color="default"
          />
          <Chip
            size="small"
            label={i18n.t("aiAgent.wizard.labels.guidedSetup")}
            color="primary"
          />
        </Box>
      </Box>

      {!hasCredentials ? (
        <Alert severity="warning" style={{ textAlign: "left" }}>
          {i18n.t("aiAgent.wizard.hints.missingCredential")}
        </Alert>
      ) : (
        <Alert severity="info" style={{ textAlign: "left" }}>
          {i18n.t("aiAgent.wizard.hints.nextStepsConnection")}
        </Alert>
      )}

      <div className={classes.actions}>
        <Button variant="contained" color="primary" onClick={onViewAgent}>
          {i18n.t("aiAgent.wizard.buttons.viewAgent")}
        </Button>
        <Button variant="outlined" color="primary" onClick={onConfigureCredential}>
          {i18n.t("aiAgent.wizard.buttons.configureCredential")}
        </Button>
        <Button onClick={onBackToList}>{i18n.t("aiAgent.wizard.buttons.backToList")}</Button>
      </div>
    </Box>
  );
}
