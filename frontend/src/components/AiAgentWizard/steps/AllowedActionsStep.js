import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import { AI_AGENT_ALLOWED_ACTIONS } from "../../../config/aiAgentProfileOptions";
import { toggleArrayValue } from "../aiAgentWizardMappers";
import { i18n } from "../../../translate/i18n";

export default function AllowedActionsStep({ formState, onChange }) {
  const toggle = (value) => {
    onChange({ allowedActions: toggleArrayValue(formState.allowedActions, value) });
  };

  return (
    <Grid container spacing={1}>
      <Grid item xs={12}>
        <Typography variant="body2" color="textSecondary" paragraph>
          {i18n.t("aiAgent.wizard.hints.allowedActions")}
        </Typography>
      </Grid>
      {AI_AGENT_ALLOWED_ACTIONS.map((item) => (
        <Grid item xs={12} sm={6} key={item.value}>
          <FormControlLabel
            control={
              <Checkbox
                color="primary"
                checked={(formState.allowedActions || []).includes(item.value)}
                onChange={() => toggle(item.value)}
              />
            }
            label={item.label}
          />
        </Grid>
      ))}
    </Grid>
  );
}
