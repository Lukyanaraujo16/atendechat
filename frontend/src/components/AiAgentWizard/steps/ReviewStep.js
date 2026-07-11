import React from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Alert from "@material-ui/lab/Alert";
import {
  AI_AGENT_ALLOWED_ACTIONS,
  AI_AGENT_BUSINESS_SEGMENTS,
  AI_AGENT_DEPARTMENTS,
  AI_AGENT_EMOJI_LEVELS,
  AI_AGENT_FORBIDDEN_ACTIONS,
  AI_AGENT_HANDOFF_RULES,
  AI_AGENT_RESPONSE_LENGTHS,
  AI_AGENT_TONES,
  findOptionLabel,
} from "../../../config/aiAgentProfileOptions";
import { i18n } from "../../../translate/i18n";

function ReviewSection({ title, children, onEdit }) {
  return (
    <Paper variant="outlined" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {onEdit ? (
          <Button size="small" color="primary" onClick={onEdit}>
            {i18n.t("aiAgent.wizard.buttons.editSection")}
          </Button>
        ) : null}
      </div>
      <Typography variant="body2" color="textSecondary" component="div" style={{ marginTop: 8 }}>
        {children}
      </Typography>
    </Paper>
  );
}

function joinLabels(values, options) {
  return (values || [])
    .map((value) => findOptionLabel(options, value))
    .filter(Boolean)
    .join(", ");
}

export default function ReviewStep({ formState, onEditStep, onPreviewPrompt }) {
  const segmentLabel =
    formState.businessSegment === "other"
      ? formState.customBusinessSegment
      : findOptionLabel(AI_AGENT_BUSINESS_SEGMENTS, formState.businessSegment);

  const toneLabel =
    formState.tone === "custom"
      ? formState.customTone
      : findOptionLabel(AI_AGENT_TONES, formState.tone);

  const faqCount = (formState.frequentlyAskedQuestions || []).filter(
    (item) => item.question?.trim() && item.answer?.trim()
  ).length;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Alert severity="info">{i18n.t("aiAgent.wizard.hints.reviewActivation")}</Alert>
      </Grid>

      <Grid item xs={12}>
        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.company")}
          onEdit={() => onEditStep("company")}
        >
          <div>{formState.companyName}</div>
          <div>{segmentLabel}</div>
          {formState.serviceArea ? <div>{formState.serviceArea}</div> : null}
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.attendant")}
          onEdit={() => onEditStep("attendant")}
        >
          <div>
            {formState.attendantName}
            {formState.attendantRole ? ` — ${formState.attendantRole}` : ""}
          </div>
          <div>{joinLabels(formState.departments, AI_AGENT_DEPARTMENTS)}</div>
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.personality")}
          onEdit={() => onEditStep("personality")}
        >
          <div>{toneLabel}</div>
          <div>
            {findOptionLabel(AI_AGENT_EMOJI_LEVELS, formState.emojiLevel)} ·{" "}
            {findOptionLabel(AI_AGENT_RESPONSE_LENGTHS, formState.responseLength)}
          </div>
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.allowedActions")}
          onEdit={() => onEditStep("allowedActions")}
        >
          {joinLabels(formState.allowedActions, AI_AGENT_ALLOWED_ACTIONS) ||
            i18n.t("aiAgent.wizard.labels.none")}
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.forbiddenActions")}
          onEdit={() => onEditStep("forbiddenActions")}
        >
          {joinLabels(formState.forbiddenActions, AI_AGENT_FORBIDDEN_ACTIONS)}
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.handoff")}
          onEdit={() => onEditStep("handoff")}
        >
          {joinLabels(formState.handoffRules, AI_AGENT_HANDOFF_RULES)}
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.businessKnowledge")}
          onEdit={() => onEditStep("businessKnowledge")}
        >
          {formState.productsAndServices ? <div>{formState.productsAndServices}</div> : null}
          {formState.importantInformation ? <div>{formState.importantInformation}</div> : null}
          {formState.businessHours ? <div>{formState.businessHours}</div> : null}
          <div>
            {i18n.t("aiAgent.wizard.labels.faqCount", { count: faqCount })}
          </div>
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.policies")}
          onEdit={() => onEditStep("policies")}
        >
          <div>{i18n.t("aiAgent.wizard.labels.policiesConfigured")}</div>
        </ReviewSection>
      </Grid>

      <Grid item xs={12}>
        <Button variant="text" color="primary" onClick={onPreviewPrompt}>
          {i18n.t("aiAgent.wizard.buttons.viewGeneratedConfig")}
        </Button>
      </Grid>
    </Grid>
  );
}
