import React, { useState } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Button,
  CircularProgress,
  TextField,
  Typography,
  Box,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import useIsMobile from "../../hooks/useIsMobile";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";

const useStyles = makeStyles((theme) => ({
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  textField: {
    width: "100%",
  },
  alert: {
    marginBottom: theme.spacing(2),
  },
}));

const InstagramConnectTokenModal = ({
  open,
  onClose,
  instagramAccountId,
  accountName,
  onConnected,
}) => {
  const classes = useStyles();
  const isMobile = useIsMobile();
  const [accessToken, setAccessToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setAccessToken("");
    onClose();
  };

  const handleConnect = async () => {
    const token = accessToken.trim();
    if (!token) {
      toast.error(i18n.t("connections.instagram.connectToken.errors.empty"));
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/instagram-accounts/${instagramAccountId}/connect-token`, {
        accessToken: token,
      });
      toast.success(i18n.t("connections.instagram.connectToken.success"));
      setAccessToken("");
      if (onConnected) onConnected();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <AppDialogTitle>
        {i18n.t("connections.instagram.connectToken.title")}
        {accountName ? ` — ${accountName}` : ""}
      </AppDialogTitle>
      <AppDialogContent dividers>
        <Alert severity="warning" className={classes.alert}>
          {i18n.t("connections.instagram.connectToken.warning")}
        </Alert>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("connections.instagram.connectToken.hint")}
        </Typography>
        <TextField
          label={i18n.t("connections.instagram.connectToken.tokenLabel")}
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          variant="outlined"
          margin="dense"
          multiline
          minRows={3}
          className={classes.textField}
          autoFocus
          disabled={submitting}
        />
      </AppDialogContent>
      <AppDialogActions>
        <Button
          onClick={handleClose}
          color="secondary"
          disabled={submitting}
          variant="outlined"
        >
          {i18n.t("connections.instagram.connectToken.cancel")}
        </Button>
        <Box className={classes.btnWrapper}>
          <Button
            onClick={handleConnect}
            color="primary"
            disabled={submitting}
            variant="contained"
          >
            {i18n.t("connections.instagram.connectToken.submit")}
          </Button>
          {submitting && (
            <CircularProgress size={24} className={classes.buttonProgress} />
          )}
        </Box>
      </AppDialogActions>
    </AppDialog>
  );
};

export default InstagramConnectTokenModal;
