import React from "react";
import { usePwaInstall } from "../../context/PwaInstall/PwaInstallContext";
import { PWA_PLATFORMS } from "../../utils/pwaPlatform";
import PwaInstallPrompt from "../PwaInstallPrompt";
import PwaInstallInstructions from "../PwaInstallInstructions";

/**
 * Orquestra a UI de instalação (Android snackbar / iOS modal).
 * Montado uma vez no shell autenticado via provider.
 */
export default function PwaInstallExperience() {
  const {
    platform,
    shouldShowInstallExperience,
    canPromptInstall,
    forceHelpOpen,
    isStandalone,
  } = usePwaInstall();

  if (isStandalone) {
    return null;
  }

  const showAndroid =
    shouldShowInstallExperience &&
    platform === PWA_PLATFORMS.ANDROID &&
    (canPromptInstall || forceHelpOpen);

  const showIos =
    shouldShowInstallExperience &&
    (platform === PWA_PLATFORMS.IPHONE || platform === PWA_PLATFORMS.IPAD);

  // Android forçado sem evento: o menu manual trata via toast; aqui só prompt real
  const androidOpen = showAndroid && canPromptInstall;

  return (
    <>
      <PwaInstallPrompt open={androidOpen} />
      <PwaInstallInstructions open={showIos} />
    </>
  );
}
