import React, { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppNeutralButton,
  AppSectionCard,
} from "../../ui";
import { postAiAgentProductArchive } from "../../services/aiAgentProductApi";
import { notifyAiAgentProductAgentsChanged } from "../../utils/aiAgentProductAgentsCache";
import { mapAiAgentProductCommandError } from "../../utils/aiAgentQuickToggle";
import { AI_AGENT_ROUTE_PATH } from "../../config/aiAgentFeature";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  zone: {
    marginTop: theme.spacing(4),
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.error.main}`,
    borderRadius: theme.shape.borderRadius,
  },
  title: {
    fontWeight: 700,
    color: theme.palette.error.main,
    marginBottom: theme.spacing(1),
  },
  body: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  confirmDanger: {
    color: theme.palette.error.contrastText,
    backgroundColor: theme.palette.error.main,
    boxShadow: "none",
    "&:hover": {
      backgroundColor: theme.palette.error.dark,
      boxShadow: "none",
    },
    "&:disabled": {
      color: theme.palette.error.contrastText,
      backgroundColor: theme.palette.error.light,
    },
  },
}));

export function archiveNameMatches(typed, name) {
  return String(typed || "").trim() === String(name || "").trim();
}

/**
 * Zona de perigo — arquivar agente (Fase 2.21C). Soft archive, sem hard delete.
 */
export default function AiAgentArchiveControl({
  agentRef,
  agentName,
  enabled = false,
  canMutate = false,
  commandBusy = null,
}) {
  const classes = useStyles();
  const history = useHistory();
  const inFlightRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeBlockOpen, setActiveBlockOpen] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);

  const refKey = String(agentRef || "").trim();
  const name =
    String(agentName || "").trim() || i18n.t("aiAgentProduct.meta.unnamed");
  const blocked = !canMutate || Boolean(commandBusy) || busy || !refKey;
  const nameOk = archiveNameMatches(typedName, name);

  useEffect(() => {
    if (!confirmOpen) setTypedName("");
  }, [confirmOpen]);

  const start = () => {
    if (blocked || inFlightRef.current) return;
    if (enabled === true) {
      setActiveBlockOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    if (inFlightRef.current || busy) return;
    setConfirmOpen(false);
  };

  const confirmArchive = async () => {
    if (blocked || !nameOk || inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try {
      await postAiAgentProductArchive(refKey);
      notifyAiAgentProductAgentsChanged();
      toast.success(i18n.t("aiAgentProduct.archive.success"));
      setConfirmOpen(false);
      history.push(AI_AGENT_ROUTE_PATH);
    } catch (err) {
      toast.error(
        err?.response?.data?.error ===
          "ERR_AI_AGENT_PRODUCT_ARCHIVE_REQUIRES_DEACTIVATION"
          ? i18n.t("aiAgentProduct.archive.requiresDeactivation")
          : mapAiAgentProductCommandError(err)
      );
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  };

  if (!canMutate || !refKey) return null;

  return (
    <AppSectionCard
      className={classes.zone}
      data-testid="ai-agent-danger-zone"
    >
      <Typography variant="h6" component="h3" className={classes.title}>
        {i18n.t("aiAgentProduct.archive.dangerTitle")}
      </Typography>
      <Typography variant="subtitle1" component="h4">
        {i18n.t("aiAgentProduct.archive.cardTitle")}
      </Typography>
      <Typography variant="body2" className={classes.body}>
        {i18n.t("aiAgentProduct.archive.cardBody")}
      </Typography>
      <Button
        variant="contained"
        className={classes.confirmDanger}
        onClick={start}
        disabled={blocked}
        data-testid="ai-agent-archive-cta"
        aria-label={i18n.t("aiAgentProduct.archive.ctaAria", { name })}
      >
        {i18n.t("aiAgentProduct.archive.cta")}
      </Button>

      <AppDialog
        open={activeBlockOpen}
        onClose={() => setActiveBlockOpen(false)}
        aria-labelledby="ai-agent-archive-active-title"
        maxWidth="xs"
      >
        <AppDialogTitle id="ai-agent-archive-active-title">
          {i18n.t("aiAgentProduct.archive.activeTitle", { name })}
        </AppDialogTitle>
        <AppDialogContent dividers>
          <Typography variant="body2">
            {i18n.t("aiAgentProduct.archive.requiresDeactivation")}
          </Typography>
        </AppDialogContent>
        <AppDialogActions>
          <AppNeutralButton onClick={() => setActiveBlockOpen(false)}>
            {i18n.t("confirmationModal.buttons.cancel")}
          </AppNeutralButton>
        </AppDialogActions>
      </AppDialog>

      <AppDialog
        open={confirmOpen}
        onClose={() => !busy && closeConfirm()}
        aria-labelledby="ai-agent-archive-confirm-title"
        maxWidth="xs"
      >
        <AppDialogTitle id="ai-agent-archive-confirm-title">
          {i18n.t("aiAgentProduct.archive.confirmTitle", { name })}
        </AppDialogTitle>
        <AppDialogContent dividers>
          <Typography variant="body2" paragraph>
            {i18n.t("aiAgentProduct.archive.confirmBody")}
          </Typography>
          <Typography variant="body2" paragraph>
            {i18n.t("aiAgentProduct.archive.confirmNameLabel")}
          </Typography>
          <Box>
            <TextField
              autoFocus
              fullWidth
              variant="outlined"
              size="small"
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              disabled={busy}
              inputProps={{
                "data-testid": "ai-agent-archive-name-input",
                "aria-label": i18n.t("aiAgentProduct.archive.confirmNameLabel"),
              }}
            />
          </Box>
        </AppDialogContent>
        <AppDialogActions>
          <AppNeutralButton onClick={closeConfirm} disabled={busy}>
            {i18n.t("confirmationModal.buttons.cancel")}
          </AppNeutralButton>
          <Button
            variant="contained"
            className={classes.confirmDanger}
            onClick={confirmArchive}
            disabled={busy || !nameOk}
            data-testid="ai-agent-archive-confirm"
          >
            {i18n.t("aiAgentProduct.archive.cta")}
          </Button>
        </AppDialogActions>
      </AppDialog>
    </AppSectionCard>
  );
}
