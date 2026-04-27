import React, { useState, useEffect, useContext } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Paper,
  Switch,
  Typography,
} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { toast } from "react-toastify";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const defaultPrefs = () => ({
  pushEnabled: true,
  notifyNewTickets: true,
  notifyAssignedTickets: true,
  notifyTicketMessages: true,
  notifyTicketTransfers: true,
  inAppEnabled: true,
  inAppNewTickets: true,
  inAppAssignedTickets: true,
  inAppTicketMessages: true,
  inAppTicketTransfers: true,
  inAppAgenda: true,
  inAppBilling: true,
});

function mapPrefsFromApi(data) {
  if (!data) return defaultPrefs();
  return {
    pushEnabled: Boolean(data.pushEnabled),
    notifyNewTickets: Boolean(data.notifyNewTickets),
    notifyAssignedTickets: Boolean(data.notifyAssignedTickets),
    notifyTicketMessages: Boolean(data.notifyTicketMessages),
    notifyTicketTransfers: Boolean(data.notifyTicketTransfers),
    inAppEnabled: data.inAppEnabled !== false,
    inAppNewTickets: data.inAppNewTickets !== false,
    inAppAssignedTickets: data.inAppAssignedTickets !== false,
    inAppTicketMessages: data.inAppTicketMessages !== false,
    inAppTicketTransfers: data.inAppTicketTransfers !== false,
    inAppAgenda: data.inAppAgenda !== false,
    inAppBilling: data.inAppBilling !== false,
  };
}

function prefsPayload(prefs) {
  return {
    pushEnabled: prefs.pushEnabled,
    notifyNewTickets: prefs.notifyNewTickets,
    notifyAssignedTickets: prefs.notifyAssignedTickets,
    notifyTicketMessages: prefs.notifyTicketMessages,
    notifyTicketTransfers: prefs.notifyTicketTransfers,
    inAppEnabled: prefs.inAppEnabled,
    inAppNewTickets: prefs.inAppNewTickets,
    inAppAssignedTickets: prefs.inAppAssignedTickets,
    inAppTicketMessages: prefs.inAppTicketMessages,
    inAppTicketTransfers: prefs.inAppTicketTransfers,
    inAppAgenda: prefs.inAppAgenda,
    inAppBilling: prefs.inAppBilling,
  };
}

export default function PushNotificationPreferences() {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [preferenceContext, setPreferenceContext] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/users/me/notification-preferences");
        if (!cancelled && data) {
          setPrefs(mapPrefsFromApi(data));
          setPreferenceContext(
            data.preferenceContext && typeof data.preferenceContext === "object"
              ? data.preferenceContext
              : null
          );
        }
      } catch (e) {
        toastError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (key) => (e) => {
    const v = e.target.checked;
    setPrefs((p) => ({ ...p, [key]: v }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(
        "/users/me/notification-preferences",
        prefsPayload(prefs)
      );
      if (data) {
        setPrefs(mapPrefsFromApi(data));
        if (data.preferenceContext && typeof data.preferenceContext === "object") {
          setPreferenceContext(data.preferenceContext);
        }
      }
      toast.success(i18n.t("settings.pushPreferences.saved"));
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const subDisabled = !prefs.pushEnabled;
  const inAppSubDisabled = !prefs.inAppEnabled;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Paper elevation={0} style={{ padding: 16 }}>
      {preferenceContext?.scope === "platform" && (
        <Box mb={2}>
          <Alert severity="info">{i18n.t("settings.pushPreferences.platformScopeIntro")}</Alert>
        </Box>
      )}
      {user?.super &&
        preferenceContext?.scope === "tenant" &&
        preferenceContext?.companyId != null && (
        <Box mb={2}>
          <Alert severity="info">
            {i18n.t("settings.pushPreferences.tenantScopeIntro", {
              id: preferenceContext.companyId,
            })}
          </Alert>
        </Box>
      )}
      <Typography variant="h6" gutterBottom>
        {i18n.t("settings.pushPreferences.title")}
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        {i18n.t("settings.pushPreferences.intro")}
      </Typography>

      <Box display="flex" flexDirection="column" style={{ gap: 4 }}>
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.pushEnabled}
              onChange={setField("pushEnabled")}
            />
          }
          label={i18n.t("settings.pushPreferences.pushEnabled")}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.notifyNewTickets}
              disabled={subDisabled}
              onChange={setField("notifyNewTickets")}
            />
          }
          label={i18n.t("settings.pushPreferences.notifyNewTickets")}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.notifyAssignedTickets}
              disabled={subDisabled}
              onChange={setField("notifyAssignedTickets")}
            />
          }
          label={i18n.t("settings.pushPreferences.notifyAssignedTickets")}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.notifyTicketMessages}
              disabled={subDisabled}
              onChange={setField("notifyTicketMessages")}
            />
          }
          label={i18n.t("settings.pushPreferences.notifyTicketMessages")}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.notifyTicketTransfers}
              disabled={subDisabled}
              onChange={setField("notifyTicketTransfers")}
            />
          }
          label={i18n.t("settings.pushPreferences.notifyTicketTransfers")}
        />
      </Box>

      <Box mt={3} mb={1}>
        <Typography variant="subtitle1" gutterBottom>
          {i18n.t("settings.pushPreferences.inAppTitle")}
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("settings.pushPreferences.inAppIntro")}
        </Typography>
      </Box>

      <Box display="flex" flexDirection="column" style={{ gap: 4 }}>
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.inAppEnabled}
              onChange={setField("inAppEnabled")}
            />
          }
          label={i18n.t("settings.pushPreferences.inAppEnabled")}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.inAppNewTickets}
              disabled={inAppSubDisabled}
              onChange={setField("inAppNewTickets")}
            />
          }
          label={i18n.t("settings.pushPreferences.inAppNewTickets")}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.inAppAssignedTickets}
              disabled={inAppSubDisabled}
              onChange={setField("inAppAssignedTickets")}
            />
          }
          label={i18n.t("settings.pushPreferences.inAppAssignedTickets")}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.inAppTicketMessages}
              disabled={inAppSubDisabled}
              onChange={setField("inAppTicketMessages")}
            />
          }
          label={i18n.t("settings.pushPreferences.inAppTicketMessages")}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.inAppTicketTransfers}
              disabled={inAppSubDisabled}
              onChange={setField("inAppTicketTransfers")}
            />
          }
          label={i18n.t("settings.pushPreferences.inAppTicketTransfers")}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.inAppAgenda}
              disabled={inAppSubDisabled}
              onChange={setField("inAppAgenda")}
            />
          }
          label={i18n.t("settings.pushPreferences.inAppAgenda")}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={prefs.inAppBilling}
              disabled={inAppSubDisabled}
              onChange={setField("inAppBilling")}
            />
          }
          label={i18n.t("settings.pushPreferences.inAppBilling")}
        />
      </Box>

      <Box mt={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <CircularProgress size={22} color="inherit" />
          ) : (
            i18n.t("settings.pushPreferences.save")
          )}
        </Button>
      </Box>
    </Paper>
  );
}
