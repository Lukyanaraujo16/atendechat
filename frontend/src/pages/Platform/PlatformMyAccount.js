import React, { useContext, useEffect, useState } from "react";
import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import { makeStyles } from "@material-ui/core/styles";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { AppPageHeader, AppSectionCard, AppPrimaryButton } from "../../ui";
import { AuthContext } from "../../context/Auth/AuthContext";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  heading: { fontWeight: 600, fontSize: "1.0625rem", marginBottom: theme.spacing(2) },
}));

export default function PlatformMyAccount() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
    if (user?.email) setEmail(user.email);
  }, [user?.name, user?.email]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/platform/me", {
        name,
        email,
        ...(password.trim() ? { password: password.trim() } : {}),
      });
      toast.success(i18n.t("platform.myAccount.toastSaved"));
      setPassword("");
      try {
        await api.post("/auth/refresh_token");
      } catch {
        /* ignore */
      }
      window.location.reload();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  const title = (
    <>
      <Typography variant="overline" color="textSecondary" display="block" style={{ letterSpacing: "0.06em", marginBottom: 4 }}>
        {i18n.t("platform.shell.eyebrow")}
      </Typography>
      <Typography variant="h5" component="h1" color="primary" style={{ fontWeight: 600 }}>
        {i18n.t("platform.myAccount.title")}
      </Typography>
    </>
  );

  const subtitle = (
    <Typography variant="body2" color="textSecondary" component="p" style={{ margin: 0 }}>
      {i18n.t("platform.myAccount.subtitle")}
    </Typography>
  );

  return (
    <MainContainer>
      <Box display="flex" flexDirection="column" style={{ gap: 24 }}>
        <AppPageHeader title={title} subtitle={subtitle} />
        <AppSectionCard>
          <Typography className={classes.heading} component="h2">
            {i18n.t("platform.myAccount.formTitle")}
          </Typography>
          <Grid container spacing={2} style={{ maxWidth: 480 }}>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("platform.myAccount.fieldName")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                variant="outlined"
                margin="dense"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("platform.myAccount.fieldEmail")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                variant="outlined"
                margin="dense"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={i18n.t("platform.myAccount.fieldPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                variant="outlined"
                margin="dense"
                type="password"
                helperText={i18n.t("platform.myAccount.passwordHint")}
              />
            </Grid>
            <Grid item xs={12}>
              <AppPrimaryButton onClick={handleSave} loading={saving}>
                {i18n.t("platform.myAccount.save")}
              </AppPrimaryButton>
            </Grid>
          </Grid>
        </AppSectionCard>
      </Box>
    </MainContainer>
  );
}
