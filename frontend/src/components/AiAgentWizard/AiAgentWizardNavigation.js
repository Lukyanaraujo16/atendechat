import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
    position: "sticky",
    bottom: 0,
    backgroundColor: theme.palette.background.paper,
    zIndex: 2,
    paddingBottom: `calc(${theme.spacing(1)}px + env(safe-area-inset-bottom, 0px))`,
  },
  left: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  right: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginLeft: "auto",
  },
  btnWrapper: {
    position: "relative",
  },
  progress: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -10,
    marginLeft: -10,
  },
}));

export default function AiAgentWizardNavigation({
  showBack = false,
  showCancel = true,
  continueLabel,
  onBack,
  onCancel,
  onContinue,
  loading = false,
  continueDisabled = false,
}) {
  const classes = useStyles();

  return (
    <Box className={classes.root}>
      <div className={classes.left}>
        {showCancel ? (
          <Button onClick={onCancel} disabled={loading}>
            {i18n.t("aiAgent.wizard.buttons.cancel")}
          </Button>
        ) : null}
      </div>
      <div className={classes.right}>
        {showBack ? (
          <Button onClick={onBack} disabled={loading}>
            {i18n.t("aiAgent.wizard.buttons.back")}
          </Button>
        ) : null}
        <div className={classes.btnWrapper}>
          <Button
            variant="contained"
            color="primary"
            onClick={onContinue}
            disabled={loading || continueDisabled}
          >
            {continueLabel || i18n.t("aiAgent.wizard.buttons.continue")}
          </Button>
          {loading ? <CircularProgress size={20} className={classes.progress} /> : null}
        </div>
      </div>
    </Box>
  );
}
