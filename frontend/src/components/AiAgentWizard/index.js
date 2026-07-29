import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import CircularProgress from "@material-ui/core/CircularProgress";
import Box from "@material-ui/core/Box";
import Button from "@material-ui/core/Button";
import Alert from "@material-ui/lab/Alert";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import ConfirmationModal from "../ConfirmationModal";
import AiAgentWizardProgress from "./AiAgentWizardProgress";
import AiAgentWizardNavigation from "./AiAgentWizardNavigation";
import AiAgentPromptPreviewModal from "./AiAgentPromptPreviewModal";
import WelcomeStep from "./steps/WelcomeStep";
import CompanyStep from "./steps/CompanyStep";
import AttendantStep from "./steps/AttendantStep";
import PersonalityStep from "./steps/PersonalityStep";
import AllowedActionsStep from "./steps/AllowedActionsStep";
import ForbiddenActionsStep from "./steps/ForbiddenActionsStep";
import HandoffStep from "./steps/HandoffStep";
import BusinessKnowledgeStep from "./steps/BusinessKnowledgeStep";
import PoliciesStep from "./steps/PoliciesStep";
import ReviewStep from "./steps/ReviewStep";
import SuccessStep from "./steps/SuccessStep";
import ActiveAgentIdentityStep from "./steps/ActiveAgentIdentityStep";
import ActiveAgentIdentitySuccess from "./steps/ActiveAgentIdentitySuccess";
import {
  WIZARD_STEP_IDS,
  createDefaultWizardFormState,
} from "./aiAgentWizardDefaults";
import { wizardFormStateToProfilePayload } from "./aiAgentWizardMappers";
import {
  aiAgentProductConfigurationToWizardFormState,
  aiAgentWizardIdentitySnapshot,
  isAiAgentWizardScopeBlocked,
  isAiAgentWizardActiveIdentityMode,
  mapAiAgentWizardProductOptions,
  validateAiAgentWizardIdentity,
  validateAiAgentWizardCommercialSetup,
  wizardFormStateToProductConfigurationPayload,
  wizardFormStateToProductConnectionsPayload,
  wizardFormStateToProductIdentityPayload,
} from "./aiAgentWizardProductMapper";
import {
  hasWizardValidationErrors,
  mapBackendErrorToWizardFields,
  validateWizardStep,
} from "./aiAgentWizardValidation";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { useAiAgentProductConfiguration } from "../../hooks/useAiAgentProductConfiguration";
import { AI_AGENT_ROUTE_PATH, AI_AGENT_SIMULATOR_ROUTE_PATH } from "../../config/aiAgentFeature";
import { AuthContext } from "../../context/Auth/AuthContext";

const CONTENT_STEP_IDS = WIZARD_STEP_IDS.filter((id) => id !== "welcome");

const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2),
    maxWidth: 960,
    margin: "0 auto",
    ...theme.scrollbarStyles,
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(6),
  },
}));

function stepIndexById(stepId) {
  return WIZARD_STEP_IDS.indexOf(stepId);
}

function productConfigurationErrorKey(err) {
  const code = String(err?.response?.data?.error || err?.message || "");
  if (code.includes("AMBIGUOUS")) return "ambiguous";
  if (code.includes("ALREADY_EXISTS")) return "alreadyExists";
  if (code.includes("UPDATE_NOT_ALLOWED")) return "updateNotAllowed";
  if (code.includes("CONNECTION_ALREADY_ASSIGNED")) return "connectionAssigned";
  if (code.includes("CONNECTION")) return "connectionInvalid";
  if (code.includes("CREDENTIAL")) return "credentialInvalid";
  if (code.includes("PROVIDER") || code.includes("MODEL")) return "providerInvalid";
  return null;
}

