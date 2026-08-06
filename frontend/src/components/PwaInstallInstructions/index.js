import React, { useCallback } from "react";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
} from "../../ui";
import { usePwaInstall } from "../../context/PwaInstall/PwaInstallContext";
import { isSafariBrowser, PWA_PLATFORMS } from "../../utils/pwaPlatform";
import { i18n } from "../../translate/i18n";

/**
 * Modal instrutivo iPhone / iPad / iPadOS (sem prompt nativo).
 */
export default function PwaInstallInstructions({ open, onClose }) {
  const { platform, envSnapshot, dismissInstallPrompt, forceHelpOpen, closeForcedHelp } =
    usePwaInstall();

  const isApple =
    platform === PWA_PLATFORMS.IPHONE || platform === PWA_PLATFORMS.IPAD;
  const visible = Boolean(open && isApple);
  const safari = isSafariBrowser(envSnapshot);

  const handleUnderstood = useCallback(() => {
    if (forceHelpOpen) {
      closeForcedHelp();
    } else {
      dismissInstallPrompt();
    }
    if (onClose) onClose();
  }, [forceHelpOpen, closeForcedHelp, dismissInstallPrompt, onClose]);

  const handleNotNow = useCallback(() => {
    dismissInstallPrompt();
    if (onClose) onClose();
  }, [dismissInstallPrompt, onClose]);

  const titleKey =
    platform === PWA_PLATFORMS.IPAD
      ? "pwaInstall.ios.titleIpad"
      : "pwaInstall.ios.titleIphone";

  return (
    <AppDialog
      open={visible}
      onClose={handleNotNow}
      maxWidth="sm"
      fullWidth
      data-pwa-install="true"
      PaperProps={{ "data-pwa-install": "true" }}
    >
      <AppDialogTitle>{i18n.t(titleKey)}</AppDialogTitle>
      <AppDialogContent dividers>
        {!safari ? (
          <Typography variant="body2" color="textSecondary" paragraph>
            {i18n.t("pwaInstall.ios.nonSafariNote")}
          </Typography>
        ) : null}
        <List dense disablePadding>
          <ListItem>
            <ListItemText primary={`1. ${i18n.t("pwaInstall.ios.step1")}`} />
          </ListItem>
          <ListItem>
            <ListItemText primary={`2. ${i18n.t("pwaInstall.ios.step2")}`} />
          </ListItem>
          <ListItem>
            <ListItemText primary={`3. ${i18n.t("pwaInstall.ios.step3")}`} />
          </ListItem>
          <ListItem>
            <ListItemText primary={`4. ${i18n.t("pwaInstall.ios.step4")}`} />
          </ListItem>
        </List>
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
          {i18n.t("pwaInstall.ios.pushNote")}
        </Typography>
      </AppDialogContent>
      <AppDialogActions>
        <Button onClick={handleNotNow}>{i18n.t("pwaInstall.actions.notNow")}</Button>
        <Button color="primary" variant="contained" onClick={handleUnderstood}>
          {i18n.t("pwaInstall.actions.understood")}
        </Button>
      </AppDialogActions>
    </AppDialog>
  );
}
