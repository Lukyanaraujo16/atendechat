import React, { useContext, useEffect, useState, useCallback } from "react";
import Alert from "@material-ui/lab/Alert";
import Button from "@material-ui/core/Button";
import { makeStyles } from "@material-ui/core/styles";
import { AuthContext } from "../context/Auth/AuthContext";
import {
  fetchPublicPushConfig,
  requestOneSignalPushPermission,
} from "../services/oneSignalService";
import { i18n } from "../translate/i18n";

const DISMISS_KEY = "pushOptInBannerDismissed";

const useStyles = makeStyles((theme) => ({
  root: {
    margin: theme.spacing(0, 2, 2),
    alignItems: "center",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
}));

export default function PushNotificationOptInBanner() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id || sessionStorage.getItem(DISMISS_KEY)) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchPublicPushConfig();
        if (cancelled || !cfg.onesignalEnabled || !cfg.onesignalAppId) {
          return;
        }
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          setVisible(true);
        }
      } catch {
        /* ignorar */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const onEnable = useCallback(async () => {
    setBusy(true);
    try {
      await requestOneSignalPushPermission();
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }, []);

  const onDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Alert
      severity="info"
      variant="outlined"
      className={classes.root}
      action={
        <div className={classes.actions}>
          <Button color="primary" size="small" variant="contained" disabled={busy} onClick={onEnable}>
            {i18n.t("platform.pushOptIn.enable")}
          </Button>
          <Button size="small" onClick={onDismiss} disabled={busy}>
            {i18n.t("platform.pushOptIn.later")}
          </Button>
        </div>
      }
    >
      {i18n.t("platform.pushOptIn.message")}
    </Alert>
  );
}
