import React from "react";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import { AI_AGENT_DEPARTMENTS } from "../../../config/aiAgentProfileOptions";
import {
  ATTENDANT_NAME_SUGGESTIONS,
  pickRandomAttendantName,
  suggestAttendantRole,
} from "../aiAgentWizardDefaults";
import { toggleArrayValue } from "../aiAgentWizardMappers";
import { i18n } from "../../../translate/i18n";

export default function AttendantStep({ formState, onChange, errors = {} }) {
  const handleField = (field) => (event) => {
    onChange({ [field]: event.target.value });
  };

  const toggleDepartment = (value) => {
    const departments = toggleArrayValue(formState.departments, value);
    onChange({
      departments,
      attendantRole: formState.attendantRole || suggestAttendantRole(departments),
    });
  };

  const handleSuggestName = () => {
    onChange({ attendantName: pickRandomAttendantName() });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={8}>
        <TextField
          fullWidth
          required
          label={i18n.t("aiAgent.wizard.fields.attendantName")}
          value={formState.attendantName}
          onChange={handleField("attendantName")}
          error={Boolean(errors.attendantName)}
          helperText={
            errors.attendantName
              ? i18n.t(`aiAgent.wizard.errors.${errors.attendantName}`)
              : i18n.t("aiAgent.wizard.hints.attendantName")
          }
        />
      </Grid>
      <Grid item xs={12} sm={4}>
        <Box display="flex" flexWrap="wrap" gridGap={8} mt={1}>
          {ATTENDANT_NAME_SUGGESTIONS.map((name) => (
            <Chip
              key={name}
              label={name}
              clickable
              color={formState.attendantName === name ? "primary" : "default"}
              onClick={() => onChange({ attendantName: name })}
            />
          ))}
          <Button size="small" onClick={handleSuggestName}>
            {i18n.t("aiAgent.wizard.buttons.suggestName")}
          </Button>
        </Box>
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          label={i18n.t("aiAgent.wizard.fields.attendantRole")}
          value={formState.attendantRole}
          onChange={handleField("attendantRole")}
        />
      </Grid>

      <Grid item xs={12}>
        <Box display="flex" flexWrap="wrap" gridGap={8}>
          {AI_AGENT_DEPARTMENTS.map((item) => {
            const selected = (formState.departments || []).includes(item.value);
            return (
              <Chip
                key={item.value}
                label={item.label}
                clickable
                color={selected ? "primary" : "default"}
                onClick={() => toggleDepartment(item.value)}
              />
            );
          })}
        </Box>
        {errors.departments ? (
          <Box mt={1} color="error.main" fontSize="0.75rem">
            {i18n.t(`aiAgent.wizard.errors.${errors.departments}`)}
          </Box>
        ) : null}
      </Grid>
    </Grid>
  );
}
