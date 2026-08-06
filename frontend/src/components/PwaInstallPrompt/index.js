import React, { useCallback, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Snackbar from "@material-ui/core/Snackbar";
import Paper from "@material-ui/core/Paper";
import GetAppIcon from "@material-ui/icons/GetApp";
import { usePwaInstall } from "../../context/PwaInstall/PwaInstallContext";
import { PWA_PLATFORMS } from "../../utils/pwaPlatform";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  paper: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    maxWidth: 420,
    width: "100%",
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[6],
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.25),
  },
  icon: {
    color: theme.palette.primary.main,
    marginTop: 2,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
  },
}));

/**
 * Oferta discreta de instalação Android (beforeinstallprompt).
 * Só mostra “Instalar” quando o evento está disponível.
 */
export default function PwaInstallPrompt({ open, onClose }) {
  const classes = useStyles();
  const { platform, canPromptInstall, promptInstall, dismissInstallPrompt } =
    usePwaInstall();
  const [busy, setBusy] = useState(false);

  const visible =
    open &&
    platform === PWA_PLATFORMS.ANDROID &&
    canPromptInstall;

  const handleInstall = useCallback(async () => {
    if (busy || !canPromptInstall) return;
    setBusy(true);
    try {
      await promptInstall();
      if (onClose) onClose();
    } finally {
      setBusy(false);
    }
  }, [busy, canPromptInstall, promptInstall, onClose]);

  const handleDismiss = useCallback(() => {
    dismissInstallPrompt();
    if (onClose) onClose();
  }, [dismissInstallPrompt, onClose]);

  return (
    <Snackbar
      open={visible}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      data-pwa-install="true"
    >
      <Paper className={classes.paper} elevation={0} role="dialog" aria-labelledby="pwa-android-install-title">
        <div className={classes.header}>
          <GetAppIcon className={classes.icon} />
          <div>
            <Typography id="pwa-android-install-title" variant="subtitle1" style={{ fontWeight: 600 }}>
              {i18n.t("pwaInstall.android.title")}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {i18n.t("pwaInstall.android.body")}
            </Typography>
          </div>
        </div>
        <div className={classes.actions}>
          <Button size="small" onClick={handleDismiss} disabled={busy}>
            {i18n.t("pwaInstall.actions.notNow")}
          </Button>
          <Button
            size="small"
            color="primary"
            variant="contained"
            onClick={handleInstall}
            disabled={busy || !canPromptInstall}
          >
            {i18n.t("pwaInstall.actions.install")}
          </Button>
        </div>
      </Paper>
    </Snackbar>
  );
}
