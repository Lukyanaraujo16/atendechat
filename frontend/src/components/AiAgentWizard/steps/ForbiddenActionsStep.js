import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Alert from "@material-ui/lab/Alert";
import { AI_AGENT_FORBIDDEN_ACTIONS } from "../../../config/aiAgentProfileOptions";
import { toggleArrayValue, normalizeForbiddenActions } from "../aiAgentWizardMappers";
import { isForbiddenActionLocked } from "../aiAgentWizardValidation";
import { i18n } from "../../../translate/i18n";

export default function ForbiddenActionsStep({ formState, onChange }) {
  const toggle = (value) => {
    if (isForbiddenActionLocked(value)) return;
    onChange({
      forbiddenActions: normalizeForbiddenActions(
        toggleArrayValue(formState.forbiddenActions, value)
      ),
    });
  };

  return (
    <Grid container spacing={1}>
      <Grid item xs={12}>
        <Alert severity="info">
          {i18n.t("aiAgent.wizard.hints.forbiddenActionsSecurity")}
        </Alert>
      </Grid>
      <Grid item xs={12}>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("aiAgent.wizard.hints.forbiddenActions")}
        </Typography>
      </Grid>
      {AI_AGENT_FORBIDDEN_ACTIONS.map((item) => {
        const locked = isForbiddenActionLocked(item.value);
        const checked = (formState.forbiddenActions || []).includes(item.value);
        return (
          <Grid item xs={12} sm={6} key={item.value}>
            <FormControlLabel
              control={
                <Checkbox
                  color="primary"
                  checked={checked}
                  disabled={locked}
                  onChange={() => toggle(item.value)}
                />
              }
              label={
                locked
                  ? `${item.label} (${i18n.t("aiAgent.wizard.labels.required")})`
                  : item.label
              }
            />
          </Grid>
        );
      })}
    </Grid>
  );
}
