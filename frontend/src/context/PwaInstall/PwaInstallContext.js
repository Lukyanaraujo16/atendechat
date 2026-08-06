import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthContext } from "../Auth/AuthContext";
import {
  detectPwaPlatform,
  getDefaultPlatformEnv,
  isDesktop,
  isPwaStandalone,
  PWA_PLATFORMS,
  supportsBeforeInstallPrompt,
} from "../../utils/pwaPlatform";
import {
  PWA_INSTALL_PROMPT_DELAY_MS,
  readInstalledFlag,
  shouldOfferInstallExperience,
  writeDismissedAt,
  writeInstalledFlag,
} from "../../utils/pwaInstallPersistence";
import { logPwaInstallMetric } from "../../utils/pwaInstallMetrics";

const PwaInstallContext = createContext(null);

export const INSTALLATION_STATUS = Object.freeze({
  IDLE: "idle",
  PROMPT_AVAILABLE: "prompt_available",
  PROMPTING: "prompting",
  ACCEPTED: "accepted",
  DISMISSED: "dismissed",
  INSTALLED: "installed",
  UNAVAILABLE: "unavailable",
});

function isBlockingUiOpen() {
  if (typeof document === "undefined") return false;
  try {
    const dialogs = document.querySelectorAll(
      '.MuiDialog-root[aria-hidden="false"], .MuiModal-root[aria-hidden="false"], [role="dialog"]'
    );
    for (let i = 0; i < dialogs.length; i += 1) {
      const el = dialogs[i];
      if (el.getAttribute("data-pwa-install") === "true") continue;
      const style = window.getComputedStyle(el);
      if (style.display !== "none" && style.visibility !== "hidden") {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export function PwaInstallProvider({ children, promptDelayMs = PWA_INSTALL_PROMPT_DELAY_MS }) {
  const { user, isAuth } = useContext(AuthContext);
  const userId = user?.id;

  const deferredPromptRef = useRef(null);
  const listenersAttachedRef = useRef(false);
  const shownMetricRef = useRef(false);
  const prevUserIdRef = useRef(userId);

  const [envSnapshot, setEnvSnapshot] = useState(() => getDefaultPlatformEnv());
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [installationStatus, setInstallationStatus] = useState(
    INSTALLATION_STATUS.IDLE
  );
  const [forceHelpOpen, setForceHelpOpen] = useState(false);
  const [autoOfferReady, setAutoOfferReady] = useState(false);
  const [blockingUi, setBlockingUi] = useState(false);

  const refreshEnv = useCallback(() => {
    const next = getDefaultPlatformEnv();
    setEnvSnapshot(next);
    return next;
  }, []);

  const platform = useMemo(
    () => detectPwaPlatform(envSnapshot),
    [envSnapshot]
  );
  const standalone = useMemo(
    () => isPwaStandalone(envSnapshot),
    [envSnapshot]
  );
  const desktop = useMemo(() => isDesktop(envSnapshot), [envSnapshot]);

  // Listener beforeinstallprompt / appinstalled — uma vez por montagem do provider
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (listenersAttachedRef.current) return undefined;
    listenersAttachedRef.current = true;

    const onBeforeInstall = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setCanPromptInstall(true);
      setInstallationStatus(INSTALLATION_STATUS.PROMPT_AVAILABLE);
      logPwaInstallMetric("install_prompt_available", { platform: "android" });
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanPromptInstall(false);
      setInstallationStatus(INSTALLATION_STATUS.INSTALLED);
      setForceHelpOpen(false);
      if (userId != null) {
        writeInstalledFlag(userId);
      }
      logPwaInstallMetric("install_prompt_accepted", { via: "appinstalled" });
      refreshEnv();
    };

    const onDisplayModeChange = () => {
      const next = refreshEnv();
      if (isPwaStandalone(next)) {
        logPwaInstallMetric("standalone_detected", {});
        setInstallationStatus(INSTALLATION_STATUS.INSTALLED);
        setForceHelpOpen(false);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    let media;
    try {
      media = window.matchMedia("(display-mode: standalone)");
      if (media?.addEventListener) {
        media.addEventListener("change", onDisplayModeChange);
      } else if (media?.addListener) {
        media.addListener(onDisplayModeChange);
      }
    } catch {
      media = null;
    }

    const initial = refreshEnv();
    if (isPwaStandalone(initial)) {
      setInstallationStatus(INSTALLATION_STATUS.INSTALLED);
      logPwaInstallMetric("standalone_detected", { at: "mount" });
    } else if (!supportsBeforeInstallPrompt(initial) && detectPwaPlatform(initial) === PWA_PLATFORMS.ANDROID) {
      setInstallationStatus(INSTALLATION_STATUS.UNAVAILABLE);
    }

    return () => {
      listenersAttachedRef.current = false;
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
      try {
        if (media?.removeEventListener) {
          media.removeEventListener("change", onDisplayModeChange);
        } else if (media?.removeListener) {
          media.removeListener(onDisplayModeChange);
        }
      } catch {
        /* ignore */
      }
    };
  }, [refreshEnv, userId]);

  // Reinicializar oferta após login / troca de utilizador
  useEffect(() => {
    let alive = true;
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      setAutoOfferReady(false);
      setForceHelpOpen(false);
      shownMetricRef.current = false;
    }

    if (!isAuth || !userId) {
      setAutoOfferReady(false);
      return undefined;
    }

    const timer = setTimeout(() => {
      if (alive) setAutoOfferReady(true);
    }, promptDelayMs);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [isAuth, userId, promptDelayMs]);

  // Poll leve para não sobrepor outros modais
  useEffect(() => {
    if (!isAuth) return undefined;
    let alive = true;
    const tick = () => {
      if (alive) setBlockingUi(isBlockingUiOpen());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [isAuth]);

  const installedFlag = Boolean(userId && readInstalledFlag(userId));

  const baseShouldOffer = shouldOfferInstallExperience({
    isAuth: Boolean(isAuth && userId),
    isStandalone: standalone,
    isDesktop: desktop,
    platform,
    userId,
    installedFlag,
  });

  const shouldShowInstallExperience =
    Boolean(forceHelpOpen) ||
    (baseShouldOffer && autoOfferReady && !blockingUi);

  useEffect(() => {
    if (!shouldShowInstallExperience || shownMetricRef.current) return;
    if (platform === PWA_PLATFORMS.ANDROID && canPromptInstall) {
      shownMetricRef.current = true;
      logPwaInstallMetric("install_prompt_shown", { platform: "android" });
    } else if (
      platform === PWA_PLATFORMS.IPHONE ||
      platform === PWA_PLATFORMS.IPAD
    ) {
      shownMetricRef.current = true;
      logPwaInstallMetric("ios_instructions_shown", { platform });
    }
  }, [shouldShowInstallExperience, platform, canPromptInstall]);

  const promptInstall = useCallback(async () => {
    const event = deferredPromptRef.current;
    if (!event || typeof event.prompt !== "function") {
      return { ok: false, outcome: "unavailable" };
    }

    deferredPromptRef.current = null;
    setCanPromptInstall(false);
    setInstallationStatus(INSTALLATION_STATUS.PROMPTING);

    try {
      await event.prompt();
      const choice =
        (event.userChoice && (await event.userChoice)) ||
        { outcome: "dismissed" };
      const outcome = choice?.outcome || "dismissed";

      if (outcome === "accepted") {
        setInstallationStatus(INSTALLATION_STATUS.ACCEPTED);
        logPwaInstallMetric("install_prompt_accepted", { platform: "android" });
        return { ok: true, outcome };
      }

      setInstallationStatus(INSTALLATION_STATUS.DISMISSED);
      logPwaInstallMetric("install_prompt_dismissed", { platform: "android" });
      return { ok: false, outcome };
    } catch {
      setInstallationStatus(INSTALLATION_STATUS.UNAVAILABLE);
      return { ok: false, outcome: "error" };
    }
  }, []);

  const dismissInstallPrompt = useCallback(() => {
    setForceHelpOpen(false);
    if (userId != null && platform) {
      writeDismissedAt(platform, userId);
    }
    logPwaInstallMetric("install_prompt_dismissed", {
      platform,
      via: "snooze",
    });
  }, [platform, userId]);

  const reopenInstallHelp = useCallback(() => {
    refreshEnv();
    setForceHelpOpen(true);
  }, [refreshEnv]);

  const closeForcedHelp = useCallback(() => {
    setForceHelpOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      platform,
      isStandalone: standalone,
      isDesktop: desktop,
      canPromptInstall,
      promptInstall,
      installationStatus,
      dismissInstallPrompt,
      reopenInstallHelp,
      closeForcedHelp,
      shouldShowInstallExperience,
      forceHelpOpen,
      envSnapshot,
      userId,
    }),
    [
      platform,
      standalone,
      desktop,
      canPromptInstall,
      promptInstall,
      installationStatus,
      dismissInstallPrompt,
      reopenInstallHelp,
      closeForcedHelp,
      shouldShowInstallExperience,
      forceHelpOpen,
      envSnapshot,
      userId,
    ]
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall() {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error("usePwaInstall must be used within PwaInstallProvider");
  }
  return ctx;
}

export { PwaInstallContext };
