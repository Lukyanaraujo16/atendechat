import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  makeStyles,
} from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  paper: {
    borderRadius: 12,
    minWidth: 320,
    maxWidth: 480,
  },
  title: {
    fontWeight: 700,
  },
  actions: {
    padding: theme.spacing(2),
  },
}));

/**
 * Modal global de nova versão — reload apenas sob ação do usuário.
 */
export default function AppUpdateModal({
  open,
  onUpdate,
  unsavedHint = false,
}) {
  const classes = useStyles();

  return (
    <Dialog
      open={Boolean(open)}
      onClose={(_event, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          return;
        }
      }}
      disableEscapeKeyDown
      aria-labelledby="app-update-title"
      classes={{ paper: classes.paper }}
    >
      <DialogTitle id="app-update-title" className={classes.title}>
        Nova versão disponível
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          O StreamHUB Chat foi atualizado. Atualize para utilizar a versão mais
          recente.
        </DialogContentText>
        {unsavedHint ? (
          <DialogContentText color="textSecondary">
            Há alterações em andamento nesta tela. Salve o que for necessário
            antes de atualizar.
          </DialogContentText>
        ) : null}
      </DialogContent>
      <DialogActions className={classes.actions}>
        <Button
          onClick={onUpdate}
          color="primary"
          variant="contained"
          autoFocus
        >
          Atualizar agora
        </Button>
      </DialogActions>
    </Dialog>
  );
}
