import React from "react";
import Grid from "@material-ui/core/Grid";
import TextField from "@material-ui/core/TextField";
import { AI_AGENT_BUSINESS_SEGMENTS } from "../../../config/aiAgentProfileOptions";
import SelectableOptionCard from "../SelectableOptionCard";
import SegmentRecommendationsPanel from "../SegmentRecommendationsPanel";
import { i18n } from "../../../translate/i18n";

export default function CompanyStep({
  formState,
  onChange,
  errors = {},
  onSegmentSelect,
  segmentChanged = false,
  onDismissSegmentChange,
  onApplyRecommendations,
}) {
  const handleField = (field) => (event) => {
    onChange({ [field]: event.target.value });
  };

  const handleSegment = (value) => {
    if (onSegmentSelect) {
      onSegmentSelect(value, formState.businessSegment);
    }
    onChange({
      businessSegment: value,
      customBusinessSegment: value === "other" ? formState.customBusinessSegment : "",
    });
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          required
          label={i18n.t("aiAgent.wizard.fields.identityName")}
          value={formState.identityName || ""}
          onChange={handleField("identityName")}
          error={Boolean(errors.identityName)}
          helperText={
            errors.identityName
              ? i18n.t(`aiAgent.wizard.errors.${errors.identityName}`)
              : i18n.t("aiAgent.wizard.hints.identityName")
          }
          inputProps={{ maxLength: 120 }}
          data-testid="ai-agent-wizard-identity-name"
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          required
          label={i18n.t("aiAgent.wizard.fields.companyName")}
          value={formState.companyName}
          onChange={handleField("companyName")}
          error={Boolean(errors.companyName)}
          helperText={
            errors.companyName
              ? i18n.t(`aiAgent.wizard.errors.${errors.companyName}`)
              : ""
          }
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          select
          fullWidth
          label={i18n.t("aiAgent.wizard.fields.businessSegment")}
          value={formState.businessSegment}
          onChange={(event) => handleSegment(event.target.value)}
          SelectProps={{ native: true }}
          error={Boolean(errors.businessSegment)}
          helperText={
            errors.businessSegment
              ? i18n.t(`aiAgent.wizard.errors.${errors.businessSegment}`)
              : i18n.t("aiAgent.wizard.hints.businessSegment")
          }
        >
          <option value="" />
          {AI_AGENT_BUSINESS_SEGMENTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </TextField>
      </Grid>

      {formState.businessSegment === "other" ? (
        <Grid item xs={12}>
          <TextField
            fullWidth
            required
            label={i18n.t("aiAgent.wizard.fields.customBusinessSegment")}
            value={formState.customBusinessSegment}
            onChange={handleField("customBusinessSegment")}
            error={Boolean(errors.customBusinessSegment)}
            helperText={
              errors.customBusinessSegment
                ? i18n.t(`aiAgent.wizard.errors.${errors.customBusinessSegment}`)
                : ""
            }
          />
        </Grid>
      ) : null}

      {formState.businessSegment ? (
        <Grid item xs={12}>
          <SegmentRecommendationsPanel
            segment={formState.businessSegment}
            formState={formState}
            onApply={onApplyRecommendations}
            segmentChanged={segmentChanged}
            onDismissSegmentChange={onDismissSegmentChange}
          />
        </Grid>
      ) : null}

      <Grid item xs={12}>
        <Grid container spacing={1}>
          {AI_AGENT_BUSINESS_SEGMENTS.slice(0, 8).map((item) => (
            <Grid item xs={6} sm={4} md={3} key={item.value}>
              <SelectableOptionCard
                title={item.label}
                selected={formState.businessSegment === item.value}
                onClick={() => handleSegment(item.value)}
              />
            </Grid>
          ))}
        </Grid>
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          label={i18n.t("aiAgent.wizard.fields.companyDescription")}
          value={formState.companyDescription}
          onChange={handleField("companyDescription")}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label={i18n.t("aiAgent.wizard.fields.serviceArea")}
          value={formState.serviceArea}
          onChange={handleField("serviceArea")}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label={i18n.t("aiAgent.wizard.fields.sourceWebsite")}
          value={formState.sourceWebsite}
          onChange={handleField("sourceWebsite")}
          error={Boolean(errors.sourceWebsite)}
          helperText={
            errors.sourceWebsite
              ? i18n.t(`aiAgent.wizard.errors.${errors.sourceWebsite}`)
              : i18n.t("aiAgent.wizard.hints.sourceWebsiteFuture")
          }
        />
      </Grid>
    </Grid>
  );
}