export default function AiAgentWizard() {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext) || {};
  const tenantId = user?.companyId ?? null;
  const {
    loading,
    loadAll,
    create,
    update,
    updateConnections,
    preview,
  } = useAiAgentProductConfiguration(tenantId);
  const [saving, setSaving] = useState(false);
  const [activeStepId, setActiveStepId] = useState("welcome");
  const [formState, setFormState] = useState(createDefaultWizardFormState);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [wizardMode, setWizardMode] = useState("create");
  const [agentScope, setAgentScope] = useState(null);
  const [productOptions, setProductOptions] = useState(
    mapAiAgentWizardProductOptions(null)
  );
  const [editableWhileActive, setEditableWhileActive] = useState(true);
  const [summary, setSummary] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAvailable, setPreviewAvailable] = useState(true);
  const [commercialError, setCommercialError] = useState("");
  const [segmentChanged, setSegmentChanged] = useState(false);
  const initialSnapshotRef = useRef(JSON.stringify(createDefaultWizardFormState()));

  const activeIndex = stepIndexById(activeStepId);
  const isWelcome = activeStepId === "welcome";
  const isReview = activeStepId === "review";
  const isSuccess = completed;
  const isEditMode = wizardMode === "edit";
  const activeIdentityMode = isAiAgentWizardActiveIdentityMode({
    isEditMode,
    editableWhileActive,
  });
  const isAmbiguous = isAiAgentWizardScopeBlocked(agentScope);
  const agentId =
    summary?.agentScope?.type === "single" ? summary?.agent?.id : null;
  const hasCredentials = productOptions.credentials.some(
    (credential) => credential.enabled
  );

  const progressIndex = useMemo(() => {
    if (isWelcome) return 0;
    const contentIndex = CONTENT_STEP_IDS.indexOf(activeStepId);
    return contentIndex >= 0 ? contentIndex : CONTENT_STEP_IDS.length - 1;
  }, [activeStepId, isWelcome]);

  const stepMeta = useMemo(
    () => ({
      welcome: {
        title: i18n.t("aiAgent.wizard.steps.welcome.title"),
        description: i18n.t("aiAgent.wizard.steps.welcome.description"),
      },
      company: {
        title: i18n.t("aiAgent.wizard.steps.company.title"),
        description: i18n.t("aiAgent.wizard.steps.company.description"),
      },
      attendant: {
        title: i18n.t("aiAgent.wizard.steps.attendant.title"),
        description: i18n.t("aiAgent.wizard.steps.attendant.description"),
      },
      personality: {
        title: i18n.t("aiAgent.wizard.steps.personality.title"),
        description: i18n.t("aiAgent.wizard.steps.personality.description"),
      },
      allowedActions: {
        title: i18n.t("aiAgent.wizard.steps.allowedActions.title"),
        description: i18n.t("aiAgent.wizard.steps.allowedActions.description"),
      },
      forbiddenActions: {
        title: i18n.t("aiAgent.wizard.steps.forbiddenActions.title"),
        description: i18n.t("aiAgent.wizard.steps.forbiddenActions.description"),
      },
      handoff: {
        title: i18n.t("aiAgent.wizard.steps.handoff.title"),
        description: i18n.t("aiAgent.wizard.steps.handoff.description"),
      },
      businessKnowledge: {
        title: i18n.t("aiAgent.wizard.steps.businessKnowledge.title"),
        description: i18n.t("aiAgent.wizard.steps.businessKnowledge.description"),
      },
      policies: {
        title: i18n.t("aiAgent.wizard.steps.policies.title"),
        description: i18n.t("aiAgent.wizard.steps.policies.description"),
      },
      review: {
        title: i18n.t("aiAgent.wizard.steps.review.title"),
        description: i18n.t("aiAgent.wizard.steps.review.description"),
      },
    }),
    []
  );

  const profilePayload = useMemo(
    () => wizardFormStateToProfilePayload(formState),
    [formState]
  );

  const loadInitialData = useCallback(async () => {
    try {
      const loaded = await loadAll();
      const view = loaded.configuration || {};
      const mappedOptions = mapAiAgentWizardProductOptions(loaded.options);
      const scope = view.agentScope || { type: "none", count: 0 };
      setAgentScope(scope);
      setProductOptions(mappedOptions);
      setSummary(view.summary || null);
      setEditableWhileActive(view.editableWhileActive !== false);

      if (scope.type === "ambiguous") return;

      const nextState =
        scope.type === "single" && view.configuration
          ? aiAgentProductConfigurationToWizardFormState(
              view.configuration,
              loaded.options
            )
          : createDefaultWizardFormState();
      const nextIsEditMode = scope.type === "single";
      const nextActiveIdentityMode =
        nextIsEditMode && view.editableWhileActive === false;
      setFormState(nextState);
      initialSnapshotRef.current = nextActiveIdentityMode
        ? aiAgentWizardIdentitySnapshot(nextState)
        : JSON.stringify(nextState);
      setWizardMode(nextIsEditMode ? "edit" : "create");
      setActiveStepId(nextActiveIdentityMode ? "activeIdentity" : "welcome");
      setCompleted(false);
      setDirty(false);
    } catch (err) {
      toastError(err);
      history.push(AI_AGENT_ROUTE_PATH);
    }
  }, [history, loadAll, tenantId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (
      activeIdentityMode &&
      !completed &&
      activeStepId !== "activeIdentity"
    ) {
      setActiveStepId("activeIdentity");
    }
  }, [activeIdentityMode, activeStepId, completed]);

  const patchFormState = (patch) => {
    setFormState((prev) => {
      const next = { ...prev, ...patch };
      const snapshot = activeIdentityMode
        ? aiAgentWizardIdentitySnapshot(next)
        : JSON.stringify(next);
      setDirty(snapshot !== initialSnapshotRef.current);
      return next;
    });
    setErrors({});
    setCommercialError("");
  };

  const handleSegmentSelect = (newSegment, previousSegment) => {
    if (previousSegment && previousSegment !== newSegment) {
      setSegmentChanged(true);
    }
  };

  const handleApplyRecommendations = (nextState) => {
    setFormState((prev) => {
      const merged = { ...prev, ...nextState };
      setDirty(JSON.stringify(merged) !== initialSnapshotRef.current);
      return merged;
    });
    setSegmentChanged(false);
    toast.success(i18n.t("aiAgent.wizard.segment.applySuccess"));
  };

  const requestExit = () => {
    if (dirty && !isSuccess) {
      setConfirmExitOpen(true);
      return;
    }
    history.push(AI_AGENT_ROUTE_PATH);
  };

  const handleConfirmExit = async () => {
    setConfirmExitOpen(false);
    history.push(AI_AGENT_ROUTE_PATH);
  };

  const validateCurrentStep = () => {
    if (activeIdentityMode) {
      const identityErrors = validateAiAgentWizardIdentity(formState);
      setErrors(identityErrors);
      return !hasWizardValidationErrors(identityErrors);
    }
    if (isWelcome || isReview || isSuccess) {
      setErrors({});
      return true;
    }
    const stepErrors = validateWizardStep(activeStepId, formState);
    setErrors(stepErrors);
    return !hasWizardValidationErrors(stepErrors);
  };

  const goToStep = (stepId) => {
    if (activeIdentityMode) {
      setActiveStepId("activeIdentity");
      setErrors({});
      return;
    }
    setActiveStepId(stepId);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    if (activeIdentityMode) return;
    if (activeIndex <= 0) return;
    goToStep(WIZARD_STEP_IDS[activeIndex - 1]);
  };

  const handleContinue = async () => {
    if (activeIdentityMode) {
      if (!validateCurrentStep()) return;
      await handleSubmit();
      return;
    }
    if (isWelcome) {
      goToStep("company");
      return;
    }

    if (isReview) {
      await handleSubmit();
      return;
    }

    if (!validateCurrentStep()) return;
    goToStep(WIZARD_STEP_IDS[activeIndex + 1]);
  };

  const handleSubmit = async () => {
    if (saving) return;

    const identityOnly = activeIdentityMode;

    if (identityOnly) {
      const identityErrors = validateAiAgentWizardIdentity(formState);
      if (hasWizardValidationErrors(identityErrors)) {
        setErrors(identityErrors);
        return;
      }
    } else {
      const commercialErrorResult = validateAiAgentWizardCommercialSetup(
        formState,
        productOptions
      );
      if (commercialErrorResult) {
        setCommercialError(commercialErrorResult.errorKey);
        return;
      }
    }

    setSaving(true);
    try {
      let result;
      if (identityOnly) {
        result = await update(
          wizardFormStateToProductIdentityPayload(formState)
        );
      } else if (isEditMode) {
        result = await update(
          wizardFormStateToProductConfigurationPayload(formState)
        );
        result = await updateConnections(
          wizardFormStateToProductConnectionsPayload(formState)
        );
      } else {
        result = await create(
          wizardFormStateToProductConfigurationPayload(formState, {
            forCreate: true,
            includeConnections: true,
          })
        );
        setWizardMode("edit");
        setAgentScope({ type: "single", count: 1 });
      }
      setSummary(result?.summary || null);
      initialSnapshotRef.current = identityOnly
        ? aiAgentWizardIdentitySnapshot(formState)
        : JSON.stringify(formState);
      setDirty(false);
      setCompleted(true);
      toast.success(
        identityOnly
          ? i18n.t("aiAgent.wizard.toasts.identityUpdated")
          : isEditMode
          ? i18n.t("aiAgent.wizard.toasts.updated")
          : i18n.t("aiAgent.wizard.toasts.created")
      );
    } catch (err) {
      const code = String(err?.response?.data?.error || "");
      if (!isEditMode && code.includes("ALREADY_EXISTS")) {
        await loadInitialData();
        toast.info(i18n.t("aiAgentProduct.configurationErrors.alreadyExists"));
        return;
      }
      const mapped = mapBackendErrorToWizardFields(err);
      if (Object.keys(mapped.fields).length) setErrors(mapped.fields);
      const productErrorKey = productConfigurationErrorKey(err);
      if (productErrorKey) {
        toast.error(
          i18n.t(`aiAgentProduct.configurationErrors.${productErrorKey}`)
        );
      } else {
        toastError(err);
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    setPreviewOpen(true);
  };

  const renderStep = () => {
    if (isSuccess && activeIdentityMode) {
      return (
        <ActiveAgentIdentitySuccess
          formState={formState}
          summary={summary}
          onBackToHub={() => history.push(AI_AGENT_ROUTE_PATH)}
        />
      );
    }

    if (isSuccess) {
      return (
        <SuccessStep
          formState={formState}
          agentId={agentId}
          hasCredentials={hasCredentials}
          summary={summary}
          onViewAgent={() => history.push(AI_AGENT_ROUTE_PATH)}
          onConfigureCredential={() => history.push(AI_AGENT_ROUTE_PATH)}
          onBackToList={() => history.push(AI_AGENT_ROUTE_PATH)}
          onTestAttendant={() =>
            history.push(AI_AGENT_SIMULATOR_ROUTE_PATH.replace(":agentId", String(agentId)))
          }
        />
      );
    }

    if (activeIdentityMode) {
      return (
        <ActiveAgentIdentityStep
          formState={formState}
          onChange={patchFormState}
          errors={errors}
        />
      );
    }

    switch (activeStepId) {
      case "welcome":
        return <WelcomeStep />;
      case "company":
        return (
          <CompanyStep
            formState={formState}
            onChange={patchFormState}
            errors={errors}
            onSegmentSelect={handleSegmentSelect}
            segmentChanged={segmentChanged}
            onDismissSegmentChange={() => setSegmentChanged(false)}
            onApplyRecommendations={handleApplyRecommendations}
          />
        );
      case "attendant":
        return <AttendantStep formState={formState} onChange={patchFormState} errors={errors} />;
      case "personality":
        return (
          <PersonalityStep formState={formState} onChange={patchFormState} errors={errors} />
        );
      case "allowedActions":
        return <AllowedActionsStep formState={formState} onChange={patchFormState} />;
      case "forbiddenActions":
        return <ForbiddenActionsStep formState={formState} onChange={patchFormState} />;
      case "handoff":
        return <HandoffStep formState={formState} onChange={patchFormState} errors={errors} />;
      case "businessKnowledge":
        return (
          <BusinessKnowledgeStep
            formState={formState}
            onChange={patchFormState}
            errors={errors}
            onApplyRecommendations={handleApplyRecommendations}
          />
        );
      case "policies":
        return <PoliciesStep formState={formState} onChange={patchFormState} errors={errors} />;
      case "review":
        return (
          <ReviewStep
            formState={formState}
            onChange={patchFormState}
            onEditStep={goToStep}
            onPreviewPrompt={handlePreview}
            options={productOptions}
            editableWhileActive={editableWhileActive}
            previewAvailable={previewAvailable}
            commercialError={commercialError}
            onConfigureCredential={() => history.push(AI_AGENT_ROUTE_PATH)}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box className={classes.loading}>
        <CircularProgress />
      </Box>
    );
  }

  if (isAmbiguous) {
    return (
      <Paper className={classes.paper} variant="outlined">
        <Alert severity="warning" style={{ marginBottom: 16 }}>
          {i18n.t("aiAgent.wizard.product.ambiguous")}
        </Alert>
        <Button
          variant="contained"
          color="primary"
          onClick={() => history.push(AI_AGENT_ROUTE_PATH)}
        >
          {i18n.t("aiAgent.wizard.buttons.backToList")}
        </Button>
      </Paper>
    );
  }

  const continueLabel = isWelcome
    ? i18n.t("aiAgent.wizard.buttons.start")
    : isReview
      ? isEditMode && editableWhileActive === false
        ? i18n.t("aiAgent.wizard.buttons.saveIdentity")
        : isEditMode
          ? i18n.t("aiAgent.wizard.buttons.saveChanges")
          : i18n.t("aiAgent.wizard.buttons.createAgent")
      : i18n.t("aiAgent.wizard.buttons.continue");
  const effectiveContinueLabel = activeIdentityMode
    ? i18n.t("aiAgent.wizard.buttons.saveIdentity")
    : continueLabel;

  return (
    <>
      <ConfirmationModal
        title={i18n.t("aiAgent.wizard.confirmExit.title")}
        open={confirmExitOpen}
        onClose={() => setConfirmExitOpen(false)}
        onConfirm={handleConfirmExit}
      >
        {i18n.t("aiAgent.wizard.confirmExit.message")}
      </ConfirmationModal>

      {!activeIdentityMode ? (
        <AiAgentPromptPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          profilePayload={profilePayload}
          loadPreview={preview}
          onUnavailable={() => setPreviewAvailable(false)}
        />
      ) : null}

      <Paper className={classes.paper} variant="outlined">
        {!activeIdentityMode && !isSuccess && !isWelcome ? (
          <AiAgentWizardProgress
            currentIndex={progressIndex}
            totalSteps={CONTENT_STEP_IDS.length}
            stepTitle={stepMeta[activeStepId]?.title}
            stepDescription={stepMeta[activeStepId]?.description}
          />
        ) : null}

        {renderStep()}

        {!isSuccess ? (
          <AiAgentWizardNavigation
            showBack={
              !activeIdentityMode &&
              activeIndex > 0 &&
              activeStepId !== "welcome"
            }
            showCancel
            onBack={handleBack}
            onCancel={requestExit}
            onContinue={handleContinue}
            loading={saving}
            continueLabel={effectiveContinueLabel}
            continueDisabled={false}
          />
        ) : null}
      </Paper>
    </>
  );
}
