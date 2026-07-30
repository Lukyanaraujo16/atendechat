import React, { useCallback, useEffect, useMemo, useState } from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import Chip from "@material-ui/core/Chip";
import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import {
  AppPrimaryButton,
  AppSecondaryButton,
  AppNeutralButton,
  AppEmptyState,
} from "../../ui";
import ConfirmationModal from "../ConfirmationModal";
import {
  getAiAgentProductConfigurationOptions,
  putAiAgentProductConnections,
} from "../../services/aiAgentProductApi";
import {
  aiAgentConnectionConflictMessage,
  partitionAiAgentProductConnections,
} from "../../utils/aiAgentProductConnections";
import { notifyAiAgentProductAgentsChanged } from "../../utils/aiAgentProductAgentsCache";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  section: {
    marginBottom: theme.spacing(2.5),
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  meta: {
    color: theme.palette.text.secondary,
    wordBreak: "break-word",
  },
  conflict: {
    color: theme.palette.error.main,
  },
  transferHint: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
}));

function mapConnectionsError(err) {
  const code = err?.response?.data?.error || err?.response?.data?.message;
  if (code === "ERR_AI_AGENT_PRODUCT_CONNECTION_ALREADY_ASSIGNED") {
    return i18n.t("aiAgentProduct.configurationErrors.connectionAssigned");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED") {
    return i18n.t("aiAgentProduct.configurationErrors.agentRefRequired");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND") {
    return i18n.t("aiAgentProduct.configurationErrors.agentNotFound");
  }
  if (code === "ERR_AI_AGENT_PRODUCT_CONNECTION_INVALID") {
    return i18n.t("aiAgentProduct.configurationErrors.connectionInvalid");
  }
  return null;
}

/**
 * Gestão de conexões agent-scoped — Fase 2.9C.
 * Sem transferência silenciosa; conflito mostra agente detentor.
 */
