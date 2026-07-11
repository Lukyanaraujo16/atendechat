import React from "react";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import {
  AI_AGENT_TONES,
  AI_AGENT_CLIENT_ADDRESS_STYLES,
  AI_AGENT_EMOJI_LEVELS,
  AI_AGENT_RESPONSE_LENGTHS,
} from "../../../config/aiAgentProfileOptions";
import SelectableOptionCard from "../SelectableOptionCard";
import { i18n } from "../../../translate/i18n";

const TONE_HINTS = {
  formal: "aiAgent.wizard.hints.toneFormal",
  professional: "aiAgent.wizard.hints.toneProfessional",
  friendly: "aiAgent.wizard.hints.toneFriendly",
  casual: "aiAgent.wizard.hints.toneCasual",
};

export default function PersonalityStep({ formState, onChange, errors = {} }) {
  const handleField = (field) => (event) => {
    onChange({ [field]: event.target.value });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Grid container spacing={1}>
          {AI_AGENT_TONES.map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.value}>
              <SelectableOptionCard
                title={item.label}
                description={
                  TONE_HINTS[item.value] ? i18n.t(TONE_HINTS[item.value]) : undefined
                }
                selected={formState.tone === item.value}
                onClick={() =>
                  onChange({
                    tone: item.value,
                    customTone: item.value === "custom" ? formState.customTone : "",
                  })
                }
              />
            </Grid>
          ))}
        </Grid>
        {errors.tone ? (
          <Grid item xs={12}>
            <span style={{ color: "#f44336", fontSize: "0.75rem" }}>
              {i18n.t(`aiAgent.wizard.errors.${errors.tone}`)}
            </span>
          </Grid>
        ) : null}
      </Grid>

      {formState.tone === "custom" ? (
        <Grid item xs={12}>
          <TextField
            fullWidth
            required
            multiline
            minRows={2}
            label={i18n.t("aiAgent.wizard.fields.customTone")}
            value={formState.customTone}
            onChange={handleField("customTone")}
            error={Boolean(errors.customTone)}
            helperText={
              errors.customTone
                ? i18n.t(`aiAgent.wizard.errors.${errors.customTone}`)
                : ""
            }
          />
        </Grid>
      ) : null}

      <Grid item xs={12}>
        <TextField
          select
          fullWidth
          label={i18n.t("aiAgent.wizard.fields.clientAddressStyle")}
          value={formState.clientAddressStyle}
          onChange={handleField("clientAddressStyle")}
          SelectProps={{ native: true }}
        >
          {AI_AGENT_CLIENT_ADDRESS_STYLES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </TextField>
      </Grid>

      <Grid item xs={12} md={6}>
        <Grid container spacing={1}>
          {AI_AGENT_EMOJI_LEVELS.map((item) => (
            <Grid item xs={12} sm={6} key={item.value}>
              <SelectableOptionCard
                title={item.label}
                selected={formState.emojiLevel === item.value}
                onClick={() => onChange({ emojiLevel: item.value })}
              />
            </Grid>
          ))}
        </Grid>
      </Grid>

      <Grid item xs={12} md={6}>
        <Grid container spacing={1}>
          {AI_AGENT_RESPONSE_LENGTHS.map((item) => (
            <Grid item xs={12} sm={6} key={item.value}>
              <SelectableOptionCard
                title={item.label}
                selected={formState.responseLength === item.value}
                onClick={() => onChange({ responseLength: item.value })}
              />
            </Grid>
          ))}
        </Grid>
      </Grid>
    </Grid>
  );
}
