import React, { useState } from "react";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Alert from "@material-ui/lab/Alert";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

export default function AiAgentPromptPreviewModal({
  open,
  onClose,
  profilePayload,
  loadPreview,
  onUnavailable,
}) {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");

  const canLoad = Boolean(open && profilePayload && loadPreview);

  React.useEffect(() => {
    let active = true;
    if (!canLoad) {
      setPrompt("");
      return undefined;
    }

    const load = async () => {
      setLoading(true);
      try {
        const data = await loadPreview(profilePayload);
        if (active) setPrompt(data?.generatedPrompt || data?.preview || "");
      } catch (err) {
        if (active) {
          setPrompt("");
          if (err?.response?.status === 404) {
            onUnavailable();
            onClose();
          } else {
            toastError(err);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, open ? JSON.stringify(profilePayload) : null]);

  const handleCopy = async () => {
    if (!prompt?.trim()) return;
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(i18n.t("aiAgent.wizard.toasts.promptCopied"));
    } catch {
      toast.error(i18n.t("aiAgent.shadowSection.actions.copyError"));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>{i18n.t("aiAgent.wizard.preview.title")}</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" style={{ marginBottom: 16 }}>
          {i18n.t("aiAgent.wizard.preview.warning")}
        </Alert>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <CircularProgress size={28} />
          </div>
        ) : (
          <Typography
            component="pre"
            variant="body2"
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              margin: 0,
            }}
          >
            {prompt || i18n.t("aiAgent.wizard.preview.empty")}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{i18n.t("aiAgent.buttons.cancel")}</Button>
        <Button color="primary" onClick={handleCopy} disabled={!prompt?.trim()}>
          {i18n.t("aiAgent.wizard.buttons.copyPrompt")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
