import React from "react";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Alert from "@material-ui/lab/Alert";
import { i18n } from "../../../translate/i18n";

export default function ActiveAgentIdentityStep({
  formState,
  onChange,
  errors = {},
}) {
  const handleField = (field) => (event) => {
    onChange({ [field]: event.target.value });
  };

  return (
    <Grid
      container
      spacing={2}
      data-testid="active-agent-identity-step"
    >
      <Grid item xs={12}>
        <Alert severity="warning">
          {i18n.t("aiAgent.wizard.activeIdentity.notice")}
        </Alert>
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          required
          variant="outlined"
          label={i18n.t("aiAgent.wizard.activeIdentity.name")}
          value={formState.identityName || ""}
          onChange={handleField("identityName")}
          inputProps={{ maxLength: 120 }}
          error={Boolean(errors.identityName)}
          helperText={
            errors.identityName
              ? i18n.t(`aiAgent.wizard.errors.${errors.identityName}`)
              : ""
          }
          data-testid="active-identity-name"
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          variant="outlined"
          label={i18n.t("aiAgent.wizard.activeIdentity.description")}
          value={formState.identityDescription || ""}
          onChange={handleField("identityDescription")}
          data-testid="active-identity-description"
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          variant="outlined"
          label={i18n.t("aiAgent.wizard.fields.fallbackMessage")}
          value={formState.fallbackMessage || ""}
          onChange={handleField("fallbackMessage")}
          data-testid="active-identity-fallback"
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          variant="outlined"
          label={i18n.t("aiAgent.wizard.fields.handoffMessage")}
          value={formState.handoffMessage || ""}
          onChange={handleField("handoffMessage")}
          data-testid="active-identity-handoff"
        />
      </Grid>
    </Grid>
  );
}