export default function AiAgentConnectionsPanel({
  open,
  onClose,
  agentRef,
  agentName,
  onChanged,
  canMutate = true,
}) {
  const classes = useStyles();
  const agentRefKey = String(agentRef || "").trim();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [connections, setConnections] = useState([]);
  const [unlinkTarget, setUnlinkTarget] = useState(null);

  const buckets = useMemo(
    () => partitionAiAgentProductConnections(connections),
    [connections]
  );

  const reload = useCallback(async () => {
    if (!agentRefKey) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAiAgentProductConfigurationOptions(agentRefKey);
      setConnections(Array.isArray(data?.connections) ? data.connections : []);
    } catch (err) {
      setError(mapConnectionsError(err) || i18n.t("aiAgentProduct.error.description"));
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [agentRefKey]);

  useEffect(() => {
    if (!open) {
      setConnections([]);
      setError(null);
      setUnlinkTarget(null);
      return undefined;
    }
    setConnections([]);
    setError(null);
    setUnlinkTarget(null);
    reload();
    return undefined;
  }, [open, reload]);

  const persistLinkedRefs = async (nextRefs) => {
    if (!agentRefKey || !canMutate) return;
    const startedAgentRef = agentRefKey;
    setSaving(true);
    try {
      await putAiAgentProductConnections(
        { connectionRefs: nextRefs },
        startedAgentRef
      );
      if (startedAgentRef !== String(agentRef || "").trim()) return;
      notifyAiAgentProductAgentsChanged();
      await reload();
      if (onChanged) await onChanged();
      toast.success(i18n.t("aiAgentProduct.connections.saved"));
    } catch (err) {
      if (startedAgentRef !== String(agentRef || "").trim()) return;
      const mapped = mapConnectionsError(err);
      if (mapped) toast.error(mapped);
      else toastError(err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleLink = async (connection) => {
    if (!connection?.eligible || connection.selected) return;
    if (!connection.eligible) return;
    const next = [
      ...buckets.linked.map((item) => String(item.ref)),
      String(connection.ref),
    ];
    await persistLinkedRefs(next);
  };

  const handleUnlinkConfirm = async () => {
    if (!unlinkTarget) return;
    const next = buckets.linked
      .map((item) => String(item.ref))
      .filter((ref) => ref !== String(unlinkTarget.ref));
    try {
      await persistLinkedRefs(next);
      setUnlinkTarget(null);
    } catch (_err) {
      // toast já exibido
    }
  };

  const title = i18n.t("aiAgentProduct.connections.title", {
    name: agentName || i18n.t("aiAgentProduct.meta.unnamed"),
  });

  return (
    <>
      <Dialog
        open={open}
        onClose={() => !saving && onClose?.()}
        fullWidth
        maxWidth="sm"
        aria-labelledby="ai-agent-connections-title"
        data-testid="ai-agent-connections-panel"
      >
        <DialogTitle id="ai-agent-connections-title">{title}</DialogTitle>
        <DialogContent dividers>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4} role="status">
              <CircularProgress size={28} />
            </Box>
          ) : null}

          {!loading && error ? (
            <AppEmptyState
              title={i18n.t("aiAgentProduct.error.title")}
              description={error}
            >
              <AppSecondaryButton onClick={reload}>
                {i18n.t("aiAgentProduct.actions.retry")}
              </AppSecondaryButton>
            </AppEmptyState>
          ) : null}

          {!loading && !error ? (
            <>
              <Box className={classes.section} data-testid="ai-agent-connections-linked">
                <Typography className={classes.sectionTitle} component="h3">
                  {i18n.t("aiAgentProduct.connections.linkedTitle")}
                </Typography>
                {buckets.linked.length === 0 ? (
                  <Typography variant="body2" className={classes.meta}>
                    {i18n.t("aiAgentProduct.connections.linkedEmpty")}
                  </Typography>
                ) : (
                  buckets.linked.map((connection) => (
                    <Box
                      key={connection.ref}
                      className={classes.row}
                      data-testid={`ai-agent-connection-linked-${connection.ref}`}
                    >
                      <Box minWidth={0}>
                        <Typography variant="subtitle2">{connection.name}</Typography>
                        <Typography variant="body2" className={classes.meta}>
                          {connection.status || "—"}
                        </Typography>
                      </Box>
                      {canMutate ? (
                        <AppNeutralButton
                          onClick={() => setUnlinkTarget(connection)}
                          disabled={saving}
                          data-testid={`ai-agent-connection-unlink-${connection.ref}`}
                        >
                          {i18n.t("aiAgentProduct.connections.unlink")}
                        </AppNeutralButton>
                      ) : null}
                    </Box>
                  ))
                )}
              </Box>

              <Box className={classes.section} data-testid="ai-agent-connections-available">
                <Typography className={classes.sectionTitle} component="h3">
                  {i18n.t("aiAgentProduct.connections.availableTitle")}
                </Typography>
                {buckets.available.length === 0 ? (
                  <Typography variant="body2" className={classes.meta}>
                    {i18n.t("aiAgentProduct.connections.availableEmpty")}
                  </Typography>
                ) : (
                  buckets.available.map((connection) => (
                    <Box
                      key={connection.ref}
                      className={classes.row}
                      data-testid={`ai-agent-connection-available-${connection.ref}`}
                    >
                      <Box minWidth={0}>
                        <Typography variant="subtitle2">{connection.name}</Typography>
                        <Typography variant="body2" className={classes.meta}>
                          {connection.status || "—"}
                        </Typography>
                      </Box>
                      {canMutate ? (
                        <AppPrimaryButton
                          onClick={() => handleLink(connection)}
                          disabled={saving}
                          data-testid={`ai-agent-connection-link-${connection.ref}`}
                        >
                          {i18n.t("aiAgentProduct.connections.link")}
                        </AppPrimaryButton>
                      ) : null}
                    </Box>
                  ))
                )}
              </Box>

              <Box className={classes.section} data-testid="ai-agent-connections-other">
                <Typography className={classes.sectionTitle} component="h3">
                  {i18n.t("aiAgentProduct.connections.otherTitle")}
                </Typography>
                {buckets.other.length > 0 ? (
                  <Typography
                    variant="body2"
                    className={classes.transferHint}
                    role="note"
                    data-testid="ai-agent-connections-transfer-hint"
                  >
                    {i18n.t("aiAgentProduct.connections.transferHint")}
                  </Typography>
                ) : null}
                {buckets.other.length === 0 ? (
                  <Typography variant="body2" className={classes.meta}>
                    {i18n.t("aiAgentProduct.connections.otherEmpty")}
                  </Typography>
                ) : (
                  buckets.other.map((connection) => {
                    const conflict = aiAgentConnectionConflictMessage(connection);
                    return (
                      <Box
                        key={connection.ref}
                        className={classes.row}
                        data-testid={`ai-agent-connection-other-${connection.ref}`}
                      >
                        <Box minWidth={0}>
                          <Typography variant="subtitle2">
                            {connection.name}
                          </Typography>
                          <Typography variant="body2" className={classes.meta}>
                            {connection.status || "—"}
                          </Typography>
                          <Typography
                            variant="body2"
                            className={classes.conflict}
                            role="status"
                          >
                            {i18n.t(conflict.key, conflict.params)}
                          </Typography>
                          <Chip
                            size="small"
                            label={i18n.t(
                              "aiAgentProduct.connections.transferBlocked"
                            )}
                            style={{ marginTop: 4 }}
                          />
                        </Box>
                        <AppNeutralButton disabled>
                          {i18n.t("aiAgentProduct.connections.linkBlocked")}
                        </AppNeutralButton>
                      </Box>
                    );
                  })
                )}
              </Box>
            </>
          ) : null}
        </DialogContent>
        <DialogActions className={classes.actions}>
          <AppSecondaryButton
            onClick={onClose}
            disabled={saving}
            data-testid="ai-agent-connections-close"
          >
            {i18n.t("aiAgentProduct.connections.close")}
          </AppSecondaryButton>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        title={i18n.t("aiAgentProduct.connections.unlinkConfirmTitle")}
        open={Boolean(unlinkTarget)}
        onClose={() => !saving && setUnlinkTarget(null)}
        onConfirm={handleUnlinkConfirm}
        confirmText={i18n.t("aiAgentProduct.connections.unlink")}
        loading={saving}
        asyncConfirm
      >
        {i18n.t("aiAgentProduct.connections.unlinkConfirmBody", {
          name: unlinkTarget?.name || "",
        })}
      </ConfirmationModal>
    </>
  );
}
