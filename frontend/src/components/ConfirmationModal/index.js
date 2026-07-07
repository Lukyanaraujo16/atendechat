import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppNeutralButton,
} from "../../ui";

const useStyles = makeStyles((theme) => ({
  confirmDanger: {
    color: theme.palette.error.contrastText,
    backgroundColor: theme.palette.error.main,
    boxShadow: "none",
    "&:hover": {
      backgroundColor: theme.palette.error.dark,
      boxShadow: "none",
    },
  },
}));

const ConfirmationModal = ({
  title,
  children,
  open,
  onClose,
  onConfirm,
  confirmText,
  cancelText,
  destructive,
  loading = false,
  asyncConfirm = false,
}) => {
  const classes = useStyles();

  const handleConfirm = () => {
    onConfirm();
    if (!asyncConfirm && !loading) {
      onClose(false);
    }
  };

  return (
    <AppDialog
      open={open}
      onClose={() => !loading && onClose(false)}
      aria-labelledby="confirm-dialog"
      maxWidth="xs"
    >
      <AppDialogTitle id="confirm-dialog">{title}</AppDialogTitle>
      <AppDialogContent dividers>
        <Typography component="div" variant="body2">
          {children}
        </Typography>
      </AppDialogContent>
      <AppDialogActions>
        <AppNeutralButton onClick={() => onClose(false)} disabled={loading}>
          {cancelText || i18n.t("confirmationModal.buttons.cancel")}
        </AppNeutralButton>
        {destructive ? (
          <Button
            variant="contained"
            className={classes.confirmDanger}
            onClick={handleConfirm}
            disabled={loading}
          >
            {confirmText || i18n.t("confirmationModal.buttons.confirm")}
          </Button>
        ) : (
          <AppPrimaryButton onClick={handleConfirm} loading={loading}>
            {confirmText || i18n.t("confirmationModal.buttons.confirm")}
          </AppPrimaryButton>
        )}
      </AppDialogActions>
    </AppDialog>
  );
};

export default ConfirmationModal;
