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
import { PUSH_DOMAIN_STATES } from "../utils/oneSignalPushDomain";
import {
  derivePwaPushUiState,
  PWA_PUSH_UI_STATES,
  shouldShowPushActivateAction,
  shouldShowPushBannerForUiState,
} from "../utils/pwaPushExperience";
import { getDefaultPlatformEnv } from "../utils/pwaPlatform";
import { logPwaInstallMetric } from "../utils/pwaInstallMetrics";
import { usePwaInstall } from "../context/PwaInstall/PwaInstallContext";
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

function messageForUiState(uiState, domainState, errorCode) {
  if (uiState === PWA_PUSH_UI_STATES.IOS_INCOMPATIBLE) {
    return i18n.t("pwaInstall.push.iosIncompatible");
  }
  if (uiState === PWA_PUSH_UI_STATES.IOS_NEEDS_INSTALL) {
    return i18n.t("pwaInstall.push.iosNeedsInstall");
  }
  if (uiState === PWA_PUSH_UI_STATES.ACTIVE) {
    return i18n.t("pwaInstall.push.active");
  }
  if (uiState === PWA_PUSH_UI_STATES.DENIED) {
    return i18n.t("platform.pushOptIn.denied");
  }
  if (uiState === PWA_PUSH_UI_STATES.INIT_ERROR) {
    if (errorCode === "subscription_missing_after_permission") {
      return i18n.t("platform.pushOptIn.subscriptionMissing");
    }
    if (errorCode === "init_failed" || errorCode === "sdk_load_failed") {
      return i18n.t("platform.pushOptIn.initFailed");
    }
    return i18n.t("platform.pushOptIn.error");
  }
  if (domainState === PUSH_DOMAIN_STATES.PERMISSION_GRANTED_UNSUBSCRIBED) {
    return i18n.t("platform.pushOptIn.grantedUnsubscribed");
  }
  return i18n.t("platform.pushOptIn.message");
}

/**
 * Opt-in de push (OneSignal). Instalação PWA e push são passos separados.
 * Inclui estados iOS/iPadOS e standalone Android.
 */
export default function PushNotificationOptInBanner() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { reopenInstallHelp, isStandalone, envSnapshot } = usePwaInstall();
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
  }, [user?.id, isStandalone]);

  const env = envSnapshot || getDefaultPlatformEnv();
  const domainState = status.domainState;
  const uiState = derivePwaPushUiState({
    env,
    domainState,
    errorCode: status.errorCode,
    dismissed,
  });

  // “Notificações ativadas” não precisa de banner persistente
  const visible =
    Boolean(user?.id) &&
    shouldShowPushBannerForUiState(uiState) &&
    uiState !== PWA_PUSH_UI_STATES.ACTIVE;

  const showActivate = shouldShowPushActivateAction(uiState);
  const showInstallHelp = uiState === PWA_PUSH_UI_STATES.IOS_NEEDS_INSTALL;

  const onEnable = useCallback(async () => {
    if (busy) return;
    // iOS: nunca pedir permissão fora de standalone
    if (uiState === PWA_PUSH_UI_STATES.IOS_NEEDS_INSTALL) {
      reopenInstallHelp();
      return;
    }
    if (uiState === PWA_PUSH_UI_STATES.IOS_INCOMPATIBLE) {
      return;
    }

    setBusy(true);
    logPwaInstallMetric("push_activation_requested", {
      standalone: Boolean(isStandalone),
    });
    try {
      const result = await enableOneSignalPushSubscription({ user });
      setStatus(result.status || getOneSignalPushStatus());
      if (result.ok) {
        logPwaInstallMetric("push_activation_success", {});
        toast.success(i18n.t("platform.pushOptIn.success"));
        return;
      }
      logPwaInstallMetric("push_activation_failed", {
        code: result.errorCode || "unknown",
      });
      if (result.errorCode === "permission_denied") {
        toast.warn(i18n.t("platform.pushOptIn.deniedToast"));
        return;
      }
      toast.error(i18n.t("platform.pushOptIn.errorToast"));
    } catch {
      logPwaInstallMetric("push_activation_failed", { code: "exception" });
      toast.error(i18n.t("platform.pushOptIn.errorToast"));
      setStatus(getOneSignalPushStatus());
    } finally {
      setBusy(false);
    }
  }, [busy, uiState, reopenInstallHelp, isStandalone, user]);

  const onDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  if (!visible) {
    return null;
  }

  const severity =
    uiState === PWA_PUSH_UI_STATES.DENIED ||
    uiState === PWA_PUSH_UI_STATES.INIT_ERROR ||
    uiState === PWA_PUSH_UI_STATES.IOS_INCOMPATIBLE
      ? "warning"
      : "info";

  return (
    <Alert
      severity={severity}
      variant="outlined"
      className={classes.root}
      action={
        <div className={classes.actions}>
          {showInstallHelp ? (
            <Button
              color="primary"
              size="small"
              variant="contained"
              onClick={() => reopenInstallHelp()}
            >
              {i18n.t("pwaInstall.manual.menuLabel")}
            </Button>
          ) : null}
          {showActivate ? (
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
      {messageForUiState(uiState, domainState, status.errorCode)}
    </Alert>
  );
}
