import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import CircularProgress from "@material-ui/core/CircularProgress";
import Box from "@material-ui/core/Box";
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
import {
  WIZARD_STEP_IDS,
  createDefaultWizardFormState,
  createMinimalAiAgentPayload,
} from "./aiAgentWizardDefaults";
import {
  profileToWizardFormState,
  wizardFormStateToProfilePayload,
} from "./aiAgentWizardMappers";
import {
  hasWizardValidationErrors,
  mapBackendErrorToWizardFields,
  validateWizardStep,
} from "./aiAgentWizardValidation";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import {
  createAiAgent,
  deleteAiAgent,
  getAiAgent,
  getAiAgentProfile,
  updateAiAgentProfile,
} from "../../services/aiAgentApi";
import { listAiProviderCredentials } from "../../services/aiProviderCredentialApi";
import { AI_AGENT_ROUTE_PATH, AI_AGENT_SIMULATOR_ROUTE_PATH } from "../../config/aiAgentFeature";

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

export default function AiAgentWizard({ agentId: initialAgentId = null, mode = "create" }) {
  const classes = useStyles();
  const history = useHistory();
  const isEditMode = mode === "edit" && Boolean(initialAgentId);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [activeStepId, setActiveStepId] = useState("welcome");
  const [formState, setFormState] = useState(createDefaultWizardFormState);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [agentId, setAgentId] = useState(initialAgentId);
  const [draftAgentCreated, setDraftAgentCreated] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [segmentChanged, setSegmentChanged] = useState(false);
  const initialSnapshotRef = useRef(JSON.stringify(createDefaultWizardFormState()));

  const activeIndex = stepIndexById(activeStepId);
  const isWelcome = activeStepId === "welcome";
  const isReview = activeStepId === "review";
  const isSuccess = completed;

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
    if (!isEditMode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [{ data: agentData }, { data: profileData }] = await Promise.all([
        getAiAgent(initialAgentId),
        getAiAgentProfile(initialAgentId),
      ]);
      const nextState = profileData?.profile
        ? profileToWizardFormState(profileData.profile)
        : {
            ...createDefaultWizardFormState(),
            attendantName: agentData?.name || "",
          };
      setFormState(nextState);
      initialSnapshotRef.current = JSON.stringify(nextState);
      setAgentId(initialAgentId);
    } catch (err) {
      toastError(err);
      history.push(AI_AGENT_ROUTE_PATH);
    } finally {
      setLoading(false);
    }
  }, [history, initialAgentId, isEditMode]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const { data } = await listAiProviderCredentials();
        setHasCredentials(Array.isArray(data) && data.length > 0);
      } catch {
        setHasCredentials(false);
      }
    };
    loadCredentials();
  }, []);

  const patchFormState = (patch) => {
    setFormState((prev) => {
      const next = { ...prev, ...patch };
      setDirty(JSON.stringify(next) !== initialSnapshotRef.current);
      return next;
    });
    setErrors({});
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

  const ensureDraftAgent = async () => {
    if (agentId) return agentId;
    const created = await createAiAgent(createMinimalAiAgentPayload(formState));
    const newId = created?.data?.id;
    if (!newId) throw new Error("missing_agent_id");
    setAgentId(newId);
    setDraftAgentCreated(true);
    return newId;
  };

  const cleanupDraftAgent = async () => {
    if (!draftAgentCreated || !agentId || isEditMode) return;
    try {
      await deleteAiAgent(agentId);
    } catch {
      // best effort
    }
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
    await cleanupDraftAgent();
    history.push(AI_AGENT_ROUTE_PATH);
  };

  const validateCurrentStep = () => {
    if (isWelcome || isReview || isSuccess) {
      setErrors({});
      return true;
    }
    const stepErrors = validateWizardStep(activeStepId, formState);
    setErrors(stepErrors);
    return !hasWizardValidationErrors(stepErrors);
  };

  const goToStep = (stepId) => {
    setActiveStepId(stepId);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    if (activeIndex <= 0) return;
    goToStep(WIZARD_STEP_IDS[activeIndex - 1]);
  };

  const handleContinue = async () => {
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
    setSaving(true);
    try {
      const targetAgentId = isEditMode ? agentId : await ensureDraftAgent();
      await updateAiAgentProfile(targetAgentId, profilePayload);
      setDraftAgentCreated(false);
      initialSnapshotRef.current = JSON.stringify(formState);
      setDirty(false);
      setCompleted(true);
      toast.success(
        isEditMode
          ? i18n.t("aiAgent.wizard.toasts.updated")
          : i18n.t("aiAgent.wizard.toasts.created")
      );
    } catch (err) {
      const mapped = mapBackendErrorToWizardFields(err);
      if (Object.keys(mapped.fields).length) setErrors(mapped.fields);
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      const targetAgentId = isEditMode ? agentId : await ensureDraftAgent();
      if (!targetAgentId) return;
      setAgentId(targetAgentId);
      setPreviewOpen(true);
    } catch (err) {
      toastError(err);
    }
  };

  const renderStep = () => {
    if (isSuccess) {
      return (
        <SuccessStep
          formState={formState}
          agentId={agentId}
          hasCredentials={hasCredentials}
          onViewAgent={() => history.push(AI_AGENT_ROUTE_PATH)}
          onConfigureCredential={() => history.push(AI_AGENT_ROUTE_PATH)}
          onBackToList={() => history.push(AI_AGENT_ROUTE_PATH)}
          onTestAttendant={() =>
            history.push(AI_AGENT_SIMULATOR_ROUTE_PATH.replace(":agentId", String(agentId)))
          }
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
            onEditStep={goToStep}
            onPreviewPrompt={handlePreview}
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

  const continueLabel = isWelcome
    ? i18n.t("aiAgent.wizard.buttons.start")
    : isReview
      ? isEditMode
        ? i18n.t("aiAgent.wizard.buttons.saveChanges")
        : i18n.t("aiAgent.wizard.buttons.createAgent")
      : i18n.t("aiAgent.wizard.buttons.continue");

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

      <AiAgentPromptPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        agentId={agentId}
        profilePayload={profilePayload}
      />

      <Paper className={classes.paper} variant="outlined">
        {!isSuccess && !isWelcome ? (
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
            showBack={activeIndex > 0 && activeStepId !== "welcome"}
            showCancel
            onBack={handleBack}
            onCancel={requestExit}
            onContinue={handleContinue}
            loading={saving}
            continueLabel={continueLabel}
          />
        ) : null}
      </Paper>
    </>
  );
}
