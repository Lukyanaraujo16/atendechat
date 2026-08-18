import React, { useEffect, useRef, useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import GetAppIcon from "@material-ui/icons/GetApp";
import PersonAddIcon from "@material-ui/icons/PersonAdd";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import { buildGroupParticipantsExportRequest } from "./exportRequest";
import {
  applyPreviewError,
  applyPreviewSuccess,
  createPreviewRequestGuard,
} from "./previewRequestGuard";

function downloadCsvBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "participantes.csv";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(header) {
  if (!header) return "participantes.csv";
  const match = String(header).match(/filename="?([^"]+)"?/i);
  return match?.[1] || "participantes.csv";
}

function notifyRequestError(err) {
  const data = err?.response?.data;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    data
      .text()
      .then((text) => {
        try {
          toastError({
            ...err,
            response: { ...err.response, data: JSON.parse(text) },
          });
        } catch {
          toastError(err);
        }
      })
      .catch(() => toastError(err));
    return;
  }
  toastError(err);
}

const GroupImportParticipantsModal = ({
  open,
  group,
  whatsappId,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const onCloseRef = useRef(onClose);
  const previewGuardRef = useRef(createPreviewRequestGuard());

  onCloseRef.current = onClose;

  const groupJid = group?.id;

  useEffect(() => {
    if (!open || !whatsappId || !groupJid) {
      return undefined;
    }

    const request = previewGuardRef.current.begin();
    let cancelled = false;
    setLoading(true);
    setPreview(null);

    api
      .post(`/groups/${whatsappId}/participants/preview`, { groupJid })
      .then(({ data }) => {
        if (cancelled) return;
        applyPreviewSuccess(request, data, setPreview);
      })
      .catch((err) => {
        if (cancelled) return;
        applyPreviewError(request, () => {
          toastError(err);
          if (typeof onCloseRef.current === "function") {
            onCloseRef.current();
          }
        });
      })
      .finally(() => {
        if (!cancelled && request.isCurrent()) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, whatsappId, groupJid]);

  const handleExport = async () => {
    if (!whatsappId || !groupJid) return;
    setExporting(true);
    try {
      const response = await api.request(
        buildGroupParticipantsExportRequest(whatsappId, groupJid)
      );
      const filename = filenameFromDisposition(
        response.headers?.["content-disposition"]
      );
      downloadCsvBlob(response.data, filename);
      toast.success(i18n.t("groups.importParticipants.exportSuccess"));
    } catch (err) {
      notifyRequestError(err);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!whatsappId || !groupJid) return;
    setImporting(true);
    try {
      const { data } = await api.post(
        `/groups/${whatsappId}/participants/import`,
        { groupJid }
      );
      const failed = data.failed ?? 0;
      const skippedLimit = data.skippedLimit ?? 0;
      const toastKey =
        failed > 0
          ? "groups.importParticipants.importPartialSuccess"
          : "groups.importParticipants.importSuccess";
      toast.success(
        i18n.t(toastKey, {
          imported: data.imported ?? 0,
          skippedExisting: data.skippedExisting ?? 0,
          failed,
        })
      );
      if (skippedLimit > 0) {
        toast.info(
          i18n.t("groups.importParticipants.importLimitHint", {
            skippedLimit,
          })
        );
      }
      if (typeof onCloseRef.current === "function") {
        onCloseRef.current();
      }
    } catch (err) {
      toastError(err);
    } finally {
      setImporting(false);
    }
  };

  const busy = loading || exporting || importing;
  const canImport = (preview?.newContacts || 0) > 0;

  return (
    <AppDialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <AppDialogTitle subtitle={group?.name || preview?.groupName || ""}>
        {i18n.t("groups.importParticipants.title")}
      </AppDialogTitle>
      <AppDialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : preview ? (
          <Box display="flex" flexDirection="column" style={{ gap: 12 }}>
            <Typography variant="body2">
              {i18n.t("groups.importParticipants.total", {
                count: preview.totalParticipants ?? 0,
              })}
            </Typography>
            <Typography variant="body2">
              {i18n.t("groups.importParticipants.withPhone", {
                count: preview.withPhone ?? 0,
              })}
            </Typography>
            <Typography variant="body2">
              {i18n.t("groups.importParticipants.withoutPhone", {
                count: preview.withoutPhone ?? 0,
              })}
            </Typography>
            <Typography variant="body2">
              {i18n.t("groups.importParticipants.existing", {
                count: preview.existingContacts ?? 0,
              })}
            </Typography>
            <Typography variant="body2">
              {i18n.t("groups.importParticipants.news", {
                count: preview.newContacts ?? 0,
              })}
            </Typography>
            <Typography variant="body2">
              {i18n.t("groups.importParticipants.importable", {
                count: preview.importableCount ?? 0,
              })}
            </Typography>
            {preview.withoutPhone > 0 ? (
              <Typography variant="body2" color="textSecondary">
                {i18n.t("groups.importParticipants.unavailableHint")}
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </AppDialogContent>
      <AppDialogActions>
        <AppSecondaryButton onClick={onClose} disabled={busy}>
          {i18n.t("groups.importParticipants.cancel")}
        </AppSecondaryButton>
        <AppSecondaryButton
          onClick={handleExport}
          disabled={!preview || busy}
          loading={exporting}
          startIcon={<GetAppIcon />}
        >
          {i18n.t("groups.importParticipants.export")}
        </AppSecondaryButton>
        <AppPrimaryButton
          onClick={handleImport}
          disabled={!preview || !canImport || busy}
          loading={importing}
          startIcon={<PersonAddIcon />}
        >
          {i18n.t("groups.importParticipants.import")}
        </AppPrimaryButton>
      </AppDialogActions>
    </AppDialog>
  );
};

export default GroupImportParticipantsModal;
