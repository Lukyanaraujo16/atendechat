import React, { useRef, useState } from "react";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  hint: {
    marginBottom: theme.spacing(1.5),
    color: theme.palette.text.secondary,
    fontSize: "0.8125rem",
  },
  fileName: {
    marginTop: theme.spacing(1),
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
  },
}));

export default function StickerUploadDialog({
  open,
  onClose,
  onUpload,
}) {
  const classes = useStyles();
  const inputRef = useRef(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    if (loading) return;
    setFile(null);
    setName("");
    onClose();
  };

  const handlePick = () => inputRef.current?.click();

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const isWebp =
      picked.type === "image/webp" ||
      picked.name.toLowerCase().endsWith(".webp");
    if (!isWebp) {
      toastError(new Error(i18n.t("messagesInput.stickerOnlyWebp")));
      e.target.value = "";
      return;
    }
    setFile(picked);
    if (!name) {
      setName(picked.name.replace(/\.webp$/i, ""));
    }
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!file || loading) return;
    setLoading(true);
    try {
      await onUpload(file, name.trim() || undefined);
      handleClose();
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppDialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <AppDialogTitle>{i18n.t("messagesInput.stickers.uploadTitle")}</AppDialogTitle>
      <AppDialogContent>
        <Typography className={classes.hint}>
          {i18n.t("messagesInput.stickers.uploadHint")}
        </Typography>
        <input
          ref={inputRef}
          type="file"
          accept=".webp,image/webp"
          hidden
          onChange={handleFileChange}
        />
        <AppSecondaryButton onClick={handlePick} disabled={loading}>
          {i18n.t("messagesInput.stickers.chooseFile")}
        </AppSecondaryButton>
        {file ? (
          <Typography className={classes.fileName}>{file.name}</Typography>
        ) : null}
        <TextField
          label={i18n.t("messagesInput.stickers.nameLabel")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          margin="normal"
          variant="outlined"
          size="small"
        />
      </AppDialogContent>
      <AppDialogActions>
        <AppSecondaryButton onClick={handleClose} disabled={loading}>
          {i18n.t("messagesInput.stickers.cancel")}
        </AppSecondaryButton>
        <AppPrimaryButton onClick={handleSubmit} disabled={!file || loading}>
          {loading ? <CircularProgress size={20} /> : i18n.t("messagesInput.stickers.upload")}
        </AppPrimaryButton>
      </AppDialogActions>
    </AppDialog>
  );
}
