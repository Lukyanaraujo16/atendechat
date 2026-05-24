import React, { useState, useEffect, useContext } from "react";
import {
  CircularProgress,
  TextField,
  Chip,
  Box,
  Typography,
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { showSuccessToast } from "../../errors/feedbackToasts";
import { i18n } from "../../translate/i18n";
import {
  AppDialog,
  AppDialogTitle,
  AppDialogContent,
  AppDialogActions,
  AppPrimaryButton,
  AppSecondaryButton,
} from "../../ui";
import { AuthContext } from "../../context/Auth/AuthContext";

export default function ContactAssignmentsModal({
  open,
  onClose,
  contactId,
  contactName,
  onSaved,
}) {
  const { user: authUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    if (!open || !contactId) return undefined;

    const load = async () => {
      setLoading(true);
      try {
        const [usersRes, assignRes] = await Promise.all([
          api.get("/users/list"),
          api.get(`/contacts/${contactId}/assignments`),
        ]);
        const users = Array.isArray(usersRes.data) ? usersRes.data : [];
        setCompanyUsers(
          users.filter(
            (u) => Number(u.companyId) === Number(authUser?.companyId)
          )
        );
        const assignments = assignRes.data?.assignments || [];
        setSelectedUsers(
          assignments.map((a) => a.user).filter(Boolean)
        );
      } catch (err) {
        toastError(err);
        onClose();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open, contactId, authUser?.companyId, onClose]);

  const handleSave = async () => {
    if (!selectedUsers.length) {
      toastError(new Error(i18n.t("contacts.assignments.requiresOne")));
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put(`/contacts/${contactId}/assignments`, {
        userIds: selectedUsers.map((u) => u.id),
      });
      showSuccessToast(i18n.t("contacts.assignments.saved"));
      if (typeof onSaved === "function") {
        onSaved(data.assignments || []);
      }
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <AppDialogTitle>
        {i18n.t("contacts.assignments.title")}
        {contactName ? ` — ${contactName}` : ""}
      </AppDialogTitle>
      <AppDialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="textSecondary" paragraph>
              {i18n.t("contacts.assignments.hint")}
            </Typography>
            <Autocomplete
              multiple
              options={companyUsers}
              value={selectedUsers}
              onChange={(_, value) => setSelectedUsers(value)}
              getOptionLabel={(option) =>
                option.name
                  ? `${option.name}${option.profile ? ` (${option.profile})` : ""}`
                  : option.email || ""
              }
              getOptionSelected={(opt, val) => opt.id === val.id}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name || option.email}
                    {...getTagProps({ index })}
                    size="small"
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  label={i18n.t("contacts.assignments.fieldLabel")}
                  placeholder={i18n.t("contacts.assignments.fieldPlaceholder")}
                />
              )}
            />
          </>
        )}
      </AppDialogContent>
      <AppDialogActions>
        <AppSecondaryButton onClick={onClose} disabled={saving}>
          {i18n.t("contacts.assignments.cancel")}
        </AppSecondaryButton>
        <AppPrimaryButton onClick={handleSave} disabled={loading || saving}>
          {saving ? (
            <CircularProgress size={22} color="inherit" />
          ) : (
            i18n.t("contacts.assignments.save")
          )}
        </AppPrimaryButton>
      </AppDialogActions>
    </AppDialog>
  );
}
