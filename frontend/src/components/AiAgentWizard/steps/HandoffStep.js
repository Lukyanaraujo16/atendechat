import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Alert from "@material-ui/lab/Alert";
import { AI_AGENT_HANDOFF_RULES } from "../../../config/aiAgentProfileOptions";
import {
  normalizeHandoffRules,
  toggleArrayValue,
} from "../aiAgentWizardMappers";
import { isHandoffRuleLocked } from "../aiAgentWizardValidation";
import { i18n } from "../../../translate/i18n";

export default function HandoffStep({ formState, onChange, errors = {} }) {
  const toggle = (value) => {
    if (isHandoffRuleLocked(value)) return;
    onChange({
      handoffRules: normalizeHandoffRules(
        toggleArrayValue(formState.handoffRules, value)
      ),
    });
  };

  const hasCustom = (formState.handoffRules || []).includes("custom");

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Alert severity="info">
          {i18n.t("aiAgent.wizard.hints.handoff")}
        </Alert>
      </Grid>
      {AI_AGENT_HANDOFF_RULES.map((item) => {
        const locked = isHandoffRuleLocked(item.value);
        const checked = (formState.handoffRules || []).includes(item.value);
        return (
          <Grid item xs={12} sm={6} key={item.value}>
            <FormControlLabel
              control={
                <Checkbox
                  color="primary"
                  checked={checked || locked}
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
      {hasCustom ? (
        <Grid item xs={12}>
          <TextField
            fullWidth
            required
            multiline
            minRows={2}
            label={i18n.t("aiAgent.wizard.fields.handoffCustomText")}
            value={formState.handoffCustomText}
            onChange={(event) => onChange({ handoffCustomText: event.target.value })}
            error={Boolean(errors.handoffCustomText)}
            helperText={
              errors.handoffCustomText
                ? i18n.t(`aiAgent.wizard.errors.${errors.handoffCustomText}`)
                : ""
            }
          />
        </Grid>
      ) : null}
      <Grid item xs={12}>
        <Typography variant="caption" color="textSecondary">
          {i18n.t("aiAgent.wizard.hints.handoffFooter")}
        </Typography>
      </Grid>
    </Grid>
  );
}
