import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import useCompanies from "../../hooks/useCompanies";
import { useDate } from "../../hooks/useDate";
import RenewSubscriptionDialog from "../CompanyFinanceSection/RenewSubscriptionDialog";
import {
  buildBillingReminderMessage,
  digitsForWhatsApp,
  formatCompanyLogEntry,
} from "./companyHelpers";

/**
 * Diálogos das ações rápidas de empresa (bloquear, renovar, excluir, notas internas,
 * histórico e lembrete de cobrança). Partilhados pela listagem e pela página individual.
 */

export function BlockCompanyDialog({ row, onClose, onConfirm, loading }) {
  return (
    <Dialog open={Boolean(row)} onClose={() => !loading && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>
        {row?.status === false
          ? i18n.t("platform.companies.confirmUnblockTitle")
          : i18n.t("platform.companies.confirmBlockTitle")}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" component="p">
          {row?.status === false
            ? i18n.t("platform.companies.confirmUnblockMessage", { name: row?.name || "—" })
            : i18n.t("platform.companies.confirmBlockMessage", { name: row?.name || "—" })}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" disabled={loading}>
          {i18n.t("confirmationModal.buttons.cancel")}
        </Button>
        <Button onClick={onConfirm} color="primary" variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={18} color="inherit" /> : i18n.t("confirmationModal.buttons.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function DeleteCompanyDialog({ row, onClose, onConfirm, loading }) {
  const [nameInput, setNameInput] = useState("");
  const expected = (row?.name || "").trim();
  const handleClose = () => {
    if (loading) return;
    setNameInput("");
    onClose();
  };
  return (
    <Dialog open={Boolean(row)} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{i18n.t("platform.companies.deleteGridTitle")}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" component="p" paragraph>
          {i18n.t("platform.companies.deleteGridMessage", { name: row?.name || "—" })}
        </Typography>
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          label={i18n.t("platform.companies.deleteGridNameLabel")}
          placeholder={row?.name || ""}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          autoComplete="off"
          disabled={loading}
        />
        <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 8 }}>
          {i18n.t("platform.companies.deleteGridHint")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary" disabled={loading}>
          {i18n.t("confirmationModal.buttons.cancel")}
        </Button>
        <Button
          onClick={async () => {
            const ok = await onConfirm(row);
            if (ok) setNameInput("");
          }}
          color="secondary"
          variant="contained"
          disabled={loading || !row || nameInput.trim() !== expected}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : i18n.t("platform.companies.deleteGridConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function InternalNotesDialog({ row, draft, onDraftChange, onClose, onSave, saving }) {
  return (
    <Dialog open={Boolean(row)} onClose={() => !saving && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{i18n.t("platform.companies.internalNotesDialogTitle")}</DialogTitle>
      <DialogContent dividers>
        {row ? (
          <Box display="flex" flexDirection="column" style={{ gap: 12 }}>
            <Typography variant="body2" color="textSecondary" component="p">
              {i18n.t("platform.companies.internalNotesHint")}
            </Typography>
            <Typography variant="subtitle2" component="p" style={{ fontWeight: 600 }}>
              {row.name || "—"}
            </Typography>
            <TextField
              multiline
              minRows={6}
              fullWidth
              variant="outlined"
              size="small"
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder={i18n.t("platform.companies.internalNotesPlaceholder")}
              disabled={saving}
              inputProps={{ "aria-label": i18n.t("platform.companies.internalNotesPlaceholder") }}
            />
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" disabled={saving}>
          {i18n.t("confirmationModal.buttons.cancel")}
        </Button>
        <Button onClick={onSave} color="primary" variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={18} color="inherit" /> : i18n.t("platform.companies.internalNotesSave")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function CompanyHistoryDialog({ row, items, loading, onClose }) {
  const { dateToClient, datetimeToClient } = useDate();
  return (
    <Dialog open={Boolean(row)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{i18n.t("platform.companies.companyHistoryTitle")}</DialogTitle>
      <DialogContent dividers>
        {row ? (
          <Typography variant="subtitle2" component="p" style={{ fontWeight: 600, marginBottom: 12 }}>
            {row.name || "—"}
          </Typography>
        ) : null}
        {loading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={28} />
          </Box>
        ) : !items.length ? (
          <Typography variant="body2" color="textSecondary" component="p">
            {i18n.t("platform.companies.companyHistoryEmpty")}
          </Typography>
        ) : (
          <Box display="flex" flexDirection="column" style={{ gap: 16 }}>
            {items.map((log) => {
              const entry = formatCompanyLogEntry(log, dateToClient, datetimeToClient);
              return (
                <Box key={log.id} data-log-id={log.id}>
                  <Typography variant="caption" color="textSecondary" component="p">
                    {entry.whenLabel}
                  </Typography>
                  <Typography variant="body2" style={{ fontWeight: 600 }} component="p">
                    {entry.title}
                  </Typography>
                  {entry.subtitle ? (
                    <Typography variant="body2" color="textSecondary" component="p">
                      {entry.subtitle}
                    </Typography>
                  ) : null}
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {i18n.t("confirmationModal.buttons.cancel")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function BillingReminderDialog({ row, onClose }) {
  const { dateToClient } = useDate();
  const message = useMemo(
    () => (row ? buildBillingReminderMessage(row, dateToClient) : ""),
    [row, dateToClient]
  );
  const waDigits = row ? digitsForWhatsApp(row.phone) : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success(i18n.t("platform.companies.billingCopiedToast"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleWhatsApp = () => {
    if (!waDigits) return;
    const url = `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={Boolean(row)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{i18n.t("platform.companies.billingDialogTitle")}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="caption" color="textSecondary" display="block" paragraph>
          {row ? `${row.name || "—"} · ${dateToClient(row.dueDate) || "—"}` : ""}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={5}
          variant="outlined"
          size="small"
          value={message}
          InputProps={{ readOnly: true, style: { fontSize: "0.8125rem", lineHeight: 1.5 } }}
        />
        {!waDigits ? (
          <Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 8 }}>
            {i18n.t("platform.companies.billingPhoneMissingHint")}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {i18n.t("confirmationModal.buttons.cancel")}
        </Button>
        <Button onClick={handleCopy} color="primary">
          {i18n.t("platform.companies.billingCopyButton")}
        </Button>
        <Button onClick={handleWhatsApp} color="primary" variant="contained" disabled={!waDigits}>
          {i18n.t("platform.companies.billingOpenWhatsApp")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function PrimaryAdminSetupDialog({ setup, onClose }) {
  return (
    <Dialog open={Boolean(setup)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{i18n.t("platform.companies.primaryAdminDialogTitle")}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" paragraph>
          {i18n.t("platform.companies.primaryAdminDialogIntro")}
        </Typography>
        {setup?.inviteEmailSent ? (
          <Alert severity="info" style={{ marginBottom: 12 }}>
            {i18n.t("platform.companies.primaryAdminInviteSent")}
          </Alert>
        ) : null}
        <TextField
          fullWidth
          margin="dense"
          label={i18n.t("platform.companies.primaryAdminEmail")}
          value={setup?.email || ""}
          InputProps={{ readOnly: true }}
          variant="outlined"
        />
        {setup?.temporaryPassword ? (
          <TextField
            fullWidth
            margin="dense"
            label={i18n.t("platform.companies.primaryAdminTempPassword")}
            value={setup.temporaryPassword}
            InputProps={{ readOnly: true }}
            variant="outlined"
            helperText={i18n.t("platform.companies.primaryAdminMustChange")}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          {i18n.t("confirmationModal.buttons.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Estado + diálogos das ações rápidas. `onChanged()` é chamado após qualquer alteração
 * (para recarregar a listagem ou a empresa); `onDeleted(row)` após exclusão.
 */
export function useCompanyQuickActions({ onChanged, onDeleted } = {}) {
  const { update, remove, fetchCompanyLogs } = useCompanies();

  const [blockRow, setBlockRow] = useState(null);
  const [blockLoading, setBlockLoading] = useState(false);
  const [renewRow, setRenewRow] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notesRow, setNotesRow] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [historyRow, setHistoryRow] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [billingRow, setBillingRow] = useState(null);

  const notifyChanged = useCallback(
    async (payload) => {
      if (typeof onChanged === "function") await onChanged(payload);
    },
    [onChanged]
  );

  const confirmBlock = async () => {
    const row = blockRow;
    if (!row) return;
    setBlockLoading(true);
    try {
      await update({ id: row.id, status: row.status === false });
      toast.success(i18n.t("platform.companies.statusUpdateSuccess"));
      setBlockRow(null);
      await notifyChanged();
    } catch (e) {
      toastError(e);
    } finally {
      setBlockLoading(false);
    }
  };

  const confirmDelete = async (row) => {
    if (!row) return false;
    setDeleteLoading(true);
    try {
      await remove(row.id);
      toast.success(i18n.t("platform.companies.deleteGridSuccess"));
      setDeleteRow(null);
      if (typeof onDeleted === "function") await onDeleted(row);
      else await notifyChanged();
      return true;
    } catch (e) {
      toastError(e);
      return false;
    } finally {
      setDeleteLoading(false);
    }
  };

  const saveNotes = async () => {
    if (!notesRow) return;
    setNotesSaving(true);
    try {
      await update({ id: notesRow.id, internalNotes: notesDraft });
      toast.success(i18n.t("platform.companies.internalNotesSaved"));
      setNotesRow(null);
      await notifyChanged();
    } catch (e) {
      toastError(e);
    } finally {
      setNotesSaving(false);
    }
  };

  const openHistory = async (row) => {
    setHistoryRow(row);
    setHistoryItems([]);
    setHistoryLoading(true);
    try {
      const items = await fetchCompanyLogs(row.id);
      setHistoryItems(Array.isArray(items) ? items : []);
    } catch (e) {
      toastError(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const actions = {
    openBlock: (row) => setBlockRow(row),
    openRenew: (row) => setRenewRow(row),
    openDelete: (row) => setDeleteRow(row),
    openNotes: (row) => {
      setNotesRow(row);
      setNotesDraft(row?.internalNotes || "");
    },
    openHistory,
    openBilling: (row) => setBillingRow(row),
  };

  const dialogs = (
    <>
      <BlockCompanyDialog
        row={blockRow}
        loading={blockLoading}
        onClose={() => setBlockRow(null)}
        onConfirm={confirmBlock}
      />
      {renewRow ? (
        <RenewSubscriptionDialog
          open={Boolean(renewRow)}
          company={{
            id: renewRow.id,
            name: renewRow.name,
            dueDate: renewRow.dueDate || null,
            recurrence: renewRow.recurrence || null,
          }}
          onClose={() => setRenewRow(null)}
          onRenewed={async (companyData) => {
            setRenewRow(null);
            await notifyChanged(companyData);
          }}
        />
      ) : null}
      <DeleteCompanyDialog
        row={deleteRow}
        loading={deleteLoading}
        onClose={() => setDeleteRow(null)}
        onConfirm={confirmDelete}
      />
      <InternalNotesDialog
        row={notesRow}
        draft={notesDraft}
        onDraftChange={setNotesDraft}
        saving={notesSaving}
        onClose={() => setNotesRow(null)}
        onSave={saveNotes}
      />
      <CompanyHistoryDialog
        row={historyRow}
        items={historyItems}
        loading={historyLoading}
        onClose={() => setHistoryRow(null)}
      />
      <BillingReminderDialog row={billingRow} onClose={() => setBillingRow(null)} />
    </>
  );

  return { actions, dialogs };
}
