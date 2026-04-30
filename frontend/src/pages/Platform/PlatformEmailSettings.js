import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Button from "@material-ui/core/Button";
import Divider from "@material-ui/core/Divider";
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
    maxWidth: 640,
  },
  card: {
    padding: theme.spacing(2.5),
    borderRadius: theme.shape.borderRadius,
  },
  hint: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.55,
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  testRow: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1),
  },
  testActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
}));

export default function PlatformEmailSettings() {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [user, setUser] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [secure, setSecure] = useState(false);
  const [requireTls, setRequireTls] = useState(true);
  const [replyTo, setReplyTo] = useState("");
  const [testTo, setTestTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/system-settings/smtp");
      setEnabled(Boolean(data?.enabled));
      setHost(String(data?.host || ""));
      setPort(String(data?.port ?? 587));
      setUser(String(data?.user || ""));
      setHasStoredPassword(Boolean(data?.hasPassword));
      setPasswordInput("");
      setFromName(String(data?.fromName || ""));
      setFromEmail(String(data?.fromEmail || ""));
      setSecure(Boolean(data?.secure));
      setRequireTls(data?.requireTls !== false);
      setReplyTo(String(data?.replyTo || ""));
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buildPayload = (extra = {}) => {
    const p = parseInt(String(port), 10);
    return {
      enabled,
      host: host.trim(),
      port: Number.isFinite(p) ? p : 587,
      user: user.trim(),
      fromName: fromName.trim(),
      fromEmail: fromEmail.trim().toLowerCase(),
      secure,
      requireTls,
      replyTo: replyTo.trim().toLowerCase(),
      ...extra,
    };
  };

  const save = async () => {
    if (!fromEmail.trim()) {
      toast.error(i18n.t("platform.emailSettings.validation.fromEmail"));
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (passwordInput.trim()) {
        payload.password = passwordInput.trim();
      }
      const { data } = await api.put("/system-settings/smtp", payload);
      toast.success(i18n.t("platform.emailSettings.saved"));
      setEnabled(Boolean(data?.enabled));
      setHasStoredPassword(Boolean(data?.hasPassword));
      setPasswordInput("");
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const removeStoredPassword = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/system-settings/smtp", {
        ...buildPayload(),
        clearPassword: true,
      });
      toast.success(i18n.t("platform.emailSettings.passwordRemoved"));
      setHasStoredPassword(Boolean(data?.hasPassword));
      setPasswordInput("");
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    const to = testTo.trim().toLowerCase();
    if (!to) {
      toast.error(i18n.t("platform.emailSettings.validation.testTo"));
      return;
    }
    setTesting(true);
    try {
      await api.post("/system-settings/smtp/test", { to });
      toast.success(i18n.t("platform.emailSettings.testSent"));
    } catch (e) {
      const msg = e?.response?.data?.message;
      if (msg && typeof msg === "string" && msg.trim()) {
        toast.error(msg.trim());
      } else {
        toastError(e);
      }
    } finally {
      setTesting(false);
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
          titleKey="platform.emailSettings.title"
          subtitleKey="platform.emailSettings.subtitle"
        />
        <Typography variant="body2" color="textSecondary" className={classes.hint}>
          {i18n.t("platform.emailSettings.usageHint")}
        </Typography>
        <Paper elevation={2} className={classes.card}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            {i18n.t("platform.emailSettings.sectionConnection")}
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
              label={i18n.t("platform.emailSettings.enabled")}
            />
            <TextField
              label={i18n.t("platform.emailSettings.host")}
              value={host}
              onChange={(e) => setHost(e.target.value)}
              variant="outlined"
              fullWidth
              required
            />
            <TextField
              label={i18n.t("platform.emailSettings.port")}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              variant="outlined"
              fullWidth
              type="number"
              required
              inputProps={{ min: 1, max: 65535 }}
            />
            <TextField
              label={i18n.t("platform.emailSettings.user")}
              value={user}
              onChange={(e) => setUser(e.target.value)}
              variant="outlined"
              fullWidth
            />
            <TextField
              label={i18n.t("platform.emailSettings.password")}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              variant="outlined"
              fullWidth
              type="password"
              autoComplete="new-password"
              placeholder={
                hasStoredPassword
                  ? i18n.t("platform.emailSettings.passwordPlaceholderKeep")
                  : i18n.t("platform.emailSettings.passwordPlaceholderEmpty")
              }
              helperText={i18n.t("platform.emailSettings.passwordHelp")}
            />
            {hasStoredPassword ? (
              <Button
                variant="outlined"
                disabled={saving}
                onClick={removeStoredPassword}
              >
                {i18n.t("platform.emailSettings.removePassword")}
              </Button>
            ) : null}
            <FormControlLabel
              control={
                <Switch
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                  color="primary"
                />
              }
              label={i18n.t("platform.emailSettings.secureSsl")}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={requireTls}
                  onChange={(e) => setRequireTls(e.target.checked)}
                  color="primary"
                />
              }
              label={i18n.t("platform.emailSettings.requireTls")}
            />
          </div>

          <Divider style={{ margin: "16px 0" }} />

          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            {i18n.t("platform.emailSettings.sectionSender")}
          </Typography>
          <div className={classes.fields}>
            <TextField
              label={i18n.t("platform.emailSettings.fromName")}
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              variant="outlined"
              fullWidth
            />
            <TextField
              label={i18n.t("platform.emailSettings.fromEmail")}
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              variant="outlined"
              fullWidth
              required
            />
            <TextField
              label={i18n.t("platform.emailSettings.replyTo")}
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              variant="outlined"
              fullWidth
            />
          </div>

          <AppPrimaryButton onClick={save} disabled={saving}>
            {i18n.t("platform.emailSettings.save")}
          </AppPrimaryButton>
        </Paper>

        <Paper elevation={1} className={classes.card}>
          <Typography variant="subtitle1" gutterBottom>
            {i18n.t("platform.emailSettings.testTitle")}
          </Typography>
          <Typography variant="body2" color="textSecondary" className={classes.hint}>
            {i18n.t("platform.emailSettings.testHint")}
          </Typography>
          <div className={classes.testRow}>
            <TextField
              label={i18n.t("platform.emailSettings.testToLabel")}
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              variant="outlined"
              fullWidth
            />
            <div className={classes.testActions}>
              <Button
                variant="contained"
                color="primary"
                disabled={testing}
                onClick={sendTest}
              >
                {i18n.t("platform.emailSettings.testSend")}
              </Button>
            </div>
          </div>
        </Paper>
      </Box>
    </MainContainer>
  );
}
