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
    maxWidth: "100%",
    boxSizing: "border-box",
    minWidth: 0,
  },
  pageSmtpNarrow: {
    maxWidth: 640,
  },
  templatesRoot: {
    width: "100%",
    maxWidth: 1320,
    alignSelf: "stretch",
    boxSizing: "border-box",
    minWidth: 0,
  },
  hint: {
    fontSize: "0.8125rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.55,
    maxWidth: "100%",
    overflowWrap: "break-word",
    wordBreak: "break-word",
  },
  tabPanel: {
    marginTop: theme.spacing(1),
    minWidth: 0,
    maxWidth: "100%",
  },
  smtpCard: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxSizing: "border-box",
    maxWidth: "100%",
  },
  templateCard: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  gridCol: {
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
    minWidth: 0,
    maxWidth: "100%",
  },
  fieldFull: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  multilineInput: {
    width: "100% !important",
    maxWidth: "100% !important",
    boxSizing: "border-box !important",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    resize: "vertical",
  },
  /** Evita label outlined a sobrepor a 1.ª linha em TextField multilinha (MUI v4). */
  multilineOutlinedRoot: {
    alignItems: "flex-start",
    maxWidth: "100%",
  },
  testRow: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1),
    minWidth: 0,
  },
  testActions: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    alignItems: "stretch",
    "& > *": {
      width: "100%",
    },
  },
  templateFooter: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  infoBox: {
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(1.25),
    borderRadius: 8,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(36, 199, 118, 0.12)"
        : "rgba(36, 199, 118, 0.08)",
    border: `1px solid ${theme.palette.divider}`,
    maxWidth: "100%",
  },
  sampleBox: {
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: 8,
    backgroundColor:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : theme.palette.grey[50],
    border: `1px solid ${theme.palette.divider}`,
    maxWidth: "100%",
    overflow: "hidden",
  },
  sampleLine: {
    fontSize: "0.75rem",
    fontFamily: "ui-monospace, monospace",
    lineHeight: 1.5,
    color: theme.palette.text.secondary,
    overflowWrap: "break-word",
    wordBreak: "break-word",
    marginBottom: theme.spacing(0.5),
  },
  varPill: {
    display: "block",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: theme.spacing(1, 1.25),
    marginBottom: theme.spacing(1),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    cursor: "pointer",
    textAlign: "left",
    font: "inherit",
    color: "inherit",
    backgroundColor: theme.palette.background.paper,
    appearance: "none",
    WebkitAppearance: "none",
    transition: theme.transitions.create(["background-color", "border-color"], {
      duration: theme.transitions.duration.shortest,
    }),
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.06)"
          : theme.palette.action.hover,
      borderColor: theme.palette.primary.main,
    },
  },
  varToken: {
    fontFamily: "ui-monospace, monospace",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: theme.palette.primary.main,
    wordBreak: "break-all",
    display: "block",
    marginBottom: 4,
  },
  varDesc: {
    fontSize: "0.75rem",
    lineHeight: 1.35,
    color: theme.palette.text.secondary,
    overflowWrap: "break-word",
    wordBreak: "break-word",
    display: "block",
  },
}));

const templateLabelProps = { shrink: true };

