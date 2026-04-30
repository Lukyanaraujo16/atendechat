import React, { useCallback, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import Button from "@material-ui/core/Button";
import Divider from "@material-ui/core/Divider";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Chip from "@material-ui/core/Chip";
import Grid from "@material-ui/core/Grid";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import PlatformPageHeader from "./PlatformPageHeader";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AppPrimaryButton, AppLoadingState } from "../../ui";

const EMAIL_TAG_KEYS = [
  "companyName",
  "userName",
  "userEmail",
  "temporaryPassword",
  "resetLink",
  "loginUrl",
  "systemName",
  "supportEmail",
];

const useStyles = makeStyles((theme) => ({
  page: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    width: "100%",
    maxWidth: 980,
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
  tagChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(0.5),
  },
  tabPanel: {
    marginTop: theme.spacing(1),
  },
  templateActions: {
    marginTop: theme.spacing(2),
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
}));

export default function PlatformEmailSettings() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingKind, setTestingKind] = useState(null);

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

  const [supportEmail, setSupportEmail] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [welcomeSubject, setWelcomeSubject] = useState("");
  const [welcomeBody, setWelcomeBody] = useState("");
  const [passwordResetSubject, setPasswordResetSubject] = useState("");
  const [passwordResetBody, setPasswordResetBody] = useState("");
  const [templateTestTo, setTemplateTestTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [smtpRes, tplRes] = await Promise.all([
        api.get("/system-settings/smtp"),
        api.get("/system-settings/email-templates"),
      ]);
      const s = smtpRes.data || {};
      setEnabled(Boolean(s.enabled));
      setHost(String(s.host || ""));
      setPort(String(s.port ?? 587));
      setUser(String(s.user || ""));
      setHasStoredPassword(Boolean(s.hasPassword));
      setPasswordInput("");
      setFromName(String(s.fromName || ""));
      setFromEmail(String(s.fromEmail || ""));
      setSecure(Boolean(s.secure));
      setRequireTls(s.requireTls !== false);
      setReplyTo(String(s.replyTo || ""));

      const t = tplRes.data || {};
      setSupportEmail(String(t.supportEmail || ""));
      setLoginUrl(String(t.loginUrl || ""));
      setWelcomeSubject(String(t.welcomeSubject || ""));
      setWelcomeBody(String(t.welcomeBody || ""));
      setPasswordResetSubject(String(t.passwordResetSubject || ""));
      setPasswordResetBody(String(t.passwordResetBody || ""));
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buildSmtpPayload = (extra = {}) => {
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

  const saveSmtp = async () => {
    if (!fromEmail.trim()) {
      toast.error(i18n.t("platform.emailSettings.validation.fromEmail"));
      return;
    }
    setSaving(true);
    try {
      const payload = buildSmtpPayload();
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
        ...buildSmtpPayload(),
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

  const sendSmtpTest = async () => {
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

  const saveTemplates = async () => {
    setSavingTemplates(true);
    try {
      await api.put("/system-settings/email-templates", {
        supportEmail: supportEmail.trim().toLowerCase(),
        loginUrl: loginUrl.trim(),
        welcomeSubject,
        welcomeBody,
        passwordResetSubject,
        passwordResetBody,
      });
      toast.success(i18n.t("platform.emailSettings.templates.saved"));
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSavingTemplates(false);
    }
  };

  const persistRestoreDefaults = async () => {
    setSavingTemplates(true);
    try {
      await api.put("/system-settings/email-templates", {
        supportEmail: "",
        loginUrl: "",
        welcomeSubject: "",
        welcomeBody: "",
        passwordResetSubject: "",
        passwordResetBody: "",
      });
      toast.success(i18n.t("platform.emailSettings.templates.restored"));
      await load();
    } catch (e) {
      toastError(e);
    } finally {
      setSavingTemplates(false);
    }
  };

  const sendTemplateTest = async (kind) => {
    const to = templateTestTo.trim().toLowerCase();
    if (!to) {
      toast.error(i18n.t("platform.emailSettings.validation.testTo"));
      return;
    }
    setTestingKind(kind);
    try {
      await api.post("/system-settings/email-templates/test", { to, kind });
      toast.success(i18n.t("platform.emailSettings.templates.testSent"));
    } catch (e) {
      const msg = e?.response?.data?.message;
      if (msg && typeof msg === "string" && msg.trim()) {
        toast.error(msg.trim());
      } else {
        toastError(e);
      }
    } finally {
      setTestingKind(null);
    }
  };

  const copyTag = (key) => {
    const token = `{{${key}}}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(token).then(
        () => {
          toast.success(
            i18n.t("platform.emailSettings.templates.tagCopy").replace("{{tag}}", token)
          );
        },
        () => toast.error(i18n.t("errors.operationFailed"))
      );
    } else {
      toast.error(i18n.t("errors.operationFailed"));
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

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label={i18n.t("platform.emailSettings.tabSmtp")} />
          <Tab label={i18n.t("platform.emailSettings.tabTemplates")} />
        </Tabs>

        {tab === 0 && (
          <div className={classes.tabPanel}>
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

              <AppPrimaryButton onClick={saveSmtp} disabled={saving}>
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
                    onClick={sendSmtpTest}
                  >
                    {i18n.t("platform.emailSettings.testSend")}
                  </Button>
                </div>
              </div>
            </Paper>
          </div>
        )}

        {tab === 1 && (
          <div className={classes.tabPanel}>
            <Typography variant="body2" color="textSecondary" className={classes.hint}>
              {i18n.t("platform.emailSettings.templates.usageHint")}
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Paper elevation={1} className={classes.card}>
                  <Typography variant="subtitle2" gutterBottom>
                    {i18n.t("platform.emailSettings.templates.tagsTitle")}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block">
                    {i18n.t("platform.emailSettings.templates.tagsIntro")}
                  </Typography>
                  <div className={classes.tagChips}>
                    {EMAIL_TAG_KEYS.map((k) => (
                      <Chip
                        key={k}
                        size="small"
                        label={`{{${k}}} — ${i18n.t(
                          `platform.emailSettings.templates.tags.${k}`
                        )}`}
                        onClick={() => copyTag(k)}
                        variant="outlined"
                        color="primary"
                      />
                    ))}
                  </div>
                </Paper>
              </Grid>

              <Grid item xs={12} md={8}>
                <Paper elevation={2} className={classes.card}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    {i18n.t("platform.emailSettings.templates.sectionGlobal")}
                  </Typography>
                  <div className={classes.fields}>
                    <TextField
                      label={i18n.t("platform.emailSettings.templates.supportEmail")}
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      variant="outlined"
                      fullWidth
                    />
                    <TextField
                      label={i18n.t("platform.emailSettings.templates.loginUrl")}
                      value={loginUrl}
                      onChange={(e) => setLoginUrl(e.target.value)}
                      variant="outlined"
                      fullWidth
                      placeholder="https://"
                      helperText={i18n.t("platform.emailSettings.templates.loginUrlHint")}
                    />
                  </div>

                  <Divider style={{ margin: "20px 0" }} />

                  <Typography variant="subtitle1" gutterBottom>
                    {i18n.t("platform.emailSettings.templates.welcomeCard")}
                  </Typography>
                  <div className={classes.fields}>
                    <TextField
                      label={i18n.t("platform.emailSettings.templates.subject")}
                      value={welcomeSubject}
                      onChange={(e) => setWelcomeSubject(e.target.value)}
                      variant="outlined"
                      fullWidth
                    />
                    <TextField
                      label={i18n.t("platform.emailSettings.templates.body")}
                      value={welcomeBody}
                      onChange={(e) => setWelcomeBody(e.target.value)}
                      variant="outlined"
                      fullWidth
                      multiline
                      minRows={12}
                      helperText={i18n.t("platform.emailSettings.templates.bodyHelper")}
                    />
                  </div>

                  <Divider style={{ margin: "20px 0" }} />

                  <Typography variant="subtitle1" gutterBottom>
                    {i18n.t("platform.emailSettings.templates.resetCard")}
                  </Typography>
                  <div className={classes.fields}>
                    <TextField
                      label={i18n.t("platform.emailSettings.templates.subject")}
                      value={passwordResetSubject}
                      onChange={(e) => setPasswordResetSubject(e.target.value)}
                      variant="outlined"
                      fullWidth
                    />
                    <TextField
                      label={i18n.t("platform.emailSettings.templates.body")}
                      value={passwordResetBody}
                      onChange={(e) => setPasswordResetBody(e.target.value)}
                      variant="outlined"
                      fullWidth
                      multiline
                      minRows={10}
                      helperText={i18n.t("platform.emailSettings.templates.bodyHelper")}
                    />
                  </div>

                  <div className={classes.templateActions}>
                    <AppPrimaryButton onClick={saveTemplates} disabled={savingTemplates}>
                      {i18n.t("platform.emailSettings.templates.save")}
                    </AppPrimaryButton>
                    <Button
                      variant="outlined"
                      color="secondary"
                      disabled={savingTemplates}
                      onClick={persistRestoreDefaults}
                    >
                      {i18n.t("platform.emailSettings.templates.restore")}
                    </Button>
                  </div>
                </Paper>

                <Paper elevation={1} className={classes.card} style={{ marginTop: 16 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    {i18n.t("platform.emailSettings.testTitle")}
                  </Typography>
                  <div className={classes.testRow}>
                    <TextField
                      label={i18n.t("platform.emailSettings.templates.testToLabel")}
                      value={templateTestTo}
                      onChange={(e) => setTemplateTestTo(e.target.value)}
                      variant="outlined"
                      fullWidth
                    />
                    <div className={classes.testActions}>
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={testingKind !== null}
                        onClick={() => sendTemplateTest("welcome")}
                      >
                        {i18n.t("platform.emailSettings.templates.testWelcome")}
                      </Button>
                      <Button
                        variant="contained"
                        color="default"
                        disabled={testingKind !== null}
                        onClick={() => sendTemplateTest("passwordReset")}
                      >
                        {i18n.t("platform.emailSettings.templates.testReset")}
                      </Button>
                    </div>
                  </div>
                </Paper>
              </Grid>
            </Grid>
          </div>
        )}
      </Box>
    </MainContainer>
  );
}
