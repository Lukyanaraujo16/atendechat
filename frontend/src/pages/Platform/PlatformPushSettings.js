import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import MenuItem from "@material-ui/core/MenuItem";
import Button from "@material-ui/core/Button";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import PlatformPageHeader from "./PlatformPageHeader";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AppPrimaryButton, AppLoadingState } from "../../ui";

const useStyles = makeStyles((theme) => ({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    width: "100%",
    maxWidth: 560,
  },
  hint: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.55,
    marginTop: theme.spacing(0.5),
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
}));

export default function PlatformPushSettings() {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appId, setAppId] = useState("");
  const [restApiKeyInput, setRestApiKeyInput] = useState("");
  const [hasStoredRestKey, setHasStoredRestKey] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState("production");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/system-settings");
      const s = data?.settings || {};
      setAppId(String(s.onesignal_app_id || "").trim());
      const rk = String(s.onesignal_rest_api_key || "").trim();
      setHasStoredRestKey(rk.length > 0);
      setRestApiKeyInput("");
      setEnabled(s.onesignal_enabled === "true" || s.onesignal_enabled === "1");
      setEnvironment(s.onesignal_environment === "development" ? "development" : "production");
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const onesignal = {
        appId: appId.trim(),
        enabled,
        environment,
      };
      if (restApiKeyInput.trim()) {
        onesignal.restApiKey = restApiKeyInput.trim();
      } else if (!hasStoredRestKey) {
        onesignal.restApiKey = "";
      }
      await api.put("/system-settings", { onesignal });
      toast.success(i18n.t("platform.pushSettings.saved"));
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const clearRestKey = async () => {
    setSaving(true);
    try {
      await api.put("/system-settings", {
        onesignal: {
          appId: appId.trim(),
          enabled,
          environment,
          restApiKey: "",
        },
      });
      toast.success(i18n.t("platform.pushSettings.keyRemoved"));
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainContainer>
        <AppLoadingState />
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <Box className={classes.page}>
        <PlatformPageHeader
          titleKey="platform.pushSettings.title"
          subtitleKey="platform.pushSettings.subtitle"
        />
        <Typography variant="body2" color="textSecondary" className={classes.hint}>
          {i18n.t("platform.pushSettings.securityHint")}
        </Typography>
        <div className={classes.fields}>
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                color="primary"
              />
            }
            label={i18n.t("platform.pushSettings.enabled")}
          />
          <TextField
            label={i18n.t("platform.pushSettings.appId")}
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            variant="outlined"
            fullWidth
            required
          />
          <TextField
            select
            label={i18n.t("platform.pushSettings.environment")}
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            variant="outlined"
            fullWidth
          >
            <MenuItem value="production">{i18n.t("platform.pushSettings.envProduction")}</MenuItem>
            <MenuItem value="development">{i18n.t("platform.pushSettings.envDevelopment")}</MenuItem>
          </TextField>
          <TextField
            label={i18n.t("platform.pushSettings.restKey")}
            value={restApiKeyInput}
            onChange={(e) => setRestApiKeyInput(e.target.value)}
            variant="outlined"
            fullWidth
            type="password"
            autoComplete="new-password"
            placeholder={
              hasStoredRestKey
                ? i18n.t("platform.pushSettings.restKeyPlaceholderKeep")
                : i18n.t("platform.pushSettings.restKeyPlaceholderEmpty")
            }
            helperText={i18n.t("platform.pushSettings.restKeyHelp")}
          />
          {hasStoredRestKey ? (
            <Button variant="outlined" disabled={saving} onClick={clearRestKey}>
              {i18n.t("platform.pushSettings.removeRestKey")}
            </Button>
          ) : null}
        </div>
        <AppPrimaryButton
          onClick={save}
          disabled={saving || (enabled && !appId.trim())}
        >
          {i18n.t("platform.pushSettings.save")}
        </AppPrimaryButton>
      </Box>
    </MainContainer>
  );
}
