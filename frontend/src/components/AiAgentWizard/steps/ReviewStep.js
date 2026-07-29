import React, { useEffect, useRef } from "react";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Checkbox from "@material-ui/core/Checkbox";
import TextField from "@material-ui/core/TextField";
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
import {
  filterAiAgentWizardCredentialsByProvider,
  filterAiAgentWizardModelsByProvider,
} from "../aiAgentWizardProductMapper";

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

export default function ReviewStep({
  formState,
  onChange,
  onEditStep,
  onPreviewPrompt,
  options,
  editableWhileActive,
  previewAvailable,
  commercialError,
  onConfigureCredential,
}) {
  const providerFieldRef = useRef(null);
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
  const models = filterAiAgentWizardModelsByProvider(
    options?.models,
    formState.provider
  );
  const credentials = filterAiAgentWizardCredentialsByProvider(
    options?.credentials,
    formState.provider
  );
  const structuralLocked = editableWhileActive === false;
  const identityEditable = true;
  const connectionNames = new Map(
    (options?.connections || []).map((connection) => [
      connection.ref,
      connection.name,
    ])
  );

  useEffect(() => {
    if (
      commercialError === "providerRequired" ||
      commercialError === "providerUnsupported"
    ) {
      const providerNode = providerFieldRef.current;
      if (providerNode && typeof providerNode.scrollIntoView === "function") {
        providerNode.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [commercialError]);

  const commercialFieldError = (field) => {
    if (!commercialError) return false;
    if (field === "provider") {
      return (
        commercialError === "providerRequired" ||
        commercialError === "providerUnsupported"
      );
    }
    if (field === "model") {
      return (
        commercialError === "modelRequired" ||
        commercialError === "modelIncompatible"
      );
    }
    if (field === "credential") {
      return (
        commercialError === "credentialRequired" ||
        commercialError === "credentialMissing"
      );
    }
    return false;
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Alert severity="info">{i18n.t("aiAgent.wizard.hints.reviewActivation")}</Alert>
      </Grid>
      {structuralLocked ? (
        <Grid item xs={12}>
          <Alert severity="warning">
            {i18n.t("aiAgent.wizard.product.structuralLocked")}
          </Alert>
        </Grid>
      ) : null}
      {commercialError ? (
        <Grid item xs={12}>
          <Alert
            severity="error"
            action={
              commercialError === "credentialMissing" && onConfigureCredential ? (
                <Button color="inherit" size="small" onClick={onConfigureCredential}>
                  {i18n.t("aiAgent.wizard.buttons.configureCredential")}
                </Button>
              ) : null
            }
          >
            {i18n.t(`aiAgent.wizard.product.${commercialError}`)}
          </Alert>
        </Grid>
      ) : null}

      <Grid item xs={12}>
        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.company")}
          onEdit={identityEditable ? () => onEditStep("company") : null}
        >
          <div>{formState.companyName}</div>
          <div>{segmentLabel}</div>
          {formState.serviceArea ? <div>{formState.serviceArea}</div> : null}
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.attendant")}
          onEdit={identityEditable ? () => onEditStep("attendant") : null}
        >
          <div>
            {formState.attendantName}
            {formState.attendantRole ? ` — ${formState.attendantRole}` : ""}
          </div>
          <div>{joinLabels(formState.departments, AI_AGENT_DEPARTMENTS)}</div>
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.personality")}
          onEdit={structuralLocked ? null : () => onEditStep("personality")}
        >
          <div>{toneLabel}</div>
          <div>
            {findOptionLabel(AI_AGENT_EMOJI_LEVELS, formState.emojiLevel)} ·{" "}
            {findOptionLabel(AI_AGENT_RESPONSE_LENGTHS, formState.responseLength)}
          </div>
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.allowedActions")}
          onEdit={structuralLocked ? null : () => onEditStep("allowedActions")}
        >
          {joinLabels(formState.allowedActions, AI_AGENT_ALLOWED_ACTIONS) ||
            i18n.t("aiAgent.wizard.labels.none")}
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.forbiddenActions")}
          onEdit={structuralLocked ? null : () => onEditStep("forbiddenActions")}
        >
          {joinLabels(formState.forbiddenActions, AI_AGENT_FORBIDDEN_ACTIONS)}
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.handoff")}
          onEdit={structuralLocked ? null : () => onEditStep("handoff")}
        >
          {joinLabels(formState.handoffRules, AI_AGENT_HANDOFF_RULES)}
        </ReviewSection>

        <ReviewSection
          title={i18n.t("aiAgent.wizard.sections.businessKnowledge")}
          onEdit={
            structuralLocked ? null : () => onEditStep("businessKnowledge")
          }
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
          onEdit={structuralLocked ? null : () => onEditStep("policies")}
        >
          <div>{i18n.t("aiAgent.wizard.labels.policiesConfigured")}</div>
        </ReviewSection>

        <ReviewSection title={i18n.t("aiAgent.wizard.sections.identityMessages")}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                variant="outlined"
                fullWidth
                size="small"
                multiline
                minRows={2}
                label={i18n.t("aiAgent.wizard.fields.fallbackMessage")}
                value={formState.fallbackMessage || ""}
                onChange={(event) =>
                  onChange({ fallbackMessage: event.target.value })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                variant="outlined"
                fullWidth
                size="small"
                multiline
                minRows={2}
                label={i18n.t("aiAgent.wizard.fields.handoffMessage")}
                value={formState.handoffMessage || ""}
                onChange={(event) =>
                  onChange({ handoffMessage: event.target.value })
                }
              />
            </Grid>
          </Grid>
        </ReviewSection>

        <ReviewSection title={i18n.t("aiAgent.wizard.sections.commercialSetup")}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4} ref={providerFieldRef}>
              <FormControl
                variant="outlined"
                fullWidth
                size="small"
                error={commercialFieldError("provider")}
              >
                <InputLabel>{i18n.t("aiAgent.wizard.fields.provider")}</InputLabel>
                <Select
                  value={formState.provider || ""}
                  onChange={(event) =>
                    onChange({
                      provider: event.target.value,
                      model: "",
                      credentialRef: "",
                    })
                  }
                  label={i18n.t("aiAgent.wizard.fields.provider")}
                  disabled={structuralLocked}
                  data-testid="wizard-provider-select"
                >
                  {(options?.providers || []).map((provider) => (
                    <MenuItem
                      key={provider.value}
                      value={provider.value}
                      disabled={!provider.available}
                    >
                      {provider.label}
                      {!provider.available
                        ? ` — ${i18n.t("aiAgent.wizard.product.providerUnsupported")}`
                        : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl
                variant="outlined"
                fullWidth
                size="small"
                error={commercialFieldError("model")}
              >
                <InputLabel>{i18n.t("aiAgent.wizard.fields.model")}</InputLabel>
                <Select
                  value={formState.model || ""}
                  onChange={(event) => onChange({ model: event.target.value })}
                  label={i18n.t("aiAgent.wizard.fields.model")}
                  disabled={structuralLocked || !formState.provider}
                  data-testid="wizard-model-select"
                >
                  {models.map((model) => (
                    <MenuItem key={model.value} value={model.value}>
                      {model.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl
                variant="outlined"
                fullWidth
                size="small"
                error={commercialFieldError("credential")}
              >
                <InputLabel>{i18n.t("aiAgent.wizard.fields.credential")}</InputLabel>
                <Select
                  value={formState.credentialRef || ""}
                  onChange={(event) =>
                    onChange({ credentialRef: event.target.value })
                  }
                  label={i18n.t("aiAgent.wizard.fields.credential")}
                  disabled={structuralLocked || !formState.provider}
                  data-testid="wizard-credential-select"
                >
                  {credentials.map((credential) => (
                    <MenuItem
                      key={credential.ref}
                      value={credential.ref}
                      disabled={!credential.enabled}
                    >
                      {credential.name} — {credential.maskedKey}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl variant="outlined" fullWidth size="small">
                <InputLabel>{i18n.t("aiAgent.wizard.fields.connections")}</InputLabel>
                <Select
                  multiple
                  value={formState.connectionRefs || []}
                  onChange={(event) =>
                    onChange({ connectionRefs: event.target.value })
                  }
                  renderValue={(selected) =>
                    selected.map((ref) => connectionNames.get(ref) || ref).join(", ")
                  }
                  label={i18n.t("aiAgent.wizard.fields.connections")}
                  disabled={structuralLocked}
                  data-testid="wizard-connections-select"
                >
                  {(options?.connections || []).map((connection) => (
                    <MenuItem
                      key={connection.ref}
                      value={connection.ref}
                      disabled={!connection.eligible}
                    >
                      <Checkbox
                        checked={(formState.connectionRefs || []).includes(
                          connection.ref
                        )}
                      />
                      {connection.name}
                      {!connection.eligible
                        ? ` — ${i18n.t("aiAgent.wizard.product.connectionIneligible")}`
                        : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </ReviewSection>
      </Grid>

      <Grid item xs={12}>
        <Button
          variant="text"
          color="primary"
          onClick={onPreviewPrompt}
          disabled={!previewAvailable || structuralLocked}
        >
          {i18n.t("aiAgent.wizard.buttons.viewGeneratedConfig")}
        </Button>
      </Grid>
    </Grid>
  );
}