const multilineFieldProps = (classes) => ({
  fullWidth: true,
  variant: "outlined",
  multiline: true,
  minRows: 10,
  InputLabelProps: templateLabelProps,
  InputProps: {
    classes: {
      root: classes.multilineOutlinedRoot,
      input: classes.multilineInput,
    },
  },
});

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

  const reloadTemplatesOnly = useCallback(async () => {
    try {
      const { data } = await api.get("/system-settings/email-templates");
      const t = data || {};
      setSupportEmail(String(t.supportEmail || ""));
      setLoginUrl(String(t.loginUrl || ""));
      setWelcomeSubject(String(t.welcomeSubject || ""));
      setWelcomeBody(String(t.welcomeBody || ""));
      setPasswordResetSubject(String(t.passwordResetSubject || ""));
      setPasswordResetBody(String(t.passwordResetBody || ""));
    } catch (e) {
      toastError(e);
    }
  }, []);

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

  const cancelTemplateEdits = async () => {
    await reloadTemplatesOnly();
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

  const mProps = multilineFieldProps(classes);

  if (loading) {
    return (
      <MainContainer>
        <AppLoadingState />
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <Box
        className={`${classes.page} ${tab === 0 ? classes.pageSmtpNarrow : ""}`.trim()}
      >
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
            <Paper elevation={2} className={classes.smtpCard}>
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
                  className={classes.fieldFull}
                />
                <TextField
                  label={i18n.t("platform.emailSettings.port")}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  variant="outlined"
                  fullWidth
                  type="number"
                  required
                  className={classes.fieldFull}
                  inputProps={{ min: 1, max: 65535 }}
                />
                <TextField
                  label={i18n.t("platform.emailSettings.user")}
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  variant="outlined"
                  fullWidth
                  className={classes.fieldFull}
                />
                <TextField
                  label={i18n.t("platform.emailSettings.password")}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  variant="outlined"
                  fullWidth
                  className={classes.fieldFull}
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
                  className={classes.fieldFull}
                />
                <TextField
                  label={i18n.t("platform.emailSettings.fromEmail")}
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  variant="outlined"
                  fullWidth
                  required
                  className={classes.fieldFull}
                />
                <TextField
                  label={i18n.t("platform.emailSettings.replyTo")}
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  variant="outlined"
                  fullWidth
                  className={classes.fieldFull}
                />
              </div>

              <AppPrimaryButton onClick={saveSmtp} disabled={saving} style={{ marginTop: 16 }}>
                {i18n.t("platform.emailSettings.save")}
              </AppPrimaryButton>
            </Paper>

            <Paper elevation={1} className={classes.smtpCard} style={{ marginTop: 16 }}>
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
                  className={classes.fieldFull}
                />
                <Button
                  variant="contained"
                  color="primary"
                  disabled={testing}
                  onClick={sendSmtpTest}
                >
                  {i18n.t("platform.emailSettings.testSend")}
                </Button>
              </div>
            </Paper>
          </div>
        )}

        {tab === 1 && (
          <Box className={classes.templatesRoot}>
            <div className={classes.tabPanel}>
              <Typography variant="body2" color="textSecondary" className={classes.hint}>
                {i18n.t("platform.emailSettings.templates.usageHint")}
              </Typography>

              <Grid container spacing={2} className={classes.gridCol}>
                <Grid item xs={12} md={3} zeroMinWidth className={classes.gridCol}>
                  <Paper elevation={2} className={classes.templateCard}>
                    <Typography variant="subtitle1" gutterBottom>
                      {i18n.t("platform.emailSettings.templates.tagsTitle")}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block">
                      {i18n.t("platform.emailSettings.templates.tagsIntro")}
                    </Typography>
                    <Box mt={1.5}>
                      {EMAIL_TAG_KEYS.map((k) => (
                        <Box
                          key={k}
                          component="button"
                          type="button"
                          className={classes.varPill}
                          onClick={() => copyTag(k)}
                        >
                          <span className={classes.varToken}>{`{{${k}}}`}</span>
                          <span className={classes.varDesc}>
                            {i18n.t(`platform.emailSettings.templates.tags.${k}`)}
                          </span>
                        </Box>
                      ))}
                    </Box>
                    <Box className={classes.infoBox}>
                      <Typography variant="caption" color="textSecondary" display="block">
                        {i18n.t("platform.emailSettings.templates.tagsEmptyHint")}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6} zeroMinWidth className={classes.gridCol}>
                  <Paper elevation={2} className={classes.templateCard}>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      {i18n.t("platform.emailSettings.templates.sectionGlobal")}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} zeroMinWidth className={classes.gridCol}>
                        <TextField
                          label={i18n.t("platform.emailSettings.templates.supportEmail")}
                          value={supportEmail}
                          onChange={(e) => setSupportEmail(e.target.value)}
                          variant="outlined"
                          fullWidth
                          className={classes.fieldFull}
                          InputLabelProps={templateLabelProps}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} zeroMinWidth className={classes.gridCol}>
                        <TextField
                          label={i18n.t("platform.emailSettings.templates.loginUrl")}
                          value={loginUrl}
                          onChange={(e) => setLoginUrl(e.target.value)}
                          variant="outlined"
                          fullWidth
                          className={classes.fieldFull}
                          placeholder="https://"
                          InputLabelProps={templateLabelProps}
                          helperText={i18n.t(
                            "platform.emailSettings.templates.loginUrlHint"
                          )}
                        />
                      </Grid>
                    </Grid>

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
                        className={classes.fieldFull}
                        InputLabelProps={templateLabelProps}
                      />
                      <TextField
                        label={i18n.t("platform.emailSettings.templates.body")}
                        value={welcomeBody}
                        onChange={(e) => setWelcomeBody(e.target.value)}
                        helperText={i18n.t(
                          "platform.emailSettings.templates.bodyHelper"
                        )}
                        className={classes.fieldFull}
                        {...mProps}
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
                        className={classes.fieldFull}
                        InputLabelProps={templateLabelProps}
                      />
                      <TextField
                        label={i18n.t("platform.emailSettings.templates.body")}
                        value={passwordResetBody}
                        onChange={(e) => setPasswordResetBody(e.target.value)}
                        helperText={i18n.t(
                          "platform.emailSettings.templates.bodyHelper"
                        )}
                        className={classes.fieldFull}
                        {...mProps}
                      />
                    </div>

                    <Box className={classes.templateFooter}>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        style={{ flex: "1 1 200px", marginRight: 8 }}
                      >
                        {i18n.t("platform.emailSettings.templates.footerHint")}
                      </Typography>
                      <Button
                        variant="outlined"
                        disabled={savingTemplates}
                        onClick={cancelTemplateEdits}
                      >
                        {i18n.t("platform.emailSettings.templates.cancelEdit")}
                      </Button>
                      <AppPrimaryButton onClick={saveTemplates} disabled={savingTemplates}>
                        {i18n.t("platform.emailSettings.templates.save")}
                      </AppPrimaryButton>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={3} zeroMinWidth className={classes.gridCol}>
                  <Paper elevation={2} className={classes.templateCard} style={{ marginBottom: 16 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {i18n.t("platform.emailSettings.templates.actionsCard")}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block" paragraph>
                      {i18n.t("platform.emailSettings.templates.testsExplainer")}
                    </Typography>
                    <div className={classes.testRow}>
                      <TextField
                        label={i18n.t("platform.emailSettings.templates.testToLabel")}
                        value={templateTestTo}
                        onChange={(e) => setTemplateTestTo(e.target.value)}
                        variant="outlined"
                        fullWidth
                        className={classes.fieldFull}
                        InputLabelProps={templateLabelProps}
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
                        <Button
                          variant="outlined"
                          color="secondary"
                          disabled={savingTemplates}
                          onClick={persistRestoreDefaults}
                        >
                          {i18n.t("platform.emailSettings.templates.restore")}
                        </Button>
                      </div>
                    </div>
                  </Paper>

                  <Paper elevation={1} className={classes.templateCard}>
                    <Typography variant="subtitle2" gutterBottom>
                      {i18n.t("platform.emailSettings.templates.sampleDataTitle")}
                    </Typography>
                    <Box className={classes.sampleBox}>
                      <Typography className={classes.sampleLine} component="div">
                        {i18n.t("platform.emailSettings.templates.sampleLineName")}
                      </Typography>
                      <Typography className={classes.sampleLine} component="div">
                        {i18n.t("platform.emailSettings.templates.sampleLineCompany")}
                      </Typography>
                      <Typography className={classes.sampleLine} component="div">
                        {i18n.t("platform.emailSettings.templates.sampleLineEmail")}
                      </Typography>
                      <Typography className={classes.sampleLine} component="div">
                        {i18n.t("platform.emailSettings.templates.sampleLinePassword")}
                      </Typography>
                      <Typography className={classes.sampleLine} component="div">
                        {i18n.t("platform.emailSettings.templates.sampleLineLoginUrl")}
                      </Typography>
                      <Typography className={classes.sampleLine} component="div">
                        {i18n.t("platform.emailSettings.templates.sampleLineReset")}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </div>
          </Box>
        )}
      </Box>
    </MainContainer>
  );
}
