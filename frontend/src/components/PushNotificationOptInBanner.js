import React, { useContext, useEffect, useState, useCallback } from "react";
import Alert from "@material-ui/lab/Alert";
import Button from "@material-ui/core/Button";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import { AuthContext } from "../context/Auth/AuthContext";
import {
  enableOneSignalPushSubscription,
  getOneSignalPushStatus,
  refreshOneSignalPushStatus,
  subscribeOneSignalPushStatus,
} from "../services/oneSignalService";
import {
  PUSH_DOMAIN_STATES,
  shouldShowPushDeniedHelp,
  shouldShowPushOptInBanner,
} from "../utils/oneSignalPushDomain";
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

function messageForState(domainState, errorCode) {
  if (domainState === PUSH_DOMAIN_STATES.PERMISSION_DENIED) {
    return i18n.t("platform.pushOptIn.denied");
  }
  if (domainState === PUSH_DOMAIN_STATES.PERMISSION_GRANTED_UNSUBSCRIBED) {
    return i18n.t("platform.pushOptIn.grantedUnsubscribed");
  }
  if (domainState === PUSH_DOMAIN_STATES.ERROR || errorCode) {
    if (errorCode === "subscription_missing_after_permission") {
      return i18n.t("platform.pushOptIn.subscriptionMissing");
    }
    if (errorCode === "init_failed" || errorCode === "sdk_load_failed") {
      return i18n.t("platform.pushOptIn.initFailed");
    }
    return i18n.t("platform.pushOptIn.error");
  }
  return i18n.t("platform.pushOptIn.message");
}

export default function PushNotificationOptInBanner() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [status, setStatus] = useState(() => getOneSignalPushStatus());
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== "undefined" && Boolean(sessionStorage.getItem(DISMISS_KEY))
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return subscribeOneSignalPushStatus(setStatus);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      await refreshOneSignalPushStatus();
      if (!cancelled) {
        setStatus(getOneSignalPushStatus());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const domainState = status.domainState;
  const showOptIn = shouldShowPushOptInBanner(domainState, { dismissed });
  const showDenied = shouldShowPushDeniedHelp(domainState, { dismissed });
  const visible = Boolean(user?.id) && (showOptIn || showDenied);

  const onEnable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await enableOneSignalPushSubscription({ user });
      setStatus(result.status || getOneSignalPushStatus());
      if (result.ok) {
        toast.success(i18n.t("platform.pushOptIn.success"));
        return;
      }
      if (result.errorCode === "permission_denied") {
        toast.warn(i18n.t("platform.pushOptIn.deniedToast"));
        return;
      }
      toast.error(i18n.t("platform.pushOptIn.errorToast"));
    } catch {
      toast.error(i18n.t("platform.pushOptIn.errorToast"));
      setStatus(getOneSignalPushStatus());
    } finally {
      setBusy(false);
    }
  }, [busy, user]);

  const onDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  if (!visible) {
    return null;
  }

  const severity =
    domainState === PUSH_DOMAIN_STATES.PERMISSION_DENIED ||
    domainState === PUSH_DOMAIN_STATES.ERROR
      ? "warning"
      : "info";

  return (
    <Alert
      severity={severity}
      variant="outlined"
      className={classes.root}
      action={
        <div className={classes.actions}>
          {showOptIn ? (
            <Button
              color="primary"
              size="small"
              variant="contained"
              disabled={busy || domainState === PUSH_DOMAIN_STATES.SUBSCRIBING}
              onClick={onEnable}
            >
              {busy || domainState === PUSH_DOMAIN_STATES.SUBSCRIBING
                ? i18n.t("platform.pushOptIn.enabling")
                : i18n.t("platform.pushOptIn.enable")}
            </Button>
          ) : null}
          <Button size="small" onClick={onDismiss} disabled={busy}>
            {i18n.t("platform.pushOptIn.later")}
          </Button>
        </div>
      }
    >
      {messageForState(domainState, status.errorCode)}
    </Alert>
  );
}
