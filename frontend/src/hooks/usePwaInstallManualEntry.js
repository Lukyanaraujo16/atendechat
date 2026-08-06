import { useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { usePwaInstall } from "../context/PwaInstall/PwaInstallContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { PWA_PLATFORMS } from "../utils/pwaPlatform";
import { i18n } from "../translate/i18n";

/**
 * Entrada manual “Instalar aplicativo” (menu do utilizador).
 */
export function usePwaInstallManualEntry() {
  const { isAuth } = useContext(AuthContext);
  const {
    platform,
    isStandalone,
    isDesktop,
    canPromptInstall,
    promptInstall,
    reopenInstallHelp,
  } = usePwaInstall();

  const handleInstallAppClick = useCallback(async () => {
    if (!isAuth) return;

    if (isStandalone) {
      toast.info(i18n.t("pwaInstall.manual.alreadyInstalled"));
      return;
    }

    if (isDesktop || platform === PWA_PLATFORMS.DESKTOP) {
      toast.info(i18n.t("pwaInstall.manual.desktopHint"));
      return;
    }

    if (platform === PWA_PLATFORMS.ANDROID) {
      if (canPromptInstall) {
        const result = await promptInstall();
        if (result?.outcome === "accepted") {
          toast.success(i18n.t("pwaInstall.manual.installStarted"));
        }
        return;
      }
      toast.info(i18n.t("pwaInstall.manual.androidMenuHint"));
      return;
    }

    if (
      platform === PWA_PLATFORMS.IPHONE ||
      platform === PWA_PLATFORMS.IPAD
    ) {
      reopenInstallHelp();
      return;
    }

    toast.info(i18n.t("pwaInstall.manual.unsupported"));
  }, [
    isAuth,
    isStandalone,
    isDesktop,
    platform,
    canPromptInstall,
    promptInstall,
    reopenInstallHelp,
  ]);

  return { handleInstallAppClick };
}
