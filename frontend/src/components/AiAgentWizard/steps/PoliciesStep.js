import React from "react";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import {
  PRICING_POLICY_PRESETS,
  NEGOTIATION_POLICY_PRESETS,
  SCHEDULING_POLICY_PRESETS,
} from "../aiAgentWizardDefaults";
import { i18n } from "../../../translate/i18n";

const pricingOptions = [
  { value: "registered_only", labelKey: "aiAgent.wizard.policies.pricing.registeredOnly" },
  { value: "no_prices", labelKey: "aiAgent.wizard.policies.pricing.noPrices" },
  { value: "custom", labelKey: "aiAgent.wizard.policies.custom" },
];

const negotiationOptions = [
  { value: "handoff", labelKey: "aiAgent.wizard.policies.negotiation.handoff" },
  { value: "collect_only", labelKey: "aiAgent.wizard.policies.negotiation.collectOnly" },
  { value: "custom", labelKey: "aiAgent.wizard.policies.custom" },
];

const schedulingOptions = [
  {
    value: "collect_preference",
    labelKey: "aiAgent.wizard.policies.scheduling.collectPreference",
  },
  { value: "no_scheduling", labelKey: "aiAgent.wizard.policies.scheduling.noScheduling" },
  { value: "custom", labelKey: "aiAgent.wizard.policies.custom" },
];

export default function PoliciesStep({ formState, onChange, errors = {} }) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          select
          fullWidth
          label={i18n.t("aiAgent.wizard.fields.pricingPolicy")}
          value={formState.pricingPolicyPreset}
          onChange={(event) => onChange({ pricingPolicyPreset: event.target.value })}
        >
          {pricingOptions.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {i18n.t(item.labelKey)}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      {formState.pricingPolicyPreset === "custom" ? (
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={i18n.t("aiAgent.wizard.fields.pricingPolicyCustom")}
            value={formState.pricingPolicyCustom}
            onChange={(event) => onChange({ pricingPolicyCustom: event.target.value })}
            error={Boolean(errors.pricingPolicyCustom)}
            helperText={
              errors.pricingPolicyCustom
                ? i18n.t(`aiAgent.wizard.errors.${errors.pricingPolicyCustom}`)
                : PRICING_POLICY_PRESETS.custom
            }
          />
        </Grid>
      ) : null}

      <Grid item xs={12}>
        <TextField
          select
          fullWidth
          label={i18n.t("aiAgent.wizard.fields.negotiationPolicy")}
          value={formState.negotiationPolicyPreset}
          onChange={(event) => onChange({ negotiationPolicyPreset: event.target.value })}
        >
          {negotiationOptions.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {i18n.t(item.labelKey)}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      {formState.negotiationPolicyPreset === "custom" ? (
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={i18n.t("aiAgent.wizard.fields.negotiationPolicyCustom")}
            value={formState.negotiationPolicyCustom}
            onChange={(event) => onChange({ negotiationPolicyCustom: event.target.value })}
            error={Boolean(errors.negotiationPolicyCustom)}
            helperText={
              errors.negotiationPolicyCustom
                ? i18n.t(`aiAgent.wizard.errors.${errors.negotiationPolicyCustom}`)
                : ""
            }
          />
        </Grid>
      ) : null}

      <Grid item xs={12}>
        <TextField
          select
          fullWidth
          label={i18n.t("aiAgent.wizard.fields.schedulingPolicy")}
          value={formState.schedulingPolicyPreset}
          onChange={(event) => onChange({ schedulingPolicyPreset: event.target.value })}
        >
          {schedulingOptions.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {i18n.t(item.labelKey)}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      {formState.schedulingPolicyPreset === "custom" ? (
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={i18n.t("aiAgent.wizard.fields.schedulingPolicyCustom")}
            value={formState.schedulingPolicyCustom}
            onChange={(event) => onChange({ schedulingPolicyCustom: event.target.value })}
            error={Boolean(errors.schedulingPolicyCustom)}
            helperText={
              errors.schedulingPolicyCustom
                ? i18n.t(`aiAgent.wizard.errors.${errors.schedulingPolicyCustom}`)
                : ""
            }
          />
        </Grid>
      ) : null}
    </Grid>
  );
}
